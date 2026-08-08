const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const {
  isNonEmptyString,
  isNonNegativeNumber,
  isBoolean,
  isPositiveInteger,
} = require('../utils/validators');

const validateBody = (body, { partial = false } = {}) => {
  const errors = [];
  const data = {};

  if (!partial || body.category_id !== undefined) {
    if (!isPositiveInteger(body.category_id)) errors.push('category_id is required and must be a positive integer.');
    else data.category_id = body.category_id;
  }
  if (!partial || body.name !== undefined) {
    if (!isNonEmptyString(body.name)) errors.push('name is required and must be a non-empty string.');
    else data.name = body.name.trim();
  }
  if (!partial || body.price !== undefined) {
    if (!isNonNegativeNumber(body.price)) errors.push('price is required and must be a non-negative number.');
    else data.price = body.price;
  }
  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      errors.push('description must be a string or null.');
    } else {
      data.description = body.description;
    }
  }
  if (body.halal_notes !== undefined) {
    if (body.halal_notes !== null && typeof body.halal_notes !== 'string') {
      errors.push('halal_notes must be a string or null.');
    } else {
      data.halal_notes = body.halal_notes;
    }
  }
  if (body.is_available !== undefined) {
    if (!isBoolean(body.is_available)) errors.push('is_available must be a boolean.');
    else data.is_available = body.is_available;
  }

  if (errors.length) throw ApiError.badRequest('Validation failed.', errors);
  return data;
};

const assertCategoryExists = async (categoryId) => {
  const { rows } = await pool.query('SELECT category_id FROM menu_categories WHERE category_id = $1', [categoryId]);
  if (!rows.length) throw ApiError.badRequest(`category_id ${categoryId} does not reference an existing menu category.`);
};

const listItems = async (req, res) => {
  const clauses = [];
  const params = [];

  if (req.query.category_id !== undefined) {
    if (!/^\d+$/.test(req.query.category_id)) {
      throw ApiError.badRequest('category_id query parameter must be a positive integer.');
    }
    params.push(Number(req.query.category_id));
    clauses.push(`category_id = $${params.length}`);
  }
  if (req.query.available !== undefined) {
    if (!['true', 'false'].includes(req.query.available)) {
      throw ApiError.badRequest('available query parameter must be "true" or "false".');
    }
    params.push(req.query.available === 'true');
    clauses.push(`is_available = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM menu_items ${where} ORDER BY category_id ASC, name ASC`,
    params
  );
  res.json({ data: rows });
};

const getItem = async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query('SELECT * FROM menu_items WHERE item_id = $1', [id]);
  if (!rows.length) throw ApiError.notFound(`Menu item ${id} not found.`);
  res.json({ data: rows[0] });
};

const createItem = async (req, res) => {
  const data = validateBody(req.body);
  await assertCategoryExists(data.category_id);

  const { rows: inserted } = await pool.query(
    `INSERT INTO menu_items (category_id, name, description, price, halal_notes, is_available)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING item_id`,
    [
      data.category_id,
      data.name,
      data.description ?? null,
      data.price,
      data.halal_notes ?? null,
      data.is_available ?? true,
    ]
  );
  const { rows } = await pool.query('SELECT * FROM menu_items WHERE item_id = $1', [inserted[0].item_id]);
  res.status(201).json({ data: rows[0] });
};

const updateItem = async (req, res) => {
  const { id } = req.params;
  const { rows: existing } = await pool.query('SELECT * FROM menu_items WHERE item_id = $1', [id]);
  if (!existing.length) throw ApiError.notFound(`Menu item ${id} not found.`);

  const data = validateBody(req.body, { partial: true });
  if (data.category_id !== undefined) await assertCategoryExists(data.category_id);

  const merged = { ...existing[0], ...data };
  await pool.query(
    `UPDATE menu_items
     SET category_id = $1, name = $2, description = $3, price = $4, halal_notes = $5, is_available = $6
     WHERE item_id = $7`,
    [
      merged.category_id,
      merged.name,
      merged.description,
      merged.price,
      merged.halal_notes,
      merged.is_available,
      id,
    ]
  );
  const { rows } = await pool.query('SELECT * FROM menu_items WHERE item_id = $1', [id]);
  res.json({ data: rows[0] });
};

const updateAvailability = async (req, res) => {
  const { id } = req.params;
  const { rows: existing } = await pool.query('SELECT * FROM menu_items WHERE item_id = $1', [id]);
  if (!existing.length) throw ApiError.notFound(`Menu item ${id} not found.`);

  if (!isBoolean(req.body.is_available)) {
    throw ApiError.badRequest('Validation failed.', ['is_available is required and must be a boolean.']);
  }

  await pool.query('UPDATE menu_items SET is_available = $1 WHERE item_id = $2', [req.body.is_available, id]);
  const { rows } = await pool.query('SELECT * FROM menu_items WHERE item_id = $1', [id]);
  res.json({ data: rows[0] });
};

const deleteItem = async (req, res) => {
  const { id } = req.params;
  const { rows: existing } = await pool.query('SELECT * FROM menu_items WHERE item_id = $1', [id]);
  if (!existing.length) throw ApiError.notFound(`Menu item ${id} not found.`);

  await pool.query('DELETE FROM menu_items WHERE item_id = $1', [id]);
  res.status(204).send();
};

module.exports = {
  listItems,
  getItem,
  createItem,
  updateItem,
  updateAvailability,
  deleteItem,
};
