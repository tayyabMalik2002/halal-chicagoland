const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');
const resetDatabase = require('./setup/resetDb');

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await pool.end();
});

describe('GET /api/orders', () => {
  it('returns all seeded orders', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(6);
  });

  it('filters by customer_id', async () => {
    const res = await request(app).get('/api/orders?customer_id=1');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  it('filters by status', async () => {
    const res = await request(app).get('/api/orders?status=cancelled');
    expect(res.status).toBe(200);
    res.body.data.forEach((order) => expect(order.status).toBe('cancelled'));
  });

  it('rejects an invalid status filter', async () => {
    const res = await request(app).get('/api/orders?status=not-a-status');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/orders/:id', () => {
  it('returns an order with its line items joined to menu item names', async () => {
    const res = await request(app).get('/api/orders/1');
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(2);
    expect(res.body.data.items[0].name).toBe('Chicken Biryani');
    expect(Number(res.body.data.total_amount)).toBeCloseTo(39.96);
  });

  it('returns 404 for an order that does not exist', async () => {
    const res = await request(app).get('/api/orders/9999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/orders (transactional creation)', () => {
  it('creates an order, inserts line items, and computes the total from current menu prices', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        customer_id: 2,
        order_type: 'pickup',
        special_instructions: 'No onions please',
        items: [
          { item_id: 5, quantity: 2 }, // Chicken Tikka Platter 16.99 x2
          { item_id: 13, quantity: 1 }, // Mango Lassi 4.99 x1
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(Number(res.body.data.total_amount)).toBeCloseTo(38.97);
    expect(res.body.data.items.length).toBe(2);

    // Verify it is actually persisted in the database, not just in-memory.
    const [rows] = await pool.query('SELECT * FROM orders WHERE order_id = ?', [res.body.data.order_id]);
    expect(rows.length).toBe(1);
    expect(Number(rows[0].total_amount)).toBeCloseTo(38.97);
  });

  it('rolls back the entire order when one line item is invalid (no partial order is created)', async () => {
    const [beforeOrders] = await pool.query('SELECT COUNT(*) AS count FROM orders');
    const [beforeItems] = await pool.query('SELECT COUNT(*) AS count FROM order_items');

    const res = await request(app)
      .post('/api/orders')
      .send({
        customer_id: 2,
        items: [
          { item_id: 5, quantity: 1 },
          { item_id: 9999, quantity: 1 }, // does not exist
        ],
      });
    expect(res.status).toBe(400);

    const [afterOrders] = await pool.query('SELECT COUNT(*) AS count FROM orders');
    const [afterItems] = await pool.query('SELECT COUNT(*) AS count FROM order_items');
    expect(afterOrders[0].count).toBe(beforeOrders[0].count);
    expect(afterItems[0].count).toBe(beforeItems[0].count);
  });

  it('rejects an order for an unavailable menu item', async () => {
    await request(app).patch('/api/menu-items/9/availability').send({ is_available: false });

    const res = await request(app)
      .post('/api/orders')
      .send({ customer_id: 2, items: [{ item_id: 9, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.stringMatching(/not currently available/i)])
    );

    // restore for subsequent tests
    await request(app).patch('/api/menu-items/9/availability').send({ is_available: true });
  });

  it('rejects an order for a customer that does not exist', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ customer_id: 9999, items: [{ item_id: 1, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it('rejects an order with an empty items array', async () => {
    const res = await request(app).post('/api/orders').send({ customer_id: 2, items: [] });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/orders/:id/status', () => {
  it('advances a pending order to confirmed', async () => {
    const res = await request(app).patch('/api/orders/3/status').send({ status: 'confirmed' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('confirmed');
  });

  it('rejects an illegal status transition (skipping steps)', async () => {
    const res = await request(app).patch('/api/orders/3/status').send({ status: 'completed' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/invalid status transition/i);
  });

  it('rejects an unknown status value', async () => {
    const res = await request(app).patch('/api/orders/3/status').send({ status: 'exploded' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when updating status for an order that does not exist', async () => {
    const res = await request(app).patch('/api/orders/9999/status').send({ status: 'confirmed' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/orders/:id', () => {
  it('deletes an order and cascades to its order_items', async () => {
    const created = await request(app)
      .post('/api/orders')
      .send({ customer_id: 3, items: [{ item_id: 1, quantity: 1 }] });
    const orderId = created.body.data.order_id;

    const res = await request(app).delete(`/api/orders/${orderId}`);
    expect(res.status).toBe(204);

    const [rows] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
    expect(rows.length).toBe(0);
  });

  it('returns 404 when deleting an order that does not exist', async () => {
    const res = await request(app).delete('/api/orders/9999');
    expect(res.status).toBe(404);
  });
});
