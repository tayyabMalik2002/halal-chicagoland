-- ============================================================
-- Zabiha Halal — AI Menu Analyzer
-- Sample data: 3 Chicago-area restaurants with no zabihah halal
-- meat options, representative of the app's target use case.
-- Run AFTER menu_analyzer.sql
-- ============================================================

USE zabiha_halal_db;

INSERT INTO restaurants (name, address, cuisine_type, source) VALUES
('Cafecito Pilsen',       '1401 W 18th St, Chicago, IL 60608',   'Latin American', 'seed'),
('Green Sesame Kitchen',  '3201 N Clark St, Chicago, IL 60657',  'Asian Fusion',   'seed'),
('Old Town Pasta House',  '1543 N Wells St, Chicago, IL 60610',  'Italian',        'seed');
