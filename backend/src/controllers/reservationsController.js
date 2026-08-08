const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const { isPositiveInteger, isDateString, isTimeString, isOneOf } = require('../utils/validators');

const RESERVATION_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'];

const validateCreateBody = (body) => {
  const errors = [];

  if (!isPositiveInteger(body.customer_id)) errors.push('customer_id is required and must be a positive integer.');
  if (!isDateString(body.reservation_date)) errors.push('reservation_date is required and must be a valid date in YYYY-MM-DD format.');
  if (!isTimeString(body.reservation_time)) errors.push('reservation_time is required and must be in HH:MM or HH:MM:SS format.');
  if (!isPositiveInteger(body.party_size)) errors.push('party_size is required and must be a positive integer.');
  if (body.special_requests !== undefined && body.special_requests !== null && typeof body.special_requests !== 'string') {
    errors.push('special_requests must be a string or null.');
  }

  if (errors.length) throw ApiError.badRequest('Validation failed.', errors);
};

const validateUpdateBody = (body) => {
  const errors = [];
  const data = {};

  if (body.reservation_date !== undefined) {
    if (!isDateString(body.reservation_date)) errors.push('reservation_date must be a valid date in YYYY-MM-DD format.');
    else data.reservation_date = body.reservation_date;
  }
  if (body.reservation_time !== undefined) {
    if (!isTimeString(body.reservation_time)) errors.push('reservation_time must be in HH:MM or HH:MM:SS format.');
    else data.reservation_time = body.reservation_time;
  }
  if (body.party_size !== undefined) {
    if (!isPositiveInteger(body.party_size)) errors.push('party_size must be a positive integer.');
    else data.party_size = body.party_size;
  }
  if (body.status !== undefined) {
    if (!isOneOf(body.status, RESERVATION_STATUSES)) errors.push(`status must be one of: ${RESERVATION_STATUSES.join(', ')}.`);
    else data.status = body.status;
  }
  if (body.special_requests !== undefined) {
    if (body.special_requests !== null && typeof body.special_requests !== 'string') {
      errors.push('special_requests must be a string or null.');
    } else {
      data.special_requests = body.special_requests;
    }
  }

  if (errors.length) throw ApiError.badRequest('Validation failed.', errors);
  return data;
};

const listReservations = async (req, res) => {
  const clauses = [];
  const params = [];

  if (req.query.customer_id !== undefined) {
    if (!/^\d+$/.test(req.query.customer_id)) {
      throw ApiError.badRequest('customer_id query parameter must be a positive integer.');
    }
    params.push(Number(req.query.customer_id));
    clauses.push(`customer_id = $${params.length}`);
  }
  if (req.query.status !== undefined) {
    if (!isOneOf(req.query.status, RESERVATION_STATUSES)) {
      throw ApiError.badRequest(`status query parameter must be one of: ${RESERVATION_STATUSES.join(', ')}.`);
    }
    params.push(req.query.status);
    clauses.push(`status = $${params.length}`);
  }
  if (req.query.date !== undefined) {
    if (!isDateString(req.query.date)) {
      throw ApiError.badRequest('date query parameter must be a valid date in YYYY-MM-DD format.');
    }
    params.push(req.query.date);
    clauses.push(`reservation_date = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM reservations ${where} ORDER BY reservation_date ASC, reservation_time ASC`,
    params
  );
  res.json({ data: rows });
};

const getReservation = async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query('SELECT * FROM reservations WHERE reservation_id = $1', [id]);
  if (!rows.length) throw ApiError.notFound(`Reservation ${id} not found.`);
  res.json({ data: rows[0] });
};

const createReservation = async (req, res) => {
  validateCreateBody(req.body);
  const { customer_id, reservation_date, reservation_time, party_size, special_requests = null } = req.body;

  const { rows: customerRows } = await pool.query('SELECT customer_id FROM customers WHERE customer_id = $1', [customer_id]);
  if (!customerRows.length) throw ApiError.badRequest(`customer_id ${customer_id} does not reference an existing customer.`);

  const { rows: inserted } = await pool.query(
    `INSERT INTO reservations (customer_id, reservation_date, reservation_time, party_size, status, special_requests)
     VALUES ($1, $2, $3, $4, 'pending', $5) RETURNING reservation_id`,
    [customer_id, reservation_date, reservation_time, party_size, special_requests]
  );
  const { rows } = await pool.query('SELECT * FROM reservations WHERE reservation_id = $1', [inserted[0].reservation_id]);
  res.status(201).json({ data: rows[0] });
};

const updateReservation = async (req, res) => {
  const { id } = req.params;
  const { rows: existing } = await pool.query('SELECT * FROM reservations WHERE reservation_id = $1', [id]);
  if (!existing.length) throw ApiError.notFound(`Reservation ${id} not found.`);

  const data = validateUpdateBody(req.body);
  const merged = { ...existing[0], ...data };

  await pool.query(
    `UPDATE reservations
     SET reservation_date = $1, reservation_time = $2, party_size = $3, status = $4, special_requests = $5
     WHERE reservation_id = $6`,
    [merged.reservation_date, merged.reservation_time, merged.party_size, merged.status, merged.special_requests, id]
  );
  const { rows } = await pool.query('SELECT * FROM reservations WHERE reservation_id = $1', [id]);
  res.json({ data: rows[0] });
};

const cancelReservation = async (req, res) => {
  const { id } = req.params;
  const { rows: existing } = await pool.query('SELECT * FROM reservations WHERE reservation_id = $1', [id]);
  if (!existing.length) throw ApiError.notFound(`Reservation ${id} not found.`);

  if (['cancelled', 'completed'].includes(existing[0].status)) {
    throw ApiError.badRequest(`Reservation ${id} is already "${existing[0].status}" and cannot be cancelled.`);
  }

  await pool.query('UPDATE reservations SET status = $1 WHERE reservation_id = $2', ['cancelled', id]);
  const { rows } = await pool.query('SELECT * FROM reservations WHERE reservation_id = $1', [id]);
  res.json({ data: rows[0] });
};

const deleteReservation = async (req, res) => {
  const { id } = req.params;
  const { rows: existing } = await pool.query('SELECT reservation_id FROM reservations WHERE reservation_id = $1', [id]);
  if (!existing.length) throw ApiError.notFound(`Reservation ${id} not found.`);

  await pool.query('DELETE FROM reservations WHERE reservation_id = $1', [id]);
  res.status(204).send();
};

module.exports = {
  listReservations,
  getReservation,
  createReservation,
  updateReservation,
  cancelReservation,
  deleteReservation,
};
