const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/reportsController');

const router = express.Router();

router.get('/daily-totals', asyncHandler(controller.dailyTotals));
router.get('/popular-items', asyncHandler(controller.popularItems));

module.exports = router;
