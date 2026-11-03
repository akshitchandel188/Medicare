/**
 * seed.js — Seed Products into PostgreSQL (Neon)
 * ===============================================
 */

'use strict';

require('dotenv').config();
const pool = require('./db');
const { products } = require('./rag/knowledgeData');

async function seed() {
  console.log('Seeding products into Neon database...');
  const client = await pool.connect();

  try {
    const { rows } = await client.query('SELECT COUNT(*) as count FROM products');
    const existingCount = parseInt(rows[0].count, 10);

    if (existingCount > 0) {
      console.log(`Products table already contains ${existingCount} items. Skipping.`);
      return;
    }

    await client.query('BEGIN');

    for (const p of products) {
      await client.query(
        `INSERT INTO products (
          id, name, category, subcategory, price, original_price, discount,
          description, image, manufacturer, stock, units_available,
          rx_required, dosage, side_effects, precautions, status, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          price = EXCLUDED.price,
          units_available = EXCLUDED.units_available`,
        [
          p.id,
          p.name,
          p.category,
          p.subcategory || null,
          p.price,
          p.originalPrice || null,
          p.discount || 0,
          p.description || null,
          p.image || null,
          p.manufacturer || null,
          p.unitsAvailable || 50,
          p.unitsAvailable || 50,
          Boolean(p.rxRequired),
          p.dosage || null,
          p.sideEffects || [],
          p.precautions || [],
          p.status || 'In Stock',
          true,
        ]
      );
    }

    // Reset sequence so future inserts don't collide with manual IDs
    await client.query(`SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE(MAX(id), 1)) FROM products`);

    await client.query('COMMIT');
    console.log(`✔ Successfully seeded ${products.length} products into Neon!`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✘ Seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
