-- ============================================================
-- Zabiha Halal — AI Menu Analyzer
-- Migration: adds restaurants, menu_analyses, menu_analysis_items,
-- and analysis_requests tables.
--
-- NOTE: `database/schema.sql` (the current full schema) has no
-- `restaurants` table, so this migration CREATEs it fresh rather
-- than ALTERing an existing one. All statements are idempotent
-- (safe to re-run against a database that already has them).
--
-- NOTE: the analyzed-item table is named `menu_analysis_items`
-- rather than `menu_items` to avoid colliding with the existing
-- `menu_items` table (the restaurant's own ordering menu, keyed
-- by category_id) defined in schema.sql.
--
-- Run against the target database. Note the `USE zabiha_halal_db;` below
-- always wins over the database named on the command line (same behavior
-- as database/seed.sql), so to apply this to the test database, strip
-- that line first:
--   mysql -u <user> -p zabiha_halal_db < backend/sql/menu_analyzer.sql
--   grep -v -i '^USE ' backend/sql/menu_analyzer.sql | mysql -u <user> -p zabiha_halal_db_test
-- ============================================================

USE zabiha_halal_db;

-- ------------------------------------------------------------
-- restaurants
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurants (
  restaurant_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(150) NOT NULL,
  address         VARCHAR(255) NULL,
  cuisine_type    VARCHAR(80)  NULL,
  source          ENUM('user_submitted', 'web_search', 'seed') NOT NULL DEFAULT 'user_submitted',
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_restaurants_name (name)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- menu_analyses
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_analyses (
  analysis_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  restaurant_id   INT UNSIGNED NULL,
  status          ENUM('completed', 'failed') NOT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_analyses_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(restaurant_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  KEY idx_menu_analyses_restaurant (restaurant_id),
  KEY idx_menu_analyses_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- menu_analysis_items (AI-classified line items for one analysis)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_analysis_items (
  analysis_item_id  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  analysis_id       INT UNSIGNED NOT NULL,
  item_name         VARCHAR(150) NOT NULL,
  classification    ENUM('vegetarian_safe', 'safe_with_modification', 'doubtful', 'not_suitable') NOT NULL,
  reasoning         TEXT NULL,
  confidence        ENUM('high', 'medium', 'low') NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_analysis_items_analysis
    FOREIGN KEY (analysis_id) REFERENCES menu_analyses(analysis_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  KEY idx_menu_analysis_items_analysis (analysis_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- analysis_requests (audit log of every call to the endpoint)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_requests (
  request_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint        VARCHAR(150) NOT NULL,
  restaurant_id   INT UNSIGNED NULL,
  response_code   INT UNSIGNED NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_analysis_requests_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(restaurant_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  KEY idx_analysis_requests_restaurant (restaurant_id),
  KEY idx_analysis_requests_created_at (created_at)
) ENGINE=InnoDB;
