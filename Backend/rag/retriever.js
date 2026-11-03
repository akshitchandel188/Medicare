/**
 * rag/retriever.js — Semantic & Text Retrieval Module
 * =====================================================
 *
 * This is the core of the RAG pipeline's "R" (Retrieval) step.
 *
 * How it works:
 *   1. Takes the user's natural-language query
 *   2. If vector embedding service is configured (GEMINI_API_KEY):
 *      - Generates an embedding for the query
 *      - Runs pgvector cosine similarity search against knowledge_chunks
 *   3. If vector embedding service is not configured (or fails):
 *      - Gracefully falls back to full-text and keyword search in knowledge_chunks
 *   4. Returns top-K matching chunks with their metadata
 */

'use strict';

require('dotenv').config();
const pool = require('../db');

// ─── Configuration ────────────────────────────────────────────────────────────
const DEFAULT_TOP_K  = 4;
const MIN_SIMILARITY = 0.35;

// Optional Gemini embedding client
let embeddingModel = null;
if (process.env.GEMINI_API_KEY) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  } catch (err) {
    console.warn('[Retriever] Could not initialize Gemini embedding client:', err.message);
  }
}

// ─── Vector Query Embedding ───────────────────────────────────────────────────
async function embedQuery(queryText) {
  if (!embeddingModel) return null;
  const { TaskType } = require('@google/generative-ai');
  const result = await embeddingModel.embedContent({
    content: { parts: [{ text: queryText }], role: 'user' },
    taskType: TaskType.RETRIEVAL_QUERY,
  });
  return result.embedding.values;
}

// ─── Vector Similarity Search (pgvector) ──────────────────────────────────────
async function retrieveByVector(queryText, { topK = DEFAULT_TOP_K, sourceType = null } = {}) {
  const queryEmbedding = await embedQuery(queryText);
  if (!queryEmbedding) return [];

  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  let query = `
    SELECT
      id,
      content,
      source_type,
      source_id,
      source_name,
      category,
      metadata,
      1 - (embedding <=> $1::vector) AS similarity
    FROM knowledge_chunks
    WHERE embedding IS NOT NULL AND (1 - (embedding <=> $1::vector)) > $2
  `;

  const params = [vectorLiteral, MIN_SIMILARITY];

  if (sourceType) {
    params.push(sourceType);
    query += ` AND source_type = $${params.length}`;
  }

  query += ` ORDER BY embedding <=> $1::vector ASC LIMIT $${params.length + 1}`;
  params.push(topK);

  const result = await pool.query(query, params);

  return result.rows.map((row) => ({
    id:          row.id,
    content:     row.content,
    source_type: row.source_type,
    source_id:   row.source_id,
    source_name: row.source_name,
    category:    row.category,
    metadata:    row.metadata,
    similarity:  parseFloat(row.similarity.toFixed(4)),
  }));
}

// ─── Text / Keyword Search Fallback ───────────────────────────────────────────
async function retrieveByText(queryText, { topK = DEFAULT_TOP_K, sourceType = null } = {}) {
  const stopWords = new Set([
    'what', 'when', 'where', 'which', 'who', 'whom', 'this', 'that', 'with', 'from',
    'have', 'does', 'about', 'some', 'tell', 'show', 'give', 'please', 'help', 'want',
    'need', 'find', 'more', 'much', 'many', 'good', 'take', 'used', 'side', 'effects'
  ]);

  const rawKeywords = queryText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 3);

  // Separate non-stopwords and fallback to all words if none remain
  let keywords = rawKeywords.filter(w => !stopWords.has(w));
  if (keywords.length === 0) {
    keywords = rawKeywords;
  }
  if (keywords.length === 0) return [];

  const conditions = [];
  const params = [];

  keywords.slice(0, 5).forEach((kw) => {
    params.push(`%${kw}%`);
    const idx = params.length;
    conditions.push(`(source_name ILIKE $${idx} OR content ILIKE $${idx} OR category ILIKE $${idx})`);
  });

  let query = `
    SELECT
      id,
      content,
      source_type,
      source_id,
      source_name,
      category,
      metadata,
      0.85 AS similarity
    FROM knowledge_chunks
    WHERE (${conditions.join(' OR ')})
  `;

  if (sourceType) {
    params.push(sourceType);
    query += ` AND source_type = $${params.length}`;
  }

  params.push(topK);
  query += ` LIMIT $${params.length}`;

  const result = await pool.query(query, params);

  return result.rows.map((row) => ({
    id:          row.id,
    content:     row.content,
    source_type: row.source_type,
    source_id:   row.source_id,
    source_name: row.source_name,
    category:    row.category,
    metadata:    row.metadata,
    similarity:  0.85,
  }));
}

// ─── Main Retrieve Function ───────────────────────────────────────────────────
async function retrieve(queryText, options = {}) {
  if (embeddingModel) {
    try {
      const vectorResults = await retrieveByVector(queryText, options);
      if (vectorResults.length > 0) return vectorResults;
    } catch (err) {
      console.warn('[RAG Retriever] Vector retrieval error, falling back to text:', err.message);
    }
  }

  try {
    return await retrieveByText(queryText, options);
  } catch (err) {
    console.error('[RAG Retriever] Retrieval failed:', err.message);
    return [];
  }
}

module.exports = { retrieve };
