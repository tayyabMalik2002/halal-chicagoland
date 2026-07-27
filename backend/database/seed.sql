-- ============================================================
-- Zabiha Halal — Sample / Demo Data
-- Run AFTER schema.sql
-- All customer passwords below are bcrypt hashes of: Password123!
-- ============================================================

USE zabiha_halal_db;

-- ------------------------------------------------------------
-- customers (5)
-- ------------------------------------------------------------
INSERT INTO customers (first_name, last_name, email, phone, password_hash) VALUES
('Ahmed',  'Khan',      'ahmed.khan@example.com',     '312-555-0101', '$2b$10$6Ck3fTQpAdaSr35T4ixkReXYuidHaewHfXjPBBB.yBx3mZvVfX.6S'),
('Fatima', 'Ali',       'fatima.ali@example.com',     '312-555-0102', '$2b$10$6Ck3fTQpAdaSr35T4ixkReXYuidHaewHfXjPBBB.yBx3mZvVfX.6S'),
('Bilal',  'Rahman',    'bilal.rahman@example.com',   '773-555-0110', '$2b$10$6Ck3fTQpAdaSr35T4ixkReXYuidHaewHfXjPBBB.yBx3mZvVfX.6S'),
('Sara',   'Yousuf',    'sara.yousuf@example.com',    '773-555-0199', '$2b$10$6Ck3fTQpAdaSr35T4ixkReXYuidHaewHfXjPBBB.yBx3mZvVfX.6S'),
('Omar',   'Siddiqui',  'omar.siddiqui@example.com',  '630-555-0143', '$2b$10$6Ck3fTQpAdaSr35T4ixkReXYuidHaewHfXjPBBB.yBx3mZvVfX.6S');

-- ------------------------------------------------------------
-- menu_categories (5)
-- ------------------------------------------------------------
INSERT INTO menu_categories (name, description, display_order) VALUES
('Appetizers',       'Starters and small plates to begin your meal', 1),
('Grilled Entrees',  'Charcoal-grilled halal meats cooked to order', 2),
('Biryani & Rice',   'Slow-cooked, layered rice dishes',              3),
('Beverages',        'Traditional and soft drinks',                  4),
('Desserts',         'Traditional sweets to finish your meal',       5);

-- ------------------------------------------------------------
-- menu_items (18)
-- ------------------------------------------------------------
INSERT INTO menu_items (category_id, name, description, price, halal_notes, is_available) VALUES
-- Appetizers
(1, 'Vegetable Samosas',        'Crispy pastry filled with spiced potatoes and peas, served with tamarind chutney', 5.99, 'Vegetarian; fried in dedicated halal oil', 1),
(1, 'Chicken Seekh Kebab Bites','Charcoal-grilled minced chicken skewers with mint chutney',                        8.99, 'Zabiha halal chicken, certified by IFANCA', 1),
(1, 'Hummus & Pita',            'Creamy chickpea hummus served with warm pita bread',                                6.49, 'Vegetarian', 1),
(1, 'Falafel Plate',            'Crispy chickpea falafel with tahini sauce and pickled vegetables',                  7.49, 'Vegetarian', 1),
-- Grilled Entrees
(2, 'Chicken Tikka Platter',    'Marinated chicken thigh grilled over charcoal, served with rice and salad',         16.99, 'Zabiha halal chicken, certified by IFANCA', 1),
(2, 'Beef Seekh Kebab Platter', 'Spiced minced beef skewers grilled over charcoal',                                  17.99, 'Zabiha halal beef, hand-slaughtered', 1),
(2, 'Lamb Chops',               'Herb-marinated lamb chops char-grilled and served with mint chutney',               22.99, 'Zabiha halal lamb, certified by HMC', 1),
(2, 'Grilled Whole Fish (Tilapia)', 'Whole tilapia marinated in a spiced masala and charcoal grilled',               19.99, 'Halal - no cross-contamination with non-halal proteins', 1),
-- Biryani & Rice
(3, 'Chicken Biryani',          'Basmati rice layered with spiced chicken, fried onions, and herbs',                 14.99, 'Zabiha halal chicken, certified by IFANCA', 1),
(3, 'Beef Biryani',             'Basmati rice layered with slow-cooked spiced beef',                                 15.99, 'Zabiha halal beef, hand-slaughtered', 1),
(3, 'Vegetable Biryani',        'Basmati rice layered with mixed vegetables and warm spices',                        12.99, 'Vegetarian', 1),
(3, 'Lamb Biryani',             'Basmati rice layered with tender, slow-cooked lamb',                                17.99, 'Zabiha halal lamb, certified by HMC', 1),
-- Beverages
(4, 'Mango Lassi',              'Sweet yogurt smoothie blended with mango pulp',                                    4.99, 'Vegetarian', 1),
(4, 'Rooh Afza',                'Traditional rose-flavored sherbet drink',                                          3.49, 'Vegetarian', 1),
(4, 'Soft Drink (Can)',         'Assorted canned sodas',                                                            1.99, 'Vegetarian', 1),
(4, 'Karak Chai',               'Spiced milk tea brewed with cardamom',                                             2.99, 'Vegetarian', 1),
-- Desserts
(5, 'Gulab Jamun (2 pcs)',      'Soft milk-solid dumplings soaked in rose-cardamom syrup',                          3.99, 'Vegetarian', 1),
(5, 'Kheer',                    'Traditional rice pudding with cardamom, pistachios, and saffron',                  4.49, 'Vegetarian', 1);

-- ------------------------------------------------------------
-- orders (6) + order_items
-- Totals are pre-computed to match SUM(quantity * unit_price)
-- ------------------------------------------------------------

-- Order 1: Ahmed Khan (customer 1) - pickup, completed - total 39.96
INSERT INTO orders (customer_id, order_type, status, total_amount, special_instructions) VALUES
(1, 'pickup', 'completed', 39.96, 'Extra napkins please');
INSERT INTO order_items (order_id, item_id, quantity, unit_price) VALUES
(1, 9,  2, 14.99),
(1, 13, 2, 4.99);

-- Order 2: Fatima Ali (customer 2) - delivery, preparing - total 28.98
INSERT INTO orders (customer_id, order_type, status, total_amount, special_instructions) VALUES
(2, 'delivery', 'preparing', 28.98, 'Ring doorbell twice');
INSERT INTO order_items (order_id, item_id, quantity, unit_price) VALUES
(2, 7, 1, 22.99),
(2, 1, 1, 5.99);

-- Order 3: Bilal Rahman (customer 3) - dine-in, pending - total 39.96
INSERT INTO orders (customer_id, order_type, status, total_amount, special_instructions) VALUES
(3, 'dine-in', 'pending', 39.96, NULL);
INSERT INTO order_items (order_id, item_id, quantity, unit_price) VALUES
(3, 6,  2, 17.99),
(3, 15, 2, 1.99);

-- Order 4: Sara Yousuf (customer 4) - pickup, confirmed - total 23.47
INSERT INTO orders (customer_id, order_type, status, total_amount, special_instructions) VALUES
(4, 'pickup', 'confirmed', 23.47, 'No onions in the biryani');
INSERT INTO order_items (order_id, item_id, quantity, unit_price) VALUES
(4, 11, 1, 12.99),
(4, 3,  1, 6.49),
(4, 17, 1, 3.99);

-- Order 5: Omar Siddiqui (customer 5) - delivery, ready - total 58.44
INSERT INTO orders (customer_id, order_type, status, total_amount, special_instructions) VALUES
(5, 'delivery', 'ready', 58.44, 'Leave at front door');
INSERT INTO order_items (order_id, item_id, quantity, unit_price) VALUES
(5, 10, 3, 15.99),
(5, 14, 3, 3.49);

-- Order 6: Ahmed Khan (customer 1) - dine-in, cancelled - total 19.99
INSERT INTO orders (customer_id, order_type, status, total_amount, special_instructions) VALUES
(1, 'dine-in', 'cancelled', 19.99, 'Customer cancelled - changed plans');
INSERT INTO order_items (order_id, item_id, quantity, unit_price) VALUES
(6, 8, 1, 19.99);

-- ------------------------------------------------------------
-- reservations (4)
-- ------------------------------------------------------------
INSERT INTO reservations (customer_id, reservation_date, reservation_time, party_size, status, special_requests) VALUES
(2, '2026-07-25', '18:30:00', 4, 'confirmed', 'Window seat preferred'),
(3, '2026-07-26', '19:00:00', 2, 'pending',   NULL),
(5, '2026-07-27', '20:00:00', 6, 'confirmed', 'Birthday celebration, need a high chair'),
(4, '2026-07-20', '12:30:00', 3, 'cancelled', NULL);
