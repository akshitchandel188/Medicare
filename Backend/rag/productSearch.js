/**
 * rag/productSearch.js — Live Product Search (Deterministic SQL)
 * ==============================================================
 *
 * IMPORTANT DESIGN DECISION:
 *   This module uses direct PostgreSQL queries — NOT embeddings/RAG.
 *
 * Why? Because product availability, price, and stock are DYNAMIC data.
 * Embeddings are generated at ingestion time and become stale immediately
 * when prices change, stock is updated, or new products are added.
 *
 * The RAG knowledge base stores medicine INFORMATION (descriptions, dosages,
 * side effects, precautions) — things that rarely change.
 *
 * Live product data (price, status, units_available) ALWAYS comes from
 * the PostgreSQL products table via direct SQL query. This is correct RAG
 * architecture: use retrieval for knowledge, use SQL for live data.
 *
 * Query Strategy:
 *   1. Extract product name hints from the user's message (e.g., "paracetamol")
 *   2. Extract category hints (e.g., "headache" → Pain Relief)
 *   3. Extract price constraint (e.g., "under ₹100")
 *   4. Run SQL with ILIKE for fuzzy name/category matching
 *   5. Return matching active products
 */

'use strict';

const pool = require('../db');

// ─── Configuration ────────────────────────────────────────────────────────────
const MAX_PRODUCTS_IN_RESPONSE = 5;

// ─── Keyword → Category mapping ───────────────────────────────────────────────
// Maps common symptom/condition keywords to product categories/subcategories
// This allows natural queries like "medicine for headache" to find Pain Relief products
const SYMPTOM_TO_CATEGORY = {
  // Pain / Fever
  headache:    'Pain Relief',
  fever:       'Pain Relief',
  pain:        'Pain Relief',
  painkiller:  'Pain Relief',
  inflammation:'Pain Relief',

  // Cold / Cough / Allergy
  cold:       'Cold & Flu',
  cough:      'Cold & Flu',
  flu:        'Cold & Flu',
  allergy:    'Allergy Relief',
  allergic:   'Allergy Relief',
  runny:      'Allergy Relief',
  sneeze:     'Allergy Relief',
  itching:    'Allergy Relief',

  // Stomach
  stomach:    'Stomach Care',
  digestion:  'Stomach Care',
  constipation:'Stomach Care',
  acidity:    'Stomach Care',
  nausea:     'Stomach Care',
  diarrhea:   'Stomach Care',

  // Diabetes
  diabetes:   'Diabetes Care',
  sugar:      'Diabetes Care',
  insulin:    'Diabetes Care',

  // Heart
  heart:      'Heart Care',
  'blood pressure': 'Heart Care',
  cholesterol:'Heart Care',

  // Supplements / Vitamins
  vitamin:    'Nutritional Drinks & Supplements',
  calcium:    'Nutritional Drinks & Supplements',
  supplement: 'Nutritional Drinks & Supplements',
  bone:       'Bone & Joint',
  joint:      'Bone & Joint',

  // Skin
  skin:       'Skin Care',
  cream:      'Skin Care',
  lotion:     'Skin Care',

  // First Aid
  wound:      'First Aid',
  burn:       'First Aid',
  cut:        'First Aid',
  bandage:    'First Aid',

  // Eye / Ear
  eye:        'Eye & Ear Care',
  ear:        'Eye & Ear Care',

  // Women's Health
  period:     "Women's Health",
  menstrual:  "Women's Health",
};

// ─── Price extraction ─────────────────────────────────────────────────────────
/**
 * Extracts a price ceiling from the user's message.
 * Handles: "under ₹100", "below 50", "less than 200", "under rs 75", etc.
 */
function extractPriceConstraint(message) {
  const patterns = [
    /(?:under|below|less\s+than|cheaper\s+than|within)\s*(?:rs\.?|₹|inr)?\s*(\d+)/i,
    /(?:rs\.?|₹|inr)\s*(\d+)\s*(?:or\s+less|max|maximum)/i,
    /budget\s+(?:of\s+)?(?:rs\.?|₹|inr)?\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

// ─── Intent detection — is this a product search query? ─────────────────────
/**
 * Returns true if the user's message looks like a product discovery/search query.
 * This lets the chat route decide whether to run the product search.
 */
function isProductSearchQuery(message) {
  const lower = message.toLowerCase();

  // Direct product-finding intent
  const productIntentKeywords = [
    'do you have', 'do you sell', 'is there', 'find me', 'looking for',
    'need a medicine', 'medicine for', 'tablet for', 'syrup for',
    'in stock', 'available', 'show me', 'what medicines', 'which medicines',
    'recommend', 'suggest', 'any medicine', 'any product',
  ];

  if (productIntentKeywords.some(kw => lower.includes(kw))) return true;

  // Price-based queries almost always mean product search
  if (extractPriceConstraint(message)) return true;

  // Symptom keywords that imply "find a product for this symptom"
  const symptomPhrases = ['i have', 'suffering from', 'treatment for', 'help with'];
  if (symptomPhrases.some(kw => lower.includes(kw))) return true;

  return false;
}

// ─── Main product search function ─────────────────────────────────────────────
/**
 * Searches the live products table for relevant products.
 *
 * @param {string} message - The user's raw message
 * @returns {Array} Matching product rows from PostgreSQL (live data)
 */
async function searchLiveProducts(message) {
  const lower = message.toLowerCase();
  const params = [];
  const conditions = ['is_active = TRUE'];

  // ── Price filter ────────────────────────────────────────────────────────────
  const maxPrice = extractPriceConstraint(message);
  if (maxPrice) {
    params.push(maxPrice);
    conditions.push(`price <= $${params.length}`);
  }

  // ── Build OR conditions for name and category matching ─────────────────────
  const nameOrCategoryConditions = [];

  // Check if any category keywords appear in the message
  for (const [keyword, category] of Object.entries(SYMPTOM_TO_CATEGORY)) {
    if (lower.includes(keyword)) {
      params.push(`%${category}%`);
      nameOrCategoryConditions.push(
        `(category ILIKE $${params.length} OR subcategory ILIKE $${params.length})`
      );
    }
  }

  // Also search by product name (extract meaningful words, skip stopwords)
  const stopwords = new Set([
    'a', 'an', 'the', 'is', 'are', 'do', 'you', 'have', 'i', 'me',
    'for', 'and', 'or', 'of', 'in', 'to', 'with', 'any', 'some',
    'medicine', 'tablet', 'syrup', 'drug', 'need', 'looking', 'want',
    'please', 'can', 'available', 'stock',
  ]);

  // Extract words that might be product names (>3 chars, not stopwords)
  const words = lower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w));

  for (const word of words) {
    params.push(`%${word}%`);
    const idx = params.length;
    nameOrCategoryConditions.push(`(name ILIKE $${idx} OR manufacturer ILIKE $${idx})`);
  }

  // Combine: require at least one of the name/category conditions to match
  if (nameOrCategoryConditions.length > 0) {
    conditions.push(`(${nameOrCategoryConditions.join(' OR ')})`);
  }

  // ── Build and run the query ─────────────────────────────────────────────────
  const whereClause = conditions.join(' AND ');

  const query = `
    SELECT
      id, name, manufacturer, price, original_price,
      discount, category, subcategory, status, units_available,
      rx_required, image, description
    FROM products
    WHERE ${whereClause}
    ORDER BY
      CASE WHEN status = 'In Stock' THEN 0 ELSE 1 END,
      price ASC
    LIMIT $${params.length + 1}
  `;

  params.push(MAX_PRODUCTS_IN_RESPONSE);

  const result = await pool.query(query, params);
  return result.rows;
}

module.exports = { searchLiveProducts, isProductSearchQuery };
