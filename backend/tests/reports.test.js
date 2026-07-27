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

describe('GET /api/reports/daily-totals', () => {
  it('returns order counts and revenue grouped by day, excluding cancelled orders from revenue', async () => {
    const res = await request(app).get('/api/reports/daily-totals');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('order_count');
    expect(res.body.data[0]).toHaveProperty('total_revenue');
  });

  it('returns a single day total when a date is provided', async () => {
    const res = await request(app).get('/api/reports/daily-totals?date=2026-07-20');
    expect(res.status).toBe(200);
    expect(res.body.data.order_date).toBe('2026-07-20');
    expect(res.body.data.order_count).toBe(6);
    // 39.96 + 28.98 + 39.96 + 23.47 + 58.44 = 190.81 (order 6 is cancelled, excluded from revenue)
    expect(Number(res.body.data.total_revenue)).toBeCloseTo(190.81);
  });

  it('returns zeroed totals for a date with no orders', async () => {
    const res = await request(app).get('/api/reports/daily-totals?date=2020-01-01');
    expect(res.status).toBe(200);
    expect(res.body.data.order_count).toBe(0);
  });

  it('rejects a malformed date query parameter', async () => {
    const res = await request(app).get('/api/reports/daily-totals?date=not-a-date');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/reports/popular-items', () => {
  it('returns the top items ranked by quantity ordered', async () => {
    const res = await request(app).get('/api/reports/popular-items');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(res.body.data[0]).toHaveProperty('total_quantity_ordered');
  });

  it('respects a custom limit', async () => {
    const res = await request(app).get('/api/reports/popular-items?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  it('rejects a non-positive-integer limit', async () => {
    const res = await request(app).get('/api/reports/popular-items?limit=-1');
    expect(res.status).toBe(400);
  });
});
