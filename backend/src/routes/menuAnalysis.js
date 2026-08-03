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

const router = express.Router();

router.post('/menu-analysis', upload.single('image'), asyncHandler(controller.analyzeMenu));
router.get(
  '/restaurants/:id/menu-analysis',
  validateIdParam('id'),
  asyncHandler(controller.getRestaurantMenuAnalysis)
);

module.exports = router;
