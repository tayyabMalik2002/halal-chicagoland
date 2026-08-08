const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

// Order doesn't matter for the TRUNCATE itself (CASCADE handles FKs), but
// keeping children-before-parents here documents the dependency graph.
const TABLES_TO_RESET = [
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

function buildTestClientConfig() {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (connectionString) {
    return { connectionString, ssl: { rejectUnauthorized: false } };
  }
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.TEST_DB_NAME || 'zabiha_halal_db_test',
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  };
}

async function resetDatabase() {
  const client = new Client(buildTestClientConfig());
  await client.connect();

  // RESTART IDENTITY resets each table's identity sequence back to 1
  // (unlike MySQL's TRUNCATE, Postgres doesn't do this by default).
  await client.query(`TRUNCATE TABLE ${TABLES_TO_RESET.join(', ')} RESTART IDENTITY CASCADE`);

  const seedSql = fs.readFileSync(path.join(__dirname, '../../database/seed.sql'), 'utf8');
  const menuAnalyzerSeedSql = fs.readFileSync(path.join(__dirname, '../../sql/seed_menu_analyzer.sql'), 'utf8');

  await client.query(seedSql);
  await client.query(menuAnalyzerSeedSql);
  await client.end();
}

module.exports = resetDatabase;
