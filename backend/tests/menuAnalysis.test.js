jest.mock('@anthropic-ai/sdk', () => {
  const mockCreate = jest.fn();
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
  MockAnthropic.__mockCreate = mockCreate;
  return MockAnthropic;
});

const request = require('supertest');
const Anthropic = require('@anthropic-ai/sdk');
const app = require('../src/app');
const pool = require('../src/config/db');
const resetDatabase = require('./setup/resetDb');

const mockCreate = Anthropic.__mockCreate;

const textResponse = (payload) => ({
  content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }],
});

const fakeImage = () => Buffer.from('fake-image-bytes');

beforeAll(async () => {
  await resetDatabase();
});

beforeEach(() => {
  mockCreate.mockReset();
});

afterAll(async () => {
  await pool.end();
});

describe('POST /api/menu-analysis', () => {
  it('analyzes a menu photo with no restaurant_name (happy path, single AI call)', async () => {
    mockCreate.mockResolvedValueOnce(
      textResponse({
        restaurant_name_detected: null,
        items: [
          { item_name: 'Veggie Burger', classification: 'vegetarian_safe', reasoning: 'No meat or animal derivatives.', confidence: 'high' },
          { item_name: 'Fries', classification: 'doubtful', reasoning: 'May be fried in a shared fryer with breaded chicken.', confidence: 'medium' },
        ],
        overall_note: 'Confirm fryer usage with staff.',
      })
    );

    const res = await request(app).post('/api/menu-analysis').attach('image', fakeImage(), {
      filename: 'menu.jpg',
      contentType: 'image/jpeg',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.source).toBe('ai_analysis');
    expect(res.body.data.restaurant).toBeNull();
    expect(res.body.data.items.length).toBe(2);
    expect(res.body.data.disclaimer).toMatch(/cannot verify preparation methods/i);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const { rows } = await pool.query('SELECT * FROM menu_analyses WHERE analysis_id = $1', [res.body.data.analysis_id]);
    expect(rows.length).toBe(1);
    expect(rows[0].restaurant_id).toBeNull();
    expect(rows[0].status).toBe('completed');

    const { rows: items } = await pool.query('SELECT * FROM menu_analysis_items WHERE analysis_id = $1', [res.body.data.analysis_id]);
    expect(items.length).toBe(2);
  });

  it('returns a cached analysis on a second request for the same restaurant, without calling the AI again', async () => {
    mockCreate
      .mockResolvedValueOnce(
        textResponse({
          restaurant_name_detected: 'Test Bistro Cache',
          items: [{ item_name: 'Hummus Plate', classification: 'vegetarian_safe', reasoning: 'Chickpeas, tahini, olive oil.', confidence: 'high' }],
          overall_note: 'Looks safe.',
        })
      )
      .mockResolvedValueOnce(textResponse({ found: true, address: '100 Test St, Chicago, IL', cuisine_type: 'Mediterranean' }));

    const first = await request(app)
      .post('/api/menu-analysis')
      .field('restaurant_name', 'Test Bistro Cache')
      .attach('image', fakeImage(), { filename: 'menu.jpg', contentType: 'image/jpeg' });

    expect(first.status).toBe(201);
    expect(first.body.data.source).toBe('ai_analysis');
    expect(mockCreate).toHaveBeenCalledTimes(2);

    const second = await request(app)
      .post('/api/menu-analysis')
      .field('restaurant_name', 'test bistro cache') // case-insensitive match
      .attach('image', fakeImage(), { filename: 'menu.jpg', contentType: 'image/jpeg' });

    expect(second.status).toBe(200);
    expect(second.body.data.source).toBe('cache');
    expect(second.body.data.items.length).toBe(1);
    expect(mockCreate).toHaveBeenCalledTimes(2); // no additional AI calls
  });

  it('creates a restaurant via web search when restaurant_name is not already in the database', async () => {
    mockCreate
      .mockResolvedValueOnce(
        textResponse({
          restaurant_name_detected: 'Test Bistro WebSearch',
          items: [{ item_name: 'Caprese Salad', classification: 'vegetarian_safe', reasoning: 'Tomato, mozzarella, basil.', confidence: 'high' }],
          overall_note: 'Confirm cheese rennet source.',
        })
      )
      .mockResolvedValueOnce(textResponse({ found: true, address: '200 Web St, Chicago, IL', cuisine_type: 'Italian' }));

    const res = await request(app)
      .post('/api/menu-analysis')
      .field('restaurant_name', 'Test Bistro WebSearch')
      .field('restaurant_location', 'Chicago, IL')
      .attach('image', fakeImage(), { filename: 'menu.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(res.body.data.restaurant.source).toBe('web_search');
    expect(res.body.data.restaurant.address).toBe('200 Web St, Chicago, IL');

    const { rows } = await pool.query('SELECT * FROM restaurants WHERE restaurant_id = $1', [res.body.data.restaurant.restaurant_id]);
    expect(rows.length).toBe(1);
    expect(rows[0].source).toBe('web_search');
  });

  it('rejects a request with neither an image nor a restaurant_name', async () => {
    const res = await request(app).post('/api/menu-analysis');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/menu photo or a restaurant name/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects an unsupported image mime type', async () => {
    const res = await request(app)
      .post('/api/menu-analysis')
      .attach('image', Buffer.from('not an image'), { filename: 'menu.txt', contentType: 'text/plain' });
    expect(res.status).toBe(415);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects an image over the 10MB size limit', async () => {
    const oversized = Buffer.alloc(11 * 1024 * 1024, 1);
    const res = await request(app)
      .post('/api/menu-analysis')
      .attach('image', oversized, { filename: 'huge.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(413);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 422 when the AI reports the image is not a menu', async () => {
    mockCreate.mockResolvedValueOnce(textResponse({ error: 'not_a_menu' }));

    const res = await request(app)
      .post('/api/menu-analysis')
      .attach('image', fakeImage(), { filename: 'not-a-menu.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(422);
  });

  it('returns 502 when the AI response is not valid JSON', async () => {
    mockCreate.mockResolvedValueOnce(textResponse('Sure, here is my analysis of the menu: not actually JSON.'));

    const res = await request(app)
      .post('/api/menu-analysis')
      .attach('image', fakeImage(), { filename: 'menu.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(502);
  });

  it('returns 502 when the Anthropic API call itself fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('upstream timeout'));

    const res = await request(app)
      .post('/api/menu-analysis')
      .attach('image', fakeImage(), { filename: 'menu.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(502);
  });
});

describe('POST /api/menu-analysis — name-only search (no image)', () => {
  it('finds a menu via web search with a single AI call', async () => {
    mockCreate.mockResolvedValueOnce(
      textResponse({
        menu_source_url: 'https://example.com/name-only-bistro/menu',
        items: [
          { item_name: 'Falafel Wrap', classification: 'vegetarian_safe', reasoning: 'Chickpeas, vegetables, no animal products.', confidence: 'high' },
          { item_name: 'Baklava', classification: 'doubtful', reasoning: 'May use butter/ghee of unclear source, or gelatin in some recipes.', confidence: 'low' },
        ],
        overall_note: 'Confirm dessert ingredients with staff.',
      })
    );

    const res = await request(app)
      .post('/api/menu-analysis')
      .field('restaurant_name', 'Name Only Bistro')
      .field('restaurant_location', 'Chicago, IL');

    expect(res.status).toBe(201);
    expect(res.body.data.source).toBe('ai_web_search');
    expect(res.body.data.menu_source_url).toBe('https://example.com/name-only-bistro/menu');
    expect(res.body.data.restaurant.source).toBe('web_search');
    expect(res.body.data.items.length).toBe(2);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const { rows } = await pool.query('SELECT * FROM menu_analyses WHERE analysis_id = $1', [res.body.data.analysis_id]);
    expect(rows.length).toBe(1);
    expect(rows[0].restaurant_id).toBe(res.body.data.restaurant.restaurant_id);
  });

  it('returns a cached analysis on a second name-only request, without calling the AI again', async () => {
    mockCreate.mockResolvedValueOnce(
      textResponse({
        menu_source_url: 'https://example.com/name-only-cache/menu',
        items: [{ item_name: 'Greek Salad', classification: 'vegetarian_safe', reasoning: 'Vegetables and feta; confirm rennet source.', confidence: 'medium' }],
        overall_note: 'Looks mostly safe.',
      })
    );

    const first = await request(app).post('/api/menu-analysis').field('restaurant_name', 'Name Only Cache Spot');
    expect(first.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const second = await request(app).post('/api/menu-analysis').field('restaurant_name', 'name only cache spot');
    expect(second.status).toBe(200);
    expect(second.body.data.source).toBe('cache');
    expect(mockCreate).toHaveBeenCalledTimes(1); // no additional AI call
  });

  it('returns 404 when the AI cannot find the restaurant or its menu', async () => {
    mockCreate.mockResolvedValueOnce(textResponse({ error: 'menu_not_found' }));

    const res = await request(app).post('/api/menu-analysis').field('restaurant_name', 'Nonexistent Ghost Diner');

    expect(res.status).toBe(404);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/restaurants/:id/menu-analysis', () => {
  it('returns the most recent completed analysis for a restaurant', async () => {
    mockCreate
      .mockResolvedValueOnce(
        textResponse({
          restaurant_name_detected: 'Test Bistro Get',
          items: [{ item_name: 'Lentil Soup', classification: 'vegetarian_safe', reasoning: 'Vegetable broth, lentils.', confidence: 'high' }],
          overall_note: 'Safe.',
        })
      )
      .mockResolvedValueOnce(textResponse({ found: false, address: null, cuisine_type: null }));

    const created = await request(app)
      .post('/api/menu-analysis')
      .field('restaurant_name', 'Test Bistro Get')
      .attach('image', fakeImage(), { filename: 'menu.jpg', contentType: 'image/jpeg' });

    const restaurantId = created.body.data.restaurant.restaurant_id;

    const res = await request(app).get(`/api/restaurants/${restaurantId}/menu-analysis`);
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('cache');
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].item_name).toBe('Lentil Soup');
  });

  it('returns 404 for a restaurant with no completed analysis', async () => {
    const { rows } = await pool.query('SELECT restaurant_id FROM restaurants WHERE name = $1', ['Cafecito Pilsen']);
    const res = await request(app).get(`/api/restaurants/${rows[0].restaurant_id}/menu-analysis`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a restaurant that does not exist', async () => {
    const res = await request(app).get('/api/restaurants/9999/menu-analysis');
    expect(res.status).toBe(404);
  });

  it('returns 400 for a malformed restaurant id', async () => {
    const res = await request(app).get('/api/restaurants/abc/menu-analysis');
    expect(res.status).toBe(400);
  });
});
