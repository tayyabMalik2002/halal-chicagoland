-- ============================================================
-- Zabiha Halal — AI Menu Analyzer
-- Migration: adds restaurants, menu_analyses, menu_analysis_items,
-- and analysis_requests tables.
--
-- NOTE: `database/schema.sql` now creates these same tables
-- directly, so this file is only needed if you're migrating an
-- older database that predates that merge. All statements are
-- idempotent (safe to re-run against a database that already has
-- them) via CREATE TABLE IF NOT EXISTS.
--
-- Run against the target database:
--   psql "$DATABASE_URL" -f backend/sql/menu_analyzer.sql
-- ============================================================

-- ------------------------------------------------------------
-- restaurants
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurants (
  restaurant_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            VARCHAR(150) NOT NULL,
  address         VARCHAR(255) NULL,
  cuisine_type    VARCHAR(80)  NULL,
  source          VARCHAR(20) NOT NULL DEFAULT 'user_submitted'
                  CHECK (source IN ('user_submitted', 'web_search', 'seed')),
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurants_name ON restaurants(name);

-- ------------------------------------------------------------
-- menu_analyses
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_analyses (
  analysis_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restaurant_id   INTEGER NULL,
  status          VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'failed')),
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_analyses_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(restaurant_id)
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_menu_analyses_restaurant ON menu_analyses(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_analyses_status ON menu_analyses(status);

-- ------------------------------------------------------------
-- menu_analysis_items (AI-classified line items for one analysis)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_analysis_items (
  analysis_item_id  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  analysis_id       INTEGER NOT NULL,
  item_name         VARCHAR(150) NOT NULL,
  classification    VARCHAR(30) NOT NULL
                    CHECK (classification IN ('vegetarian_safe', 'safe_with_modification', 'doubtful', 'not_suitable')),
  reasoning         TEXT NULL,
  confidence        VARCHAR(10) NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_analysis_items_analysis
    FOREIGN KEY (analysis_id) REFERENCES menu_analyses(analysis_id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_menu_analysis_items_analysis ON menu_analysis_items(analysis_id);

-- ------------------------------------------------------------
-- analysis_requests (audit log of every call to the endpoint)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_requests (
  request_id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  endpoint        VARCHAR(150) NOT NULL,
  restaurant_id   INTEGER NULL,
  response_code   INTEGER NOT NULL CHECK (response_code >= 0),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_analysis_requests_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(restaurant_id)
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analysis_requests_restaurant ON analysis_requests(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_analysis_requests_created_at ON analysis_requests(created_at);
