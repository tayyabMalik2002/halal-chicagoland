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

describe('GET /api/menu-categories', () => {
  it('returns all seeded categories ordered by display_order', async () => {
    const res = await request(app).get('/api/menu-categories');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5);
    expect(res.body.data[0].name).toBe('Appetizers');
  });
});

describe('GET /api/menu-categories/:id', () => {
  it('returns a single category', async () => {
    const res = await request(app).get('/api/menu-categories/1');
    expect(res.status).toBe(200);
    expect(res.body.data.category_id).toBe(1);
    expect(res.body.data.name).toBe('Appetizers');
  });

  it('returns 404 for a category that does not exist', async () => {
    const res = await request(app).get('/api/menu-categories/9999');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/not found/i);
  });

  it('returns 400 for a non-numeric id', async () => {
    const res = await request(app).get('/api/menu-categories/abc');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/menu-categories', () => {
  it('creates a new category', async () => {
    const res = await request(app)
      .post('/api/menu-categories')
      .send({ name: 'Soups', description: 'Warm starters', display_order: 6 });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Soups');
    expect(res.body.data.category_id).toBeDefined();
  });

  it('rejects a request missing the required name field', async () => {
    const res = await request(app)
      .post('/api/menu-categories')
      .send({ description: 'No name here' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.stringMatching(/name/i)])
    );
  });

  it('rejects a duplicate category name', async () => {
    const res = await request(app)
      .post('/api/menu-categories')
      .send({ name: 'Appetizers' });
    expect(res.status).toBe(409);
  });
});

describe('PUT /api/menu-categories/:id', () => {
  it('updates an existing category', async () => {
    const res = await request(app)
      .put('/api/menu-categories/2')
      .send({ display_order: 20 });
    expect(res.status).toBe(200);
    expect(res.body.data.display_order).toBe(20);
    expect(res.body.data.name).toBe('Grilled Entrees');
  });

  it('returns 404 when updating a category that does not exist', async () => {
    const res = await request(app)
      .put('/api/menu-categories/9999')
      .send({ display_order: 1 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/menu-categories/:id', () => {
  it('deletes a category with no menu items', async () => {
    const created = await request(app)
      .post('/api/menu-categories')
      .send({ name: 'Temporary Category' });
    const res = await request(app).delete(`/api/menu-categories/${created.body.data.category_id}`);
    expect(res.status).toBe(204);
  });

  it('rejects deleting a category that still has menu items', async () => {
    const res = await request(app).delete('/api/menu-categories/1');
    expect(res.status).toBe(409);
  });

  it('returns 404 when deleting a category that does not exist', async () => {
    const res = await request(app).delete('/api/menu-categories/9999');
    expect(res.status).toBe(404);
  });
});
