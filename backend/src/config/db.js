const { Pool, types } = require('pg');
require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';

// Postgres returns DATE columns as JS Date objects by default; keep them as
// plain 'YYYY-MM-DD' strings to match the previous mysql2 dateStrings
// behavior the rest of the app was written against.
types.setTypeParser(types.builtins.DATE, (val) => val);

// Postgres returns BIGINT (e.g. COUNT(*)) and NUMERIC/DECIMAL columns as
// strings by default, to avoid precision loss for values outside JS's safe
// integer range. mysql2 (with decimalNumbers: true) returned both as plain
// JS numbers, which the rest of the app was written against.
types.setTypeParser(types.builtins.INT8, (val) => parseInt(val, 10));
types.setTypeParser(types.builtins.NUMERIC, (val) => parseFloat(val));

function buildConnectionConfig() {
  const connectionString = isTest
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

  if (connectionString) {
    return {
      connectionString,
      ssl: connectionString.includes('sslmode=disable')
        ? false
        : { rejectUnauthorized: false },
    };
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: isTest ? process.env.TEST_DB_NAME : process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  };
}

const pool = new Pool({
  ...buildConnectionConfig(),
  max: Number(process.env.DB_CONNECTION_LIMIT) || 10,
});

module.exports = pool;
