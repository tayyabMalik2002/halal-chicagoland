const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const { isPositiveInteger, isOneOf } = require('../utils/validators');

const ORDER_TYPES = ['pickup', 'delivery', 'dine-in'];
const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];

const STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const validateCreateBody = (body) => {
  const errors = [];

  if (!isPositiveInteger(body.customer_id)) {
    errors.push('customer_id is required and must be a positive integer.');
  }
  if (body.order_type !== undefined && !isOneOf(body.order_type, ORDER_TYPES)) {
    errors.push(`order_type must be one of: ${ORDER_TYPES.join(', ')}.`);
  }
  if (body.special_instructions !== undefined && body.special_instructions !== null && typeof body.special_instructions !== 'string') {
    errors.push('special_instructions must be a string or null.');
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.push('items is required and must be a non-empty array.');
  } else {
    body.items.forEach((item, idx) => {
      if (!item || !isPositiveInteger(item.item_id)) {
        errors.push(`items[${idx}].item_id is required and must be a positive integer.`);
      }
      if (!item || !isPositiveInteger(item.quantity)) {
        errors.push(`items[${idx}].quantity is required and must be a positive integer.`);
      }
    });
  }

  if (errors.length) throw ApiError.badRequest('Validation failed.', errors);
};

const fetchOrderWithItems = async (orderId) => {
  const [orderRows] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [orderId]);
  if (!orderRows.length) return null;

  const [itemRows] = await pool.query(
    `SELECT oi.order_item_id, oi.item_id, mi.name, oi.quantity, oi.unit_price,
            ROUND(oi.quantity * oi.unit_price, 2) AS line_total
     FROM order_items oi
     JOIN menu_items mi ON mi.item_id = oi.item_id
     WHERE oi.order_id = ?
     ORDER BY oi.order_item_id ASC`,
    [orderId]
  );

  return { ...orderRows[0], items: itemRows };
};

const listOrders = async (req, res) => {
  const clauses = [];
  const params = [];

  if (req.query.customer_id !== undefined) {
    if (!/^\d+$/.test(req.query.customer_id)) {
      throw ApiError.badRequest('customer_id query parameter must be a positive integer.');
    }
    clauses.push('customer_id = ?');
    params.push(Number(req.query.customer_id));
  }
  if (req.query.status !== undefined) {
    if (!isOneOf(req.query.status, ORDER_STATUSES)) {
      throw ApiError.badRequest(`status query parameter must be one of: ${ORDER_STATUSES.join(', ')}.`);
    }
    clauses.push('status = ?');
    params.push(req.query.status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM orders ${where} ORDER BY created_at DESC`,
    params
  );
  res.json({ data: rows });
};

const getOrder = async (req, res) => {
  const order = await fetchOrderWithItems(req.params.id);
  if (!order) throw ApiError.notFound(`Order ${req.params.id} not found.`);
  res.json({ data: order });
};

const createOrder = async (req, res) => {
  validateCreateBody(req.body);
  const { customer_id, order_type = 'pickup', special_instructions = null, items } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [customerRows] = await connection.query(
      'SELECT customer_id FROM customers WHERE customer_id = ? FOR UPDATE',
      [customer_id]
    );
    if (!customerRows.length) {
      throw ApiError.badRequest(`customer_id ${customer_id} does not reference an existing customer.`);
    }

    const itemIds = items.map((i) => i.item_id);
    const [menuRows] = await connection.query(
      `SELECT item_id, price, is_available FROM menu_items WHERE item_id IN (${itemIds.map(() => '?').join(',')}) FOR UPDATE`,
      itemIds
    );
    const menuById = new Map(menuRows.map((r) => [r.item_id, r]));

    const errors = [];
    items.forEach((item, idx) => {
      const menuItem = menuById.get(item.item_id);
      if (!menuItem) errors.push(`items[${idx}].item_id ${item.item_id} does not reference an existing menu item.`);
      else if (!menuItem.is_available) errors.push(`items[${idx}].item_id ${item.item_id} is not currently available.`);
    });
    if (errors.length) throw ApiError.badRequest('Validation failed.', errors);

    const total = items.reduce((sum, item) => {
      const price = Number(menuById.get(item.item_id).price);
      return sum + price * item.quantity;
    }, 0);
    const totalRounded = Math.round(total * 100) / 100;

    const [orderResult] = await connection.query(
      `INSERT INTO orders (customer_id, order_type, status, total_amount, special_instructions)
       VALUES (?, ?, 'pending', ?, ?)`,
      [customer_id, order_type, totalRounded, special_instructions]
    );
    const orderId = orderResult.insertId;

    const values = items.map((item) => [
      orderId,
      item.item_id,
      item.quantity,
      Number(menuById.get(item.item_id).price),
    ]);
    await connection.query(
      'INSERT INTO order_items (order_id, item_id, quantity, unit_price) VALUES ?',
      [values]
    );

    await connection.commit();

    const order = await fetchOrderWithItems(orderId);
    res.status(201).json({ data: order });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const [existing] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [id]);
  if (!existing.length) throw ApiError.notFound(`Order ${id} not found.`);

  const { status } = req.body;
  if (!isOneOf(status, ORDER_STATUSES)) {
    throw ApiError.badRequest('Validation failed.', [`status is required and must be one of: ${ORDER_STATUSES.join(', ')}.`]);
  }

  const currentStatus = existing[0].status;
  const allowedNext = STATUS_TRANSITIONS[currentStatus];
  if (!allowedNext.includes(status)) {
    throw ApiError.badRequest(
      `Invalid status transition from "${currentStatus}" to "${status}". Allowed next statuses: ${
        allowedNext.length ? allowedNext.join(', ') : 'none (order is in a final state)'
      }.`
    );
  }

  await pool.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, id]);
  const order = await fetchOrderWithItems(id);
  res.json({ data: order });
};

const deleteOrder = async (req, res) => {
  const { id } = req.params;
  const [existing] = await pool.query('SELECT order_id FROM orders WHERE order_id = ?', [id]);
  if (!existing.length) throw ApiError.notFound(`Order ${id} not found.`);

  await pool.query('DELETE FROM orders WHERE order_id = ?', [id]);
  res.status(204).send();
};

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  deleteOrder,
};
