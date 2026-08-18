const express = require('express');
const multer = require('multer');
const asyncHandler = require('../utils/asyncHandler');
const validateIdParam = require('../middleware/validateIdParam');
const controller = require('../controllers/menuAnalysisController');
const ApiError = require('../utils/ApiError');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(ApiError.unsupportedMediaType('Only JPEG and PNG images are supported.'));
    }
    cb(null, true);
  },
});

// Mounted at /api in src/app.js (note: no extra prefix, unlike the other
// route files) — so the two paths below really are /api/menu-analysis and
// /api/restaurants/:id/menu-analysis.
const router = express.Router();

// POST /api/menu-analysis — called from js/api.js's analyzeMenu(), which is
// called from js/menuAnalyzer.js's runAnalysis() (both "Snap a Photo" and
// "Search by Name" tabs on menu-analyzer.html). `upload.single('image')`
// runs the multer fileFilter/size-limit checks (415/413) before the
// controller ever executes.
router.post('/menu-analysis', upload.single('image'), asyncHandler(controller.analyzeMenu));

// GET /api/restaurants/:id/menu-analysis — returns the most recent completed
// analysis for a restaurant (cache read, no AI call). Not wired into js/ yet;
// exercised via Postman/curl and backend/tests/menuAnalysis.test.js.
router.get(
  '/restaurants/:id/menu-analysis',
  validateIdParam('id'),
  asyncHandler(controller.getRestaurantMenuAnalysis)
);

module.exports = router;
