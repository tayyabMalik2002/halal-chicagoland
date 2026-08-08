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

describe('GET /api/reservations', () => {
  it('returns all seeded reservations', async () => {
    const res = await request(app).get('/api/reservations');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(4);
  });

  it('filters by status', async () => {
    const res = await request(app).get('/api/reservations?status=confirmed');
    expect(res.status).toBe(200);
    res.body.data.forEach((r) => expect(r.status).toBe('confirmed'));
  });

  it('rejects an invalid date filter', async () => {
    const res = await request(app).get('/api/reservations?date=07-25-2026');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/reservations/:id', () => {
  it('returns a single reservation', async () => {
    const res = await request(app).get('/api/reservations/1');
    expect(res.status).toBe(200);
    expect(res.body.data.party_size).toBe(4);
  });

  it('returns 404 for a reservation that does not exist', async () => {
    const res = await request(app).get('/api/reservations/9999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/reservations', () => {
  it('creates a reservation with default status pending', async () => {
    const res = await request(app).post('/api/reservations').send({
      customer_id: 1,
      reservation_date: '2026-08-01',
      reservation_time: '19:00',
      party_size: 2,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');

    const { rows } = await pool.query('SELECT * FROM reservations WHERE reservation_id = $1', [
      res.body.data.reservation_id,
    ]);
    expect(rows.length).toBe(1);
  });

  it('rejects a reservation with a malformed date', async () => {
    const res = await request(app).post('/api/reservations').send({
      customer_id: 1,
      reservation_date: '08/01/2026',
      reservation_time: '19:00',
      party_size: 2,
    });
    expect(res.status).toBe(400);
  });

  it('rejects a reservation with a zero party size', async () => {
    const res = await request(app).post('/api/reservations').send({
      customer_id: 1,
      reservation_date: '2026-08-01',
      reservation_time: '19:00',
      party_size: 0,
    });
    expect(res.status).toBe(400);
  });

  it('rejects a reservation for a customer that does not exist', async () => {
    const res = await request(app).post('/api/reservations').send({
      customer_id: 9999,
      reservation_date: '2026-08-01',
      reservation_time: '19:00',
      party_size: 2,
    });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/reservations/:id', () => {
  it('updates party size and status', async () => {
    const res = await request(app).put('/api/reservations/2').send({ party_size: 3, status: 'confirmed' });
    expect(res.status).toBe(200);
    expect(res.body.data.party_size).toBe(3);
    expect(res.body.data.status).toBe('confirmed');
  });

  it('returns 404 when updating a reservation that does not exist', async () => {
    const res = await request(app).put('/api/reservations/9999').send({ party_size: 2 });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/reservations/:id/cancel', () => {
  it('cancels a pending reservation', async () => {
    const res = await request(app).patch('/api/reservations/2/cancel');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });

  it('rejects cancelling a reservation that is already cancelled', async () => {
    const res = await request(app).patch('/api/reservations/2/cancel');
    expect(res.status).toBe(400);
  });

  it('returns 404 when cancelling a reservation that does not exist', async () => {
    const res = await request(app).patch('/api/reservations/9999/cancel');
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/reservations/:id', () => {
  it('deletes a reservation', async () => {
    const created = await request(app).post('/api/reservations').send({
      customer_id: 1,
      reservation_date: '2026-09-01',
      reservation_time: '18:00',
      party_size: 2,
    });
    const res = await request(app).delete(`/api/reservations/${created.body.data.reservation_id}`);
    expect(res.status).toBe(204);
  });

  it('returns 404 when deleting a reservation that does not exist', async () => {
    const res = await request(app).delete('/api/reservations/9999');
    expect(res.status).toBe(404);
  });
});
