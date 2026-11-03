/**
 * migrate.js — Database Migration Runner
 *
 * How it works:
 *   1. Connects to Postgres using .env credentials.
 *   2. Creates a `_migrations` tracking table if it doesn't exist.
 *   3. Reads every *.sql file from the `migrations/` folder (in sorted order).
 *   4. Skips migrations that have already been applied.
 *   5. Runs pending migrations inside individual transactions (safe rollback on error).
 *   6. Records each successful migration in `_migrations`.
 *
 * Usage:
 *   npm run migrate
 */

// const { Pool } = require('pg');
const pool = require('./db');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ─── Colours for console output ────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  grey:   '\x1b[90m',
};

const log = {
  info:    (msg) => console.log(`${c.cyan}ℹ${c.reset}  ${msg}`),
  success: (msg) => console.log(`${c.green}✔${c.reset}  ${msg}`),
  skip:    (msg) => console.log(`${c.grey}–${c.reset}  ${msg}`),
  error:   (msg) => console.error(`${c.red}✘${c.reset}  ${msg}`),
  title:   (msg) => console.log(`\n${c.bold}${c.cyan}${msg}${c.reset}\n`),
};

// ─── Main ───────────────────────────────────────────────────────────────────────
async function runMigrations() {
  log.title('🏥  Medicine Delivery App — Database Migrations');

  // Validate required env vars
  if (!process.env.DATABASE_URL) {
    const required = ['DB_USER', 'DB_HOST', 'DB_DATABASE', 'DB_PASSWORD', 'DB_PORT'];
    const missing  = required.filter((k) => !process.env[k]);
    if (missing.length) {
      log.error(`Missing environment variables: ${missing.join(', ')}`);
      log.error('Set DATABASE_URL or discrete DB_* variables in .env');
      process.exit(1);
    }
  }

  // const pool = new Pool({
  //   user:     process.env.DB_USER,
  //   host:     process.env.DB_HOST,
  //   database: process.env.DB_DATABASE,
  //   password: process.env.DB_PASSWORD,
  //   port:     Number(process.env.DB_PORT),
  // });

  const client = await pool.connect();

  try {
    // ── Step 1: Create the tracking table ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id          SERIAL PRIMARY KEY,
        filename    VARCHAR(255) UNIQUE NOT NULL,
        applied_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    log.info('Migration tracking table ready (_migrations).');

    // ── Step 2: Find already-applied migrations ─────────────────────────────────
    const { rows: applied } = await client.query('SELECT filename FROM _migrations ORDER BY filename');
    const appliedSet = new Set(applied.map((r) => r.filename));

    // ── Step 3: Read migration files ────────────────────────────────────────────
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort(); // ensures numeric order: 001, 002, 003 …

    if (files.length === 0) {
      log.info('No migration files found in ./migrations/');
      return;
    }

    log.info(`Found ${files.length} migration file(s). Checking status…\n`);

    let appliedCount = 0;
    let skippedCount = 0;

    // ── Step 4: Apply pending migrations ───────────────────────────────────────
    for (const file of files) {
      if (appliedSet.has(file)) {
        log.skip(`Already applied: ${file}`);
        skippedCount++;
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql      = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');

        log.success(`Applied: ${file}`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        log.error(`Failed on: ${file}`);
        log.error(err.message);
        throw err; // stop the runner — don't apply subsequent migrations
      }
    }

    // ── Step 5: Summary ────────────────────────────────────────────────────────
    console.log('');
    if (appliedCount === 0) {
      log.info('Database is already up to date. Nothing to migrate.');
    } else {
      log.success(`${appliedCount} migration(s) applied successfully.`);
    }
    if (skippedCount > 0) {
      log.info(`${skippedCount} migration(s) were already applied and skipped.`);
    }
    console.log('');

  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  log.error('Migration runner crashed: ' + err.message);
  process.exit(1);
});
