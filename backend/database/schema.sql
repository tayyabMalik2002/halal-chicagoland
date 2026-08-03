-- ============================================================
-- Zabiha Halal — Restaurant Management & Online Ordering
-- Database Schema (3NF)
-- Target: MySQL 8.0+
-- ============================================================

DROP DATABASE IF EXISTS zabiha_halal_db;
CREATE DATABASE zabiha_halal_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE zabiha_halal_db;

-- ------------------------------------------------------------
-- customers
-- ------------------------------------------------------------
CREATE TABLE customers (
  customer_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name      VARCHAR(50)  NOT NULL,
  last_name       VARCHAR(50)  NOT NULL,
  email           VARCHAR(120) NOT NULL,
  phone           VARCHAR(20)  NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_customers_email UNIQUE (email)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- menu_categories
-- ------------------------------------------------------------
CREATE TABLE menu_categories (
  category_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(80)  NOT NULL,
  description     VARCHAR(255) NULL,
  display_order   INT UNSIGNED NOT NULL DEFAULT 0,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_menu_categories_name UNIQUE (name)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- menu_items
-- ------------------------------------------------------------
CREATE TABLE menu_items (
  item_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id     INT UNSIGNED NOT NULL,
  name            VARCHAR(120) NOT NULL,
  description     TEXT NULL,
  price           DECIMAL(8,2) NOT NULL,
  halal_notes     VARCHAR(255) NULL,
  is_available    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_items_category
    FOREIGN KEY (category_id) REFERENCES menu_categories(category_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_menu_items_price CHECK (price >= 0)
) ENGINE=InnoDB;

CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_available ON menu_items(is_available);

-- ------------------------------------------------------------
-- orders
-- ------------------------------------------------------------
CREATE TABLE orders (
  order_id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id         INT UNSIGNED NOT NULL,
  order_type          ENUM('pickup','delivery','dine-in') NOT NULL DEFAULT 'pickup',
  status              ENUM('pending','confirmed','preparing','ready','completed','cancelled')
                      NOT NULL DEFAULT 'pending',
  total_amount        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  special_instructions VARCHAR(500) NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_orders_total CHECK (total_amount >= 0)
) ENGINE=InnoDB;

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- ------------------------------------------------------------
-- order_items (line items; unit_price is a snapshot of the menu
-- item price at the time of order so historical orders remain
-- accurate even if the menu price later changes)
-- ------------------------------------------------------------
CREATE TABLE order_items (
  order_item_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id        INT UNSIGNED NOT NULL,
  item_id         INT UNSIGNED NOT NULL,
  quantity        INT UNSIGNED NOT NULL,
  unit_price      DECIMAL(8,2) NOT NULL,
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_items_menu_item
    FOREIGN KEY (item_id) REFERENCES menu_items(item_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_order_items_qty CHECK (quantity > 0),
  CONSTRAINT chk_order_items_price CHECK (unit_price >= 0)
) ENGINE=InnoDB;

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_item ON order_items(item_id);

-- ------------------------------------------------------------
-- reservations
-- ------------------------------------------------------------
CREATE TABLE reservations (
  reservation_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id       INT UNSIGNED NOT NULL,
  reservation_date  DATE NOT NULL,
  reservation_time  TIME NOT NULL,
  party_size        SMALLINT UNSIGNED NOT NULL,
  status            ENUM('pending','confirmed','cancelled','completed')
                    NOT NULL DEFAULT 'pending',
  special_requests  VARCHAR(500) NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reservations_customer
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_reservations_party_size CHECK (party_size > 0)
) ENGINE=InnoDB;

CREATE INDEX idx_reservations_customer ON reservations(customer_id);
CREATE INDEX idx_reservations_date ON reservations(reservation_date);

-- ------------------------------------------------------------
-- restaurants (AI Menu Analyzer — third-party restaurants a
-- customer photographs a menu at, not the Zabiha Halal venue)
-- ------------------------------------------------------------
CREATE TABLE restaurants (
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
CREATE TABLE menu_analyses (
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
-- menu_analysis_items (AI-classified line items for one analysis;
-- named distinctly from menu_items above, which is this
-- restaurant's own ordering menu)
-- ------------------------------------------------------------
CREATE TABLE menu_analysis_items (
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
-- analysis_requests (audit log of every call to the AI Menu
-- Analyzer endpoint, success or failure)
-- ------------------------------------------------------------
CREATE TABLE analysis_requests (
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
