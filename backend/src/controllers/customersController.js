const bcrypt = require('bcrypt');
const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const { isNonEmptyString, isEmail } = require('../utils/validators');

const SALT_ROUNDS = 10;

const CUSTOMER_COLUMNS =
  'customer_id, first_name, last_name, email, phone, created_at, updated_at';

const validateRegistration = (body) => {
  const errors = [];
  if (!isNonEmptyString(body.first_name)) errors.push('first_name is required and must be a non-empty string.');
  if (!isNonEmptyString(body.last_name)) errors.push('last_name is required and must be a non-empty string.');
  if (!isEmail(body.email)) errors.push('email is required and must be a valid email address.');
  if (!isNonEmptyString(body.phone)) errors.push('phone is required and must be a non-empty string.');
  if (!isNonEmptyString(body.password) || body.password.length < 8) {
    errors.push('password is required and must be at least 8 characters long.');
  }
  if (errors.length) throw ApiError.badRequest('Validation failed.', errors);
};

const validateUpdate = (body) => {
  const errors = [];
  const data = {};

  if (body.first_name !== undefined) {
    if (!isNonEmptyString(body.first_name)) errors.push('first_name must be a non-empty string.');
    else data.first_name = body.first_name.trim();
  }
  if (body.last_name !== undefined) {
    if (!isNonEmptyString(body.last_name)) errors.push('last_name must be a non-empty string.');
    else data.last_name = body.last_name.trim();
  }
  if (body.email !== undefined) {
    if (!isEmail(body.email)) errors.push('email must be a valid email address.');
    else data.email = body.email.trim();
  }
  if (body.phone !== undefined) {
    if (!isNonEmptyString(body.phone)) errors.push('phone must be a non-empty string.');
    else data.phone = body.phone.trim();
  }
  if (body.password !== undefined) {
    if (!isNonEmptyString(body.password) || body.password.length < 8) {
      errors.push('password must be at least 8 characters long.');
    } else {
      data.password = body.password;
    }
  }

  if (errors.length) throw ApiError.badRequest('Validation failed.', errors);
  return data;
};

const listCustomers = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${CUSTOMER_COLUMNS} FROM customers ORDER BY customer_id ASC`
  );
  res.json({ data: rows });
};

const getCustomer = async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query(
    `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE customer_id = $1`,
    [id]
  );
  if (!rows.length) throw ApiError.notFound(`Customer ${id} not found.`);
  res.json({ data: rows[0] });
};

const registerCustomer = async (req, res) => {
  validateRegistration(req.body);
  const { first_name, last_name, email, phone, password } = req.body;

  const { rows: dupe } = await pool.query('SELECT customer_id FROM customers WHERE email = $1', [email]);
  if (dupe.length) throw ApiError.conflict('A customer with this email already exists.');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const { rows: inserted } = await pool.query(
    'INSERT INTO customers (first_name, last_name, email, phone, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING customer_id',
    [first_name.trim(), last_name.trim(), email.trim(), phone.trim(), passwordHash]
  );

  const { rows } = await pool.query(
    `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE customer_id = $1`,
    [inserted[0].customer_id]
  );
  res.status(201).json({ data: rows[0] });
};

const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { rows: existing } = await pool.query('SELECT * FROM customers WHERE customer_id = $1', [id]);
  if (!existing.length) throw ApiError.notFound(`Customer ${id} not found.`);

  const data = validateUpdate(req.body);

  if (data.email && data.email !== existing[0].email) {
    const { rows: dupe } = await pool.query(
      'SELECT customer_id FROM customers WHERE email = $1 AND customer_id != $2',
      [data.email, id]
    );
    if (dupe.length) throw ApiError.conflict('A customer with this email already exists.');
  }

  const passwordHash = data.password ? await bcrypt.hash(data.password, SALT_ROUNDS) : existing[0].password_hash;
  const merged = { ...existing[0], ...data, password_hash: passwordHash };

  await pool.query(
    'UPDATE customers SET first_name = $1, last_name = $2, email = $3, phone = $4, password_hash = $5 WHERE customer_id = $6',
    [merged.first_name, merged.last_name, merged.email, merged.phone, merged.password_hash, id]
  );

  const { rows } = await pool.query(
    `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE customer_id = $1`,
    [id]
  );
  res.json({ data: rows[0] });
};

const deleteCustomer = async (req, res) => {
  const { id } = req.params;
  const { rows: existing } = await pool.query('SELECT customer_id FROM customers WHERE customer_id = $1', [id]);
  if (!existing.length) throw ApiError.notFound(`Customer ${id} not found.`);

  await pool.query('DELETE FROM customers WHERE customer_id = $1', [id]);
  res.status(204).send();
};

module.exports = {
  listCustomers,
  getCustomer,
  registerCustomer,
  updateCustomer,
  deleteCustomer,
};
