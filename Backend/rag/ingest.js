/**
 * rag/ingest.js — RAG Knowledge Ingestion Pipeline
 * ================================================
 *
 * What this script does:
 *   1. Collects "documents" from two sources:
 *      A. Medicine information (from productData.js via static copy in rag/knowledgeData.js)
 *      B. Blog articles (from blogData.js via static copy in rag/knowledgeData.js)
 *
 *   2. Chunks each document into meaningful semantic sections
 *      (NOT arbitrary character splits — each chunk answers a specific question type)
 *
 *   3. Generates a 3072-dimensional embedding for each chunk using:
 *      Gemini gemini-embedding-001 with TaskType.RETRIEVAL_DOCUMENT
 *
 *   4. Stores (text + metadata + embedding) into the knowledge_chunks PostgreSQL table
 *
 * Run this script:
 *   node Backend/rag/ingest.js
 *
 * Re-run whenever:
 *   - New products are added to the knowledge base
 *   - Blog articles are added or updated
 *
 * IMPORTANT: This does NOT ingest live price/stock data.
 * Price and stock always come from the live products table via productSearch.js
 */

'use strict';

require('dotenv').config();
const { GoogleGenerativeAI, TaskType } = require('@google/generative-ai');
const pool = require('../db');

// ─── AI Client Setup ─────────────────────────────────────────────────────────
let embeddingModel = null;
if (process.env.GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // gemini-embedding-001 produces 3072-dimensional embeddings
  embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
} else {
  console.log('ℹ Notice: GEMINI_API_KEY not found. Chunks will be ingested with text and metadata for keyword RAG search (powered by Groq completions).');
}

// ─── Configuration ────────────────────────────────────────────────────────────
// Free tier limit: 100 embed requests/minute.
// We process ONE chunk at a time with 700ms delay → ~85 requests/min (safe under limit).
// Ingestion of 166 chunks takes ~2 minutes total.
const REQUEST_DELAY_MS = 700;  // ms between each embedding request
const MAX_RETRIES = 3;          // retry attempts on 429 rate-limit errors

// ─── Colour helpers ───────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', grey: '\x1b[90m',
};
const log = {
  info:    (m) => console.log(`${c.cyan}ℹ${c.reset}  ${m}`),
  success: (m) => console.log(`${c.green}✔${c.reset}  ${m}`),
  warn:    (m) => console.log(`${c.yellow}⚠${c.reset}  ${m}`),
  error:   (m) => console.error(`${c.red}✘${c.reset}  ${m}`),
  title:   (m) => console.log(`\n${c.bold}${c.cyan}${m}${c.reset}\n`),
  dim:     (m) => console.log(`${c.grey}   ${m}${c.reset}`),
};

// ─── Sleep utility ────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Step 1: Load knowledge sources ──────────────────────────────────────────
// We import from knowledgeData.js which is a CommonJS copy of the frontend data
const { products, articles } = require('./knowledgeData');

// ─── Step 2: Chunking ────────────────────────────────────────────────────────
/**
 * Why this chunking strategy?
 *
 * Each "chunk" represents one specific facet of a medicine's information.
 * This means when a user asks "what are the side effects of Paracetamol?",
 * the vector search retrieves the side_effects chunk (highly relevant) rather
 * than a large blob containing all medicine info (partially relevant).
 *
 * Each chunk has a source_type that tells the retriever and the prompt exactly
 * what kind of information it contains.
 */
function chunkProducts(products) {
  const chunks = [];

  for (const p of products) {
    const base = {
      source_id:   String(p.id),
      source_name: p.name,
      category:    p.category,
      metadata: {
        manufacturer: p.manufacturer,
        product_id:   p.id,
        rx_required:  p.rxRequired,
        subcategory:  p.subcategory || null,
      },
    };

    // Chunk A: Overview — "What is X?"
    if (p.description) {
      chunks.push({
        ...base,
        source_type: 'medicine_overview',
        source_name: `${p.name} — Overview`,
        content: `${p.name} by ${p.manufacturer}. Category: ${p.category}${p.subcategory ? ', ' + p.subcategory : ''}. ${p.description}${p.rxRequired ? ' This medicine requires a prescription.' : ''}`,
      });
    }

    // Chunk B: Dosage — "How do I take X?"
    if (p.dosage) {
      chunks.push({
        ...base,
        source_type: 'medicine_dosage',
        source_name: `${p.name} — Dosage`,
        content: `Dosage instructions for ${p.name}: ${p.dosage}`,
      });
    }

    // Chunk C: Side effects — "What are the side effects of X?"
    if (p.sideEffects && p.sideEffects.length > 0) {
      chunks.push({
        ...base,
        source_type: 'medicine_side_effects',
        source_name: `${p.name} — Side Effects`,
        content: `Side effects of ${p.name} (${p.manufacturer}): ${p.sideEffects.join(', ')}.`,
      });
    }

    // Chunk D: Precautions — "What should I be careful about with X?"
    if (p.precautions && p.precautions.length > 0) {
      chunks.push({
        ...base,
        source_type: 'medicine_precautions',
        source_name: `${p.name} — Precautions`,
        content: `Precautions for ${p.name}: ${p.precautions.join(' ')}`,
      });
    }
  }

  return chunks;
}

/**
 * Blog article chunking strategy:
 *
 * We strip HTML tags from the article content, split into paragraphs,
 * and group into chunks of ~400-600 characters while preserving paragraph
 * boundaries. Each chunk retains the article title and category as context.
 */
function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function chunkArticles(articles) {
  const chunks = [];
  const TARGET_CHUNK_SIZE = 500; // characters per chunk

  for (const article of articles) {
    const plainText = stripHtml(article.content || '');
    const paragraphs = plainText.split(/\n+/).map(p => p.trim()).filter(Boolean);

    const articleBase = {
      source_type: 'blog_article',
      source_id:   article.id,
      source_name: `HealthMeds Blog: ${article.title}`,
      category:    article.category,
      metadata: {
        article_id:    article.id,
        article_title: article.title,
        author:        article.author ? article.author.name : null,
        tags:          article.tags || [],
      },
    };

    // Group paragraphs into chunks that are around TARGET_CHUNK_SIZE chars
    let currentChunk = `Article: "${article.title}" (${article.category})\n\n`;
    let chunkIndex = 0;

    for (const para of paragraphs) {
      if ((currentChunk + para).length > TARGET_CHUNK_SIZE && currentChunk.length > 100) {
        // Save the current chunk and start a new one
        chunks.push({
          ...articleBase,
          source_name: `${articleBase.source_name} (Part ${chunkIndex + 1})`,
          content: currentChunk.trim(),
          metadata: { ...articleBase.metadata, chunk_index: chunkIndex },
        });
        chunkIndex++;
        // New chunk starts with article context so retrieval always has context
        currentChunk = `Article: "${article.title}" (continued)\n\n${para} `;
      } else {
        currentChunk += para + ' ';
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim().length > 50) {
      chunks.push({
        ...articleBase,
        source_name: chunkIndex === 0
          ? articleBase.source_name
          : `${articleBase.source_name} (Part ${chunkIndex + 1})`,
        content: currentChunk.trim(),
        metadata: { ...articleBase.metadata, chunk_index: chunkIndex },
      });
    }
  }

  return chunks;
}

// ─── Step 3: Generate embeddings ──────────────────────────────────────────────
/**
 * Why TaskType.RETRIEVAL_DOCUMENT?
 *
 * Gemini gemini-embedding-001 is trained with "task type" hints.
 * - RETRIEVAL_DOCUMENT: used when embedding documents being stored (knowledge base)
 * - RETRIEVAL_QUERY: used when embedding the user's search query (in retriever.js)
 *
 * Using the correct task type improves retrieval quality significantly.
 */
async function generateEmbedding(text, attempt = 0) {
  try {
    const result = await embeddingModel.embedContent({
      content: { parts: [{ text }], role: 'user' },
      taskType: TaskType.RETRIEVAL_DOCUMENT,
    });
    return result.embedding.values; // Array of 3072 floats
  } catch (err) {
    // Handle 429 rate limit with retry + backoff
    if (err.status === 429 && attempt < MAX_RETRIES) {
      // Parse retryDelay from the API error details (e.g. "31s" → 31000ms)
      let waitMs = 35000; // default 35s wait if we can't parse the header
      try {
        const retryInfo = err.errorDetails?.find(d => d['@type']?.includes('RetryInfo'));
        if (retryInfo?.retryDelay) {
          const secs = parseInt(retryInfo.retryDelay.replace('s', ''), 10);
          if (!isNaN(secs)) waitMs = (secs + 2) * 1000; // add 2s buffer
        }
      } catch (_) {}
      log.warn(`Rate limited. Waiting ${Math.round(waitMs / 1000)}s before retry ${attempt + 1}/${MAX_RETRIES}…`);
      await sleep(waitMs);
      return generateEmbedding(text, attempt + 1);
    }
    throw err; // non-429 errors or out of retries — bubble up
  }
}

// Process chunks one at a time (sequential) to stay under the 100 req/min free tier limit.
// 700ms between requests ≈ 85 requests/min — safely under the limit.
async function generateEmbeddingsInBatches(chunks) {
  if (!embeddingModel) {
    log.warn('No Gemini embedding model configured. Ingesting chunks for text search without vector embeddings.');
    return chunks.map(chunk => ({ ...chunk, embedding: null }));
  }

  const results = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    log.dim(`Embedding chunk ${i + 1} / ${chunks.length}: ${chunk.source_name}`);

    const embedding = await generateEmbedding(chunk.content);
    results.push({ ...chunk, embedding });

    // Throttle: wait between requests to stay under 100 req/min
    if (i < chunks.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return results;
}

// ─── Step 4: Store in PostgreSQL ──────────────────────────────────────────────
async function storeChunks(client, chunks, sourceLabel) {
  log.info(`Storing ${chunks.length} ${sourceLabel} chunks…`);

  for (const chunk of chunks) {
    const vectorLiteral = Array.isArray(chunk.embedding) ? `[${chunk.embedding.join(',')}]` : null;

    await client.query(
      `INSERT INTO knowledge_chunks
         (content, source_type, source_id, source_name, category, metadata, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7::vector)`,
      [
        chunk.content,
        chunk.source_type,
        chunk.source_id,
        chunk.source_name,
        chunk.category,
        JSON.stringify(chunk.metadata),
        vectorLiteral,
      ]
    );
  }

  log.success(`Stored ${chunks.length} ${sourceLabel} chunks.`);
}

// ─── Main Ingestion Runner ────────────────────────────────────────────────────
async function runIngestion() {
  log.title('🏥 HealthMeds RAG — Knowledge Ingestion Pipeline');

  const client = await pool.connect();

  try {
    // ── A. Chunk all sources ────────────────────────────────────────────────
    log.info(`Loaded ${products.length} products and ${articles.length} blog articles.`);

    log.info('Chunking medicine information…');
    const medicineChunks = chunkProducts(products);
    log.success(`Created ${medicineChunks.length} medicine chunks.`);

    log.info('Chunking blog articles…');
    const blogChunks = chunkArticles(articles);
    log.success(`Created ${blogChunks.length} blog chunks.`);

    const allChunks = [...medicineChunks, ...blogChunks];
    log.info(`Total chunks to embed: ${allChunks.length}`);

    // ── B. Generate embeddings ──────────────────────────────────────────────
    log.info('\nGenerating embeddings (this may take a minute)…');
    const chunksWithEmbeddings = await generateEmbeddingsInBatches(allChunks);
    log.success(`Generated ${chunksWithEmbeddings.length} embeddings.`);

    // ── C. Clear old chunks and store new ones ──────────────────────────────
    await client.query('BEGIN');

    // Clear existing knowledge (safe to re-run ingestion anytime)
    log.info('Clearing existing knowledge chunks…');
    const deleted = await client.query('DELETE FROM knowledge_chunks');
    log.dim(`Removed ${deleted.rowCount} old chunks.`);

    // Store medicine chunks
    const medChunksWithEmb = chunksWithEmbeddings.filter(c => c.source_type.startsWith('medicine_'));
    const blogChunksWithEmb = chunksWithEmbeddings.filter(c => c.source_type === 'blog_article');

    await storeChunks(client, medChunksWithEmb, 'medicine');
    await storeChunks(client, blogChunksWithEmb, 'blog article');

    await client.query('COMMIT');

    // ── D. Summary ──────────────────────────────────────────────────────────
    console.log('');
    log.success('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log.success(`Ingestion complete!`);
    log.success(`  ${medChunksWithEmb.length} medicine knowledge chunks`);
    log.success(`  ${blogChunksWithEmb.length} blog article chunks`);
    log.success(`  ${chunksWithEmbeddings.length} total chunks in knowledge base`);
    log.success('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

  } catch (err) {
    await client.query('ROLLBACK');
    log.error('Ingestion failed: ' + err.message);
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runIngestion();
