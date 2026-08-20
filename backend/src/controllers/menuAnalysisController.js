const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const { isNonEmptyString } = require('../utils/validators');
const aiMenuService = require('../services/aiMenuService');

const DISCLAIMER =
  'AI analysis of a menu photo cannot verify preparation methods or cross-contamination. Please confirm with restaurant staff.';

const ALLOWED_CLASSIFICATIONS = ['vegetarian_safe', 'safe_with_modification', 'doubtful', 'not_suitable'];
const ALLOWED_CONFIDENCE = ['high', 'medium', 'low'];

const RESTAURANT_COLUMNS = 'restaurant_id, name, address, cuisine_type, source, created_at';

const logRequest = async (endpoint, restaurantId, responseCode) => {
  try {
    await pool.query(
      'INSERT INTO analysis_requests (endpoint, restaurant_id, response_code) VALUES ($1, $2, $3)',
      [endpoint, restaurantId || null, responseCode]
    );
  } catch (err) {
    console.error('Failed to log analysis request:', err);
  }
};

const findRestaurantByName = async (name) => {
  const { rows } = await pool.query(
    `SELECT ${RESTAURANT_COLUMNS} FROM restaurants WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );
  return rows[0] || null;
};

const createRestaurant = async (name, address, cuisineType, source) => {
  const { rows: inserted } = await pool.query(
    'INSERT INTO restaurants (name, address, cuisine_type, source) VALUES ($1, $2, $3, $4) RETURNING restaurant_id',
    [name, address, cuisineType, source]
  );
  const { rows } = await pool.query(`SELECT ${RESTAURANT_COLUMNS} FROM restaurants WHERE restaurant_id = $1`, [
    inserted[0].restaurant_id,
  ]);
  return rows[0];
};

const getCompletedAnalysis = async (restaurantId) => {
  const { rows: analyses } = await pool.query(
    "SELECT analysis_id, restaurant_id, status, created_at FROM menu_analyses " +
      "WHERE restaurant_id = $1 AND status = 'completed' ORDER BY analysis_id DESC LIMIT 1",
    [restaurantId]
  );
  if (!analyses.length) return null;
  const analysis = analyses[0];

  const { rows: items } = await pool.query(
    'SELECT item_name, classification, reasoning, confidence FROM menu_analysis_items ' +
      'WHERE analysis_id = $1 ORDER BY analysis_item_id ASC',
    [analysis.analysis_id]
  );

  const { rows: restaurantRows } = await pool.query(
    `SELECT ${RESTAURANT_COLUMNS} FROM restaurants WHERE restaurant_id = $1`,
    [restaurantId]
  );

  return {
    analysis_id: analysis.analysis_id,
    restaurant: restaurantRows[0] || null,
    items,
    disclaimer: DISCLAIMER,
  };
};

const isValidAiResult = (aiResult) =>
  aiResult &&
  Array.isArray(aiResult.items) &&
  aiResult.items.length > 0 &&
  aiResult.items.every(
    (item) =>
      isNonEmptyString(item.item_name) &&
      ALLOWED_CLASSIFICATIONS.includes(item.classification) &&
      ALLOWED_CONFIDENCE.includes(item.confidence)
  );

// Shared by both the photo and name-only paths: persists the analysis and
// its items, logs the request, and assembles the response payload.
const persistAnalysis = async ({ endpoint, restaurant, items, source, extraFields }) => {
  const { rows: analysisRows } = await pool.query(
    'INSERT INTO menu_analyses (restaurant_id, status) VALUES ($1, $2) RETURNING analysis_id',
    [restaurant ? restaurant.restaurant_id : null, 'completed']
  );
  const analysisId = analysisRows[0].analysis_id;

  for (const item of items) {
    await pool.query(
      'INSERT INTO menu_analysis_items (analysis_id, item_name, classification, reasoning, confidence) VALUES ($1, $2, $3, $4, $5)',
      [analysisId, item.item_name, item.classification, item.reasoning || null, item.confidence]
    );
  }

  await logRequest(endpoint, restaurant ? restaurant.restaurant_id : null, 201);

  return {
    analysis_id: analysisId,
    restaurant,
    items,
    disclaimer: DISCLAIMER,
    source,
    ...(aiMenuService.MOCK_MODE ? { mock_mode: true } : {}),
    ...extraFields,
  };
};

// Photo mode: classify a menu image, optionally verifying/creating the
// restaurant via web search if a restaurant_name was given but not found.
const analyzeFromPhoto = async (req, res, { endpoint, restaurant, restaurantName, restaurantLocation }) => {
  let aiResult;
  try {
    const base64Data = req.file.buffer.toString('base64');
    aiResult = await aiMenuService.analyzeMenuImage(base64Data, req.file.mimetype);
  } catch (err) {
    console.error('Menu photo analysis failed:', err);
    await logRequest(endpoint, restaurant ? restaurant.restaurant_id : null, 502);
    throw ApiError.badGateway('Failed to analyze the menu image.');
  }

  if (aiResult && aiResult.error === 'not_a_menu') {
    await logRequest(endpoint, restaurant ? restaurant.restaurant_id : null, 422);
    throw ApiError.unprocessable('The uploaded image does not appear to be a menu.');
  }

  if (!isValidAiResult(aiResult)) {
    console.error('AI response failed schema validation:', aiResult);
    await logRequest(endpoint, restaurant ? restaurant.restaurant_id : null, 502);
    throw ApiError.badGateway('AI returned an unexpected response format.');
  }

  if (restaurantName && !restaurant) {
    let webResult = null;
    try {
      webResult = await aiMenuService.verifyRestaurant(restaurantName, restaurantLocation);
    } catch (err) {
      console.error('Restaurant web-search lookup failed:', err);
    }

    const found = Boolean(webResult && webResult.found);
    restaurant = await createRestaurant(
      restaurantName,
      found && webResult.address ? webResult.address : null,
      found && webResult.cuisine_type ? webResult.cuisine_type : null,
      found ? 'web_search' : 'user_submitted'
    );
  }

  const data = await persistAnalysis({
    endpoint,
    restaurant,
    items: aiResult.items,
    source: 'ai_analysis',
    extraFields: {
      restaurant_name_detected: aiResult.restaurant_name_detected || null,
      overall_note: aiResult.overall_note || null,
    },
  });

  res.status(201).json({ data });
};

// Name-only mode: no photo, so the menu itself is found and classified via
// a single web-search-enabled call.
const analyzeFromName = async (req, res, { endpoint, restaurant, restaurantName, restaurantLocation }) => {
  let aiResult;
  try {
    aiResult = await aiMenuService.findMenuByWebSearch(restaurantName, restaurantLocation);
  } catch (err) {
    console.error('Menu name search failed:', err);
    await logRequest(endpoint, restaurant ? restaurant.restaurant_id : null, 502);
    throw ApiError.badGateway('Failed to search for the menu.');
  }

  if (aiResult && aiResult.error === 'menu_not_found') {
    await logRequest(endpoint, restaurant ? restaurant.restaurant_id : null, 404);
    throw ApiError.notFound(`Couldn't find a menu for "${restaurantName}" online. Try uploading a photo instead.`);
  }

  if (!isValidAiResult(aiResult)) {
    console.error('AI response failed schema validation:', aiResult);
    await logRequest(endpoint, restaurant ? restaurant.restaurant_id : null, 502);
    throw ApiError.badGateway('AI returned an unexpected response format.');
  }

  if (!restaurant) {
    restaurant = await createRestaurant(restaurantName, null, null, 'web_search');
  }

  const data = await persistAnalysis({
    endpoint,
    restaurant,
    items: aiResult.items,
    source: 'ai_web_search',
    extraFields: {
      overall_note: aiResult.overall_note || null,
      menu_source_url: aiResult.menu_source_url || null,
    },
  });

  res.status(201).json({ data });
};

const analyzeMenu = async (req, res) => {
  const endpoint = req.originalUrl;
  const hasImage = Boolean(req.file);
  const restaurantName = isNonEmptyString(req.body.restaurant_name) ? req.body.restaurant_name.trim() : null;
  const restaurantLocation = isNonEmptyString(req.body.restaurant_location)
    ? req.body.restaurant_location.trim()
    : null;

  if (!hasImage && !restaurantName) {
    await logRequest(endpoint, null, 400);
    throw ApiError.badRequest('Provide a menu photo or a restaurant name.');
  }

  let restaurant = restaurantName ? await findRestaurantByName(restaurantName) : null;

  if (restaurant) {
    const cached = await getCompletedAnalysis(restaurant.restaurant_id);
    if (cached) {
      await logRequest(endpoint, restaurant.restaurant_id, 200);
      return res.status(200).json({ data: { ...cached, source: 'cache' } });
    }
  }

  const context = { endpoint, restaurant, restaurantName, restaurantLocation };
  return hasImage ? analyzeFromPhoto(req, res, context) : analyzeFromName(req, res, context);
};

const getRestaurantMenuAnalysis = async (req, res) => {
  const { id } = req.params;
  const cached = await getCompletedAnalysis(id);
  if (!cached) throw ApiError.notFound(`No completed menu analysis found for restaurant ${id}.`);
  res.status(200).json({ data: { ...cached, source: 'cache' } });
};

module.exports = {
  analyzeMenu,
  getRestaurantMenuAnalysis,
};
