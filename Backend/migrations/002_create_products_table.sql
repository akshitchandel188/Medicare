-- Migration 002: Create products table
CREATE TABLE IF NOT EXISTS products (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255)      NOT NULL,
  category        VARCHAR(100)      NOT NULL,
  subcategory     VARCHAR(100),
  price           NUMERIC(10, 2)    NOT NULL,
  original_price  NUMERIC(10, 2),
  discount        INTEGER,
  description     TEXT,
  image           TEXT,
  manufacturer    VARCHAR(255),
  stock           INTEGER           DEFAULT 0,
  units_available INTEGER           DEFAULT 0,
  rx_required     BOOLEAN           DEFAULT FALSE,
  dosage          TEXT,
  side_effects    TEXT[],
  precautions     TEXT[],
  status          VARCHAR(50)       DEFAULT 'In Stock',
  is_active       BOOLEAN           DEFAULT TRUE,
  created_at      TIMESTAMP         DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP         DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active    ON products(is_active);
