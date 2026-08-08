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

describe('GET /api/menu-items', () => {
  it('returns all seeded menu items', async () => {
    const res = await request(app).get('/api/menu-items');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(18);
  });

  it('filters by category_id', async () => {
    const res = await request(app).get('/api/menu-items?category_id=3');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(4);
    res.body.data.forEach((item) => expect(item.category_id).toBe(3));
  });

  it('filters by availability', async () => {
    const res = await request(app).get('/api/menu-items?available=true');
    expect(res.status).toBe(200);
    res.body.data.forEach((item) => expect(item.is_available).toBe(true));
  });

  it('rejects an invalid available query value', async () => {
    const res = await request(app).get('/api/menu-items?available=maybe');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/menu-items/:id', () => {
  it('returns a single menu item', async () => {
    const res = await request(app).get('/api/menu-items/9');
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Chicken Biryani');
    expect(Number(res.body.data.price)).toBeCloseTo(14.99);
  });

  it('returns 404 for a menu item that does not exist', async () => {
    const res = await request(app).get('/api/menu-items/9999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/menu-items', () => {
  it('creates a new menu item', async () => {
    const res = await request(app).post('/api/menu-items').send({
      category_id: 3,
      name: 'Chicken Karahi',
      description: 'Chicken cooked in a tomato-based karahi sauce',
      price: 15.99,
      halal_notes: 'Zabiha halal chicken, certified by IFANCA',
      is_available: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Chicken Karahi');
    expect(res.body.data.is_available).toBe(true);
  });

  it('rejects a negative price', async () => {
    const res = await request(app).post('/api/menu-items').send({
      category_id: 3,
      name: 'Broken Item',
      price: -5,
    });
    expect(res.status).toBe(400);
  });

  it('rejects a category_id that does not exist', async () => {
    const res = await request(app).post('/api/menu-items').send({
      category_id: 9999,
      name: 'Orphan Item',
      price: 9.99,
    });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/menu-items/:id', () => {
  it('updates a menu item price', async () => {
    const res = await request(app).put('/api/menu-items/9').send({ price: 16.49 });
    expect(res.status).toBe(200);
    expect(Number(res.body.data.price)).toBeCloseTo(16.49);
  });

  it('returns 404 when updating a menu item that does not exist', async () => {
    const res = await request(app).put('/api/menu-items/9999').send({ price: 5 });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/menu-items/:id/availability', () => {
  it('marks a menu item unavailable', async () => {
    const res = await request(app)
      .patch('/api/menu-items/9/availability')
      .send({ is_available: false });
    expect(res.status).toBe(200);
    expect(res.body.data.is_available).toBe(false);
  });

  it('rejects a non-boolean is_available value', async () => {
    const res = await request(app)
      .patch('/api/menu-items/9/availability')
      .send({ is_available: 'yes' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/menu-items/:id', () => {
  it('deletes a menu item that has no orders', async () => {
    const created = await request(app).post('/api/menu-items').send({
      category_id: 1,
      name: 'Temporary Item',
      price: 1.0,
    });
    const res = await request(app).delete(`/api/menu-items/${created.body.data.item_id}`);
    expect(res.status).toBe(204);
  });

  it('rejects deleting a menu item referenced by an existing order', async () => {
    const res = await request(app).delete('/api/menu-items/9');
    expect(res.status).toBe(409);
  });

  it('returns 404 when deleting a menu item that does not exist', async () => {
    const res = await request(app).delete('/api/menu-items/9999');
    expect(res.status).toBe(404);
  });
});
