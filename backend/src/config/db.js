const mysql = require('mysql2/promise');
require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: isTest ? process.env.TEST_DB_NAME : process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  decimalNumbers: true,
  dateStrings: ['DATE'],
});

module.exports = pool;
