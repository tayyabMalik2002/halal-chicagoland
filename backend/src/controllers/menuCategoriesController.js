const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const { isNonEmptyString } = require('../utils/validators');

const validateBody = (body, { partial = false } = {}) => {
  const errors = [];
  const data = {};

  if (!partial || body.name !== undefined) {
    if (!isNonEmptyString(body.name)) errors.push('name is required and must be a non-empty string.');
    else data.name = body.name.trim();
  }
  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      errors.push('description must be a string or null.');
    } else {
      data.description = body.description;
    }
  }
  if (body.display_order !== undefined) {
    if (!Number.isInteger(body.display_order) || body.display_order < 0) {
      errors.push('display_order must be a non-negative integer.');
    } else {
      data.display_order = body.display_order;
    }
  }

  if (errors.length) throw ApiError.badRequest('Validation failed.', errors);
  return data;
};

const listCategories = async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM menu_categories ORDER BY display_order ASC, name ASC'
  );
  res.json({ data: rows });
};

const getCategory = async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query('SELECT * FROM menu_categories WHERE category_id = $1', [id]);
  if (!rows.length) throw ApiError.notFound(`Menu category ${id} not found.`);
  res.json({ data: rows[0] });
};

const createCategory = async (req, res) => {
  const data = validateBody(req.body);
  const { rows: inserted } = await pool.query(
    'INSERT INTO menu_categories (name, description, display_order) VALUES ($1, $2, $3) RETURNING category_id',
    [data.name, data.description ?? null, data.display_order ?? 0]
  );
  const { rows } = await pool.query('SELECT * FROM menu_categories WHERE category_id = $1', [inserted[0].category_id]);
  res.status(201).json({ data: rows[0] });
};

const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { rows: existing } = await pool.query('SELECT * FROM menu_categories WHERE category_id = $1', [id]);
  if (!existing.length) throw ApiError.notFound(`Menu category ${id} not found.`);

  const data = validateBody(req.body, { partial: true });
  const merged = { ...existing[0], ...data };
  await pool.query(
    'UPDATE menu_categories SET name = $1, description = $2, display_order = $3 WHERE category_id = $4',
    [merged.name, merged.description, merged.display_order, id]
  );
  const { rows } = await pool.query('SELECT * FROM menu_categories WHERE category_id = $1', [id]);
  res.json({ data: rows[0] });
};

const deleteCategory = async (req, res) => {
  const { id } = req.params;
  const { rows: existing } = await pool.query('SELECT * FROM menu_categories WHERE category_id = $1', [id]);
  if (!existing.length) throw ApiError.notFound(`Menu category ${id} not found.`);

  await pool.query('DELETE FROM menu_categories WHERE category_id = $1', [id]);
  res.status(204).send();
};

module.exports = {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};
