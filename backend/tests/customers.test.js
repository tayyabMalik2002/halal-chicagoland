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

describe('GET /api/customers', () => {
  it('returns all seeded customers without password hashes', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5);
    res.body.data.forEach((customer) => expect(customer.password_hash).toBeUndefined());
  });
});

describe('GET /api/customers/:id', () => {
  it('returns a single customer', async () => {
    const res = await request(app).get('/api/customers/1');
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('ahmed.khan@example.com');
  });

  it('returns 404 for a customer that does not exist', async () => {
    const res = await request(app).get('/api/customers/9999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/customers (register)', () => {
  it('registers a new customer with a hashed password', async () => {
    const res = await request(app).post('/api/customers').send({
      first_name: 'Yusuf',
      last_name: 'Malik',
      email: 'yusuf.malik@example.com',
      phone: '312-555-0177',
      password: 'SecurePass1!',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('yusuf.malik@example.com');
    expect(res.body.data.password_hash).toBeUndefined();
  });

  it('rejects registration with a duplicate email', async () => {
    const res = await request(app).post('/api/customers').send({
      first_name: 'Duplicate',
      last_name: 'User',
      email: 'ahmed.khan@example.com',
      phone: '312-555-0000',
      password: 'AnotherPass1!',
    });
    expect(res.status).toBe(409);
  });

  it('rejects registration with an invalid email', async () => {
    const res = await request(app).post('/api/customers').send({
      first_name: 'Bad',
      last_name: 'Email',
      email: 'not-an-email',
      phone: '312-555-0000',
      password: 'ValidPass1!',
    });
    expect(res.status).toBe(400);
  });

  it('rejects registration with a password shorter than 8 characters', async () => {
    const res = await request(app).post('/api/customers').send({
      first_name: 'Short',
      last_name: 'Password',
      email: 'short.password@example.com',
      phone: '312-555-0000',
      password: '123',
    });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/customers/:id', () => {
  it('updates a customer profile field', async () => {
    const res = await request(app).put('/api/customers/2').send({ phone: '312-555-9999' });
    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('312-555-9999');
  });

  it('rejects updating to an email already used by another customer', async () => {
    const res = await request(app).put('/api/customers/2').send({ email: 'ahmed.khan@example.com' });
    expect(res.status).toBe(409);
  });

  it('returns 404 when updating a customer that does not exist', async () => {
    const res = await request(app).put('/api/customers/9999').send({ phone: '000' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/customers/:id', () => {
  it('deletes a customer with no orders or reservations', async () => {
    const created = await request(app).post('/api/customers').send({
      first_name: 'Temp',
      last_name: 'Customer',
      email: 'temp.customer@example.com',
      phone: '312-555-1111',
      password: 'TempPass1!',
    });
    const res = await request(app).delete(`/api/customers/${created.body.data.customer_id}`);
    expect(res.status).toBe(204);
  });

  it('rejects deleting a customer who has existing orders', async () => {
    const res = await request(app).delete('/api/customers/1');
    expect(res.status).toBe(409);
  });

  it('returns 404 when deleting a customer that does not exist', async () => {
    const res = await request(app).delete('/api/customers/9999');
    expect(res.status).toBe(404);
  });
});
