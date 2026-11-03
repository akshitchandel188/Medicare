/**
 * routes/chat.js — RAG-Powered Chat Route (Groq AI)
 * ===================================================
 *
 * New Request Flow:
 *   POST /api/chat
 *   Body: { message: string, conversationHistory: Array }
 *
 *   1. Validate inputs
 *   2. In PARALLEL:
 *      A. RAG retrieval — semantic/keyword search in knowledge_chunks via PostgreSQL
 *      B. Live product search — direct SQL on products table (if it looks like a product query)
 *   3. Build a grounded system prompt with retrieved context and live products
 *   4. Send to Groq with conversation history (multi-turn support)
 *   5. Return { reply, sources, products }
 *
 * Response Shape:
 *   {
 *     reply:    string,              // Groq's grounded answer
 *     sources:  Array<{ name, type }>,  // Citations from knowledge base
 *     products: Array<ProductRow>    // Live products from PostgreSQL (may be empty)
 *   }
 */

'use strict';

const express = require('express');
const router  = express.Router();
const Groq    = require('groq-sdk');

const { retrieve }                                 = require('../rag/retriever');
const { searchLiveProducts, isProductSearchQuery } = require('../rag/productSearch');

// ─── Groq Setup ───────────────────────────────────────────────────────────────
const apiKey = process.env.GROQ_API_KEY;
const groq = apiKey ? new Groq({ apiKey }) : null;

// Preferred model from environment or high-quality default
const PRIMARY_MODEL  = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const FALLBACK_MODEL = 'qwen/qwen3.8-27b';

// ─── Configuration ────────────────────────────────────────────────────────────
// How many knowledge chunks to retrieve per query
const TOP_K = 4;

// Maximum conversation turns to include in context (each turn = 1 user + 1 bot message)
// Keeping this low prevents the prompt from growing too large
const MAX_HISTORY_TURNS = 3;

// ─── Prompt Builder ───────────────────────────────────────────────────────────
/**
 * Builds the grounded system prompt for Groq.
 *
 * Key design decisions:
 * - Retrieved chunks are labeled clearly so Groq knows they come from HealthMeds KB
 * - Live products are clearly separated from KB content
 * - Rules explicitly prevent hallucination of product details
 * - Medical safety rules are non-negotiable constraints
 */
function buildSystemPrompt(retrievedChunks, liveProducts) {
  let prompt = `You are the HealthMeds AI Medicine Assistant — a knowledgeable, friendly, and responsible pharmacist assistant for HealthMeds, an online pharmacy in India.

Your role is to help users find medicines, understand health information, and navigate the HealthMeds catalog.
`;

  // ── Section 1: Retrieved Knowledge Base Context ───────────────────────────
  if (retrievedChunks.length > 0) {
    prompt += `
=== HEALTHMEDS KNOWLEDGE BASE ===
The following information was retrieved from the HealthMeds knowledge base. Prefer this over your general knowledge when answering about these medicines or health topics.

`;
    retrievedChunks.forEach((chunk, index) => {
      prompt += `[Source ${index + 1}: ${chunk.source_name}]\n${chunk.content}\n\n`;
    });
  } else {
    prompt += `
=== HEALTHMEDS KNOWLEDGE BASE ===
No specific knowledge base results were found for this query.

`;
  }

  // ── Section 2: Live Product Data ─────────────────────────────────────────
  if (liveProducts.length > 0) {
    prompt += `=== LIVE HEALTHMEDS INVENTORY (Current Data from Database) ===
The following products are currently available on HealthMeds. Use ONLY these products when discussing availability, price, or stock.

`;
    liveProducts.forEach((p, index) => {
      const rxNote = p.rx_required ? ' (Prescription Required)' : '';
      const stockNote = p.units_available > 0
        ? `${p.status} (${p.units_available} units)`
        : p.status;
      prompt += `[Product ${index + 1}] ${p.name} by ${p.manufacturer}${rxNote}
  Price: ₹${p.price}${p.original_price ? ` (Original: ₹${p.original_price}, Save ${p.discount}%)` : ''}
  Availability: ${stockNote}
  Category: ${p.category}${p.subcategory ? ' > ' + p.subcategory : ''}
\n`;
    });
  }

  // ── Section 3: Rules ──────────────────────────────────────────────────────
  prompt += `
=== RULES (FOLLOW STRICTLY) ===
1. GROUNDING: Base your answers on the HealthMeds Knowledge Base and Live Inventory above. Do not invent product names, prices, or stock information not listed above.
2. MISSING PRODUCTS: If a product was NOT found in the live inventory, say so clearly. Do NOT claim HealthMeds stocks something that wasn't returned.
3. MISSING KNOWLEDGE: If the knowledge base doesn't have enough information, acknowledge this honestly and offer general guidance while recommending the user consult a doctor.
4. CITATIONS: When using knowledge base information, naturally reference it (e.g., "According to HealthMeds information on Paracetamol...").
5. MEDICAL SAFETY: You are NOT a doctor. Do NOT diagnose diseases, prescribe medications, or recommend specific dosages beyond what is in the knowledge base. Always recommend consulting a qualified healthcare professional for medical decisions.
6. SYMPTOMS: For symptom-related questions, provide informational responses only. Always include a reminder to consult a doctor.
7. PRICES & STOCK: Price and stock information from the Live Inventory section is current and authoritative. Do not use other prices.
8. TONE: Be helpful, clear, and friendly. Avoid overly clinical or robotic language.
9. FORMAT: Keep responses concise and readable. Use bullet points for lists (side effects, precautions). Avoid very long responses.
`;

  return prompt;
}

// ─── Symptom safety reminder ──────────────────────────────────────────────────
function containsSymptoms(message) {
  const lower = message.toLowerCase();
  const symptomIndicators = ['i have', 'i am feeling', 'i feel', 'suffering from', 'my symptoms', 'i got', 'been having'];
  return symptomIndicators.some(phrase => lower.includes(phrase));
}

// ─── History Normalizer ───────────────────────────────────────────────────────
/**
 * Normalizes history from multiple formats:
 * - OpenAI/Groq: { role: 'user' | 'assistant', content: string }
 * - Gemini:      { role: 'user' | 'model', parts: [{ text: string }] }
 * - UI:          { sender: 'user' | 'bot', text: string }
 */
function normalizeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];

  return rawHistory.map(item => {
    let role = 'user';
    if (item.role === 'model' || item.role === 'assistant' || item.sender === 'bot') {
      role = 'assistant';
    }

    let content = '';
    if (typeof item.content === 'string') {
      content = item.content;
    } else if (Array.isArray(item.parts)) {
      content = item.parts.map(p => p.text || '').join('');
    } else if (typeof item.text === 'string') {
      content = item.text;
    }

    return { role, content: content.trim() };
  }).filter(entry => entry.content.length > 0);
}

// ─── Main Chat Route ──────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  if (!groq) {
    return res.status(503).json({
      error: 'AI Service is not configured. Please add GROQ_API_KEY to .env file.',
    });
  }

  const { message, conversationHistory, history } = req.body;
  // Accept both 'history' and 'conversationHistory' field names
  const rawHistory = conversationHistory || history || [];

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const cleanMessage = message.trim();

  try {
    // ── Step 1: Parallel retrieval ─────────────────────────────────────────
    // RAG retrieval and live product search run simultaneously for speed
    const [retrievedChunks, liveProducts] = await Promise.all([
      // Always run RAG retrieval for knowledge-based answers
      retrieve(cleanMessage, { topK: TOP_K }).catch(err => {
        console.error('[RAG] Retrieval error:', err.message);
        return []; // Degrade gracefully — still answer without KB context
      }),

      // Only run product search if the query looks like a product inquiry
      isProductSearchQuery(cleanMessage)
        ? searchLiveProducts(cleanMessage).catch(err => {
            console.error('[RAG] Product search error:', err.message);
            return [];
          })
        : Promise.resolve([]),
    ]);

    // ── Step 2: Build grounded prompt ────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(retrievedChunks, liveProducts);

    // ── Step 3: Prepare conversation history for multi-turn ──────────────────
    const normalized = normalizeHistory(rawHistory);
    const recentHistory = normalized.slice(-(MAX_HISTORY_TURNS * 2));

    // Append symptom safety reminder to the user message if needed
    let userMessageText = cleanMessage;
    if (containsSymptoms(cleanMessage)) {
      userMessageText += '\n\n(Please include a reminder that I should consult a doctor for personalized medical advice.)';
    }

    // ── Step 4: Assemble Groq messages ───────────────────────────────────────
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: userMessageText },
    ];

    // ── Step 5: Call Groq with model fallback ─────────────────────────────────
    let reply = '';
    try {
      const completion = await groq.chat.completions.create({
        model: PRIMARY_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 1024,
      });
      reply = completion.choices[0]?.message?.content || '';
    } catch (primaryErr) {
      console.warn(`[Groq] Primary model ${PRIMARY_MODEL} failed, retrying with ${FALLBACK_MODEL}:`, primaryErr.message);
      const fallbackCompletion = await groq.chat.completions.create({
        model: FALLBACK_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 1024,
      });
      reply = fallbackCompletion.choices[0]?.message?.content || '';
    }

    // ── Step 6: Build source citations ────────────────────────────────────────
    const seenSources = new Set();
    const sources = [];
    for (const chunk of retrievedChunks) {
      const citationName = chunk.source_name;
      if (!seenSources.has(citationName)) {
        seenSources.add(citationName);
        sources.push({
          name:        citationName,
          type:        chunk.source_type,
          category:    chunk.category,
          similarity:  chunk.similarity,
        });
      }
    }

    // ── Step 7: Return structured response ───────────────────────────────────
    res.json({
      reply,
      sources,
      products: liveProducts,
    });

  } catch (error) {
    console.error('[Chat Route] Error:', error);
    res.status(500).json({
      error: "Sorry, I'm having trouble right now. Please try again.",
      reply: "Sorry, I'm having trouble right now. Please try again.",
      sources: [],
      products: [],
    });
  }
});

module.exports = router;
