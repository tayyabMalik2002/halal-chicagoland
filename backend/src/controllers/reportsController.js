const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const { isDateString, isPositiveInteger } = require('../utils/validators');

// Orders excluded from revenue totals because they were never fulfilled.
const NON_REVENUE_STATUSES = ['cancelled'];

const dailyTotals = async (req, res) => {
  if (req.query.date !== undefined) {
    if (!isDateString(req.query.date)) {
      throw ApiError.badRequest('date query parameter must be a valid date in YYYY-MM-DD format.');
    }
    const { rows } = await pool.query(
      `SELECT DATE(created_at) AS order_date,
              COUNT(*) AS order_count,
              COALESCE(SUM(CASE WHEN status <> ALL($1) THEN total_amount ELSE 0 END), 0) AS total_revenue
       FROM orders
       WHERE DATE(created_at) = $2
       GROUP BY DATE(created_at)`,
      [NON_REVENUE_STATUSES, req.query.date]
    );
    return res.json({
      data: rows[0] || { order_date: req.query.date, order_count: 0, total_revenue: 0 },
    });
  }

  const { rows } = await pool.query(
    `SELECT DATE(created_at) AS order_date,
            COUNT(*) AS order_count,
            COALESCE(SUM(CASE WHEN status <> ALL($1) THEN total_amount ELSE 0 END), 0) AS total_revenue
     FROM orders
     GROUP BY DATE(created_at)
     ORDER BY order_date DESC`,
    [NON_REVENUE_STATUSES]
  );
  res.json({ data: rows });
};

const popularItems = async (req, res) => {
  let limit = 5;
  if (req.query.limit !== undefined) {
    const parsed = Number(req.query.limit);
    if (!isPositiveInteger(parsed)) {
      throw ApiError.badRequest('limit query parameter must be a positive integer.');
    }
    limit = parsed;
  }

  const { rows } = await pool.query(
    `SELECT mi.item_id, mi.name, mi.category_id,
            SUM(oi.quantity) AS total_quantity_ordered,
            ROUND(SUM(oi.quantity * oi.unit_price), 2) AS total_revenue
     FROM order_items oi
     JOIN menu_items mi ON mi.item_id = oi.item_id
     JOIN orders o ON o.order_id = oi.order_id
     WHERE o.status <> ALL($1)
     GROUP BY mi.item_id, mi.name, mi.category_id
     ORDER BY total_quantity_ordered DESC
     LIMIT $2`,
    [NON_REVENUE_STATUSES, limit]
  );
  res.json({ data: rows });
};

module.exports = { dailyTotals, popularItems };
