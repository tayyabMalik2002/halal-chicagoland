// Mounted at /api/reports in src/app.js — paths below are relative to that.
// Read-only admin reporting; not called from js/ yet. Exercised via
// Postman/curl and backend/tests/reports.test.js.
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/reportsController');

const router = express.Router();

router.get('/daily-totals', asyncHandler(controller.dailyTotals));   // GET /api/reports/daily-totals  (?date) — excludes cancelled orders from revenue
router.get('/popular-items', asyncHandler(controller.popularItems)); // GET /api/reports/popular-items  (?limit)

module.exports = router;
