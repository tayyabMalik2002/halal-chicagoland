-- ============================================================
-- Zabiha Halal — Restaurant Management & Online Ordering
-- Database Schema (3NF)
-- Target: PostgreSQL 14+ (e.g. Azure Database for PostgreSQL)
--
-- Unlike MySQL, this does not CREATE/DROP the database itself —
-- create the target database first (e.g. `createdb zabiha_halal_db`
-- or via the Azure portal/CLI), then run this file against it:
--   psql "$DATABASE_URL" -f database/schema.sql
-- Safe to re-run: every table is dropped (CASCADE) before recreation.
-- ============================================================

DROP TABLE IF EXISTS analysis_requests CASCADE;
DROP TABLE IF EXISTS menu_analysis_items CASCADE;
DROP TABLE IF EXISTS menu_analyses CASCADE;
DROP TABLE IF EXISTS restaurants CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS menu_categories CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- Shared trigger: keeps updated_at current on every UPDATE, replacing
-- MySQL's "ON UPDATE CURRENT_TIMESTAMP" column clause (no equivalent
-- in Postgres).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- customers
-- ------------------------------------------------------------
CREATE TABLE customers (
  customer_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name      VARCHAR(50)  NOT NULL,
  last_name       VARCHAR(50)  NOT NULL,
  email           VARCHAR(120) NOT NULL,
  phone           VARCHAR(20)  NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_customers_email UNIQUE (email)
);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- menu_categories
-- ------------------------------------------------------------
CREATE TABLE menu_categories (
  category_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            VARCHAR(80)  NOT NULL,
  description     VARCHAR(255) NULL,
  display_order   INTEGER      NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_menu_categories_name UNIQUE (name)
);

-- ------------------------------------------------------------
-- menu_items
-- ------------------------------------------------------------
CREATE TABLE menu_items (
  item_id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id     INTEGER      NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT NULL,
  price           DECIMAL(8,2) NOT NULL,
  halal_notes     VARCHAR(255) NULL,
  is_available    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_items_category
    FOREIGN KEY (category_id) REFERENCES menu_categories(category_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_menu_items_price CHECK (price >= 0)
);

CREATE TRIGGER trg_menu_items_updated_at
  BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_available ON menu_items(is_available);

-- ------------------------------------------------------------
-- orders
-- ------------------------------------------------------------
CREATE TABLE orders (
  order_id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id         INTEGER NOT NULL,
  order_type          VARCHAR(20) NOT NULL DEFAULT 'pickup'
                      CHECK (order_type IN ('pickup','delivery','dine-in')),
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','preparing','ready','completed','cancelled')),
  total_amount        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  special_instructions VARCHAR(500) NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_orders_total CHECK (total_amount >= 0)
);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- ------------------------------------------------------------
-- order_items (line items; unit_price is a snapshot of the menu
-- item price at the time of order so historical orders remain
-- accurate even if the menu price later changes)
-- ------------------------------------------------------------
CREATE TABLE order_items (
  order_item_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id        INTEGER NOT NULL,
  item_id         INTEGER NOT NULL,
  quantity        INTEGER NOT NULL,
  unit_price      DECIMAL(8,2) NOT NULL,
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_items_menu_item
    FOREIGN KEY (item_id) REFERENCES menu_items(item_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_order_items_qty CHECK (quantity > 0),
  CONSTRAINT chk_order_items_price CHECK (unit_price >= 0)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_item ON order_items(item_id);

-- ------------------------------------------------------------
-- reservations
-- ------------------------------------------------------------
CREATE TABLE reservations (
  reservation_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id       INTEGER NOT NULL,
  reservation_date  DATE NOT NULL,
  reservation_time  TIME NOT NULL,
  party_size        SMALLINT NOT NULL CHECK (party_size > 0),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','cancelled','completed')),
  special_requests  VARCHAR(500) NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reservations_customer
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TRIGGER trg_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_reservations_customer ON reservations(customer_id);
CREATE INDEX idx_reservations_date ON reservations(reservation_date);

-- ------------------------------------------------------------
-- restaurants (AI Menu Analyzer — third-party restaurants a
-- customer photographs a menu at, not the Zabiha Halal venue)
-- ------------------------------------------------------------
CREATE TABLE restaurants (
  restaurant_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            VARCHAR(150) NOT NULL,
  address         VARCHAR(255) NULL,
  cuisine_type    VARCHAR(80)  NULL,
  source          VARCHAR(20) NOT NULL DEFAULT 'user_submitted'
                  CHECK (source IN ('user_submitted', 'web_search', 'seed')),
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_restaurants_name ON restaurants(name);

-- ------------------------------------------------------------
-- menu_analyses
-- ------------------------------------------------------------
CREATE TABLE menu_analyses (
  analysis_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  restaurant_id   INTEGER NULL,
  status          VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'failed')),
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_analyses_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(restaurant_id)
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX idx_menu_analyses_restaurant ON menu_analyses(restaurant_id);
CREATE INDEX idx_menu_analyses_status ON menu_analyses(status);

-- ------------------------------------------------------------
-- menu_analysis_items (AI-classified line items for one analysis;
-- named distinctly from menu_items above, which is this
-- restaurant's own ordering menu)
-- ------------------------------------------------------------
CREATE TABLE menu_analysis_items (
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

CREATE INDEX idx_menu_analysis_items_analysis ON menu_analysis_items(analysis_id);

-- ------------------------------------------------------------
-- analysis_requests (audit log of every call to the AI Menu
-- Analyzer endpoint, success or failure)
-- ------------------------------------------------------------
CREATE TABLE analysis_requests (
  request_id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  endpoint        VARCHAR(150) NOT NULL,
  restaurant_id   INTEGER NULL,
  response_code   INTEGER NOT NULL CHECK (response_code >= 0),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_analysis_requests_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(restaurant_id)
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX idx_analysis_requests_restaurant ON analysis_requests(restaurant_id);
CREATE INDEX idx_analysis_requests_created_at ON analysis_requests(created_at);
