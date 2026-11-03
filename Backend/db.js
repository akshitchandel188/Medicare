const { Pool } = require('pg');
require('dotenv').config();

// Prevent Node.js from timing out on dual-stack IPv4/IPv6 connections to cloud databases (like Neon)
if (typeof require('node:net').setDefaultAutoSelectFamily === 'function') {
  require('node:net').setDefaultAutoSelectFamily(false);
}

let pool;

if (process.env.DATABASE_URL) {
  const isSslNeeded = process.env.DATABASE_URL.includes('neon.tech') ||
                      process.env.DATABASE_URL.includes('sslmode=require') ||
                      process.env.NODE_ENV === 'production';

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isSslNeeded ? { rejectUnauthorized: false } : false,
  });
} else {
  pool = new Pool({
    user:     process.env.DB_USER,
    host:     process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port:     process.env.DB_PORT,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  });
}

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]:', err.message);
});

module.exports = pool;
