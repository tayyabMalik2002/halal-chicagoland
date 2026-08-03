const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Deleted in FK-safe order: children before parents.
const TABLES_IN_DELETE_ORDER = [
  'menu_analysis_items',
  'analysis_requests',
  'menu_analyses',
  'order_items',
  'orders',
  'reservations',
  'menu_items',
  'menu_categories',
  'customers',
  'restaurants',
];

async function resetDatabase() {
  const testDbName = process.env.TEST_DB_NAME || 'zabiha_halal_db_test';

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: testDbName,
    multipleStatements: true,
  });

  await connection.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES_IN_DELETE_ORDER) {
    await connection.query(`TRUNCATE TABLE ${table}`);
  }
  await connection.query('SET FOREIGN_KEY_CHECKS = 1');

  const seedSql = fs
    .readFileSync(path.join(__dirname, '../../database/seed.sql'), 'utf8')
    .replace(/USE\s+zabiha_halal_db\s*;/i, '');

  const menuAnalyzerSeedSql = fs
    .readFileSync(path.join(__dirname, '../../sql/seed_menu_analyzer.sql'), 'utf8')
    .replace(/USE\s+zabiha_halal_db\s*;/i, '');

  await connection.query(seedSql);
  await connection.query(menuAnalyzerSeedSql);
  await connection.end();
}

module.exports = resetDatabase;
