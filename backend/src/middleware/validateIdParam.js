const ApiError = require('../utils/ApiError');

// Ensures a route param is a positive integer before it reaches the controller.
const validateIdParam = (paramName) => (req, res, next) => {
  const raw = req.params[paramName];
  if (!/^\d+$/.test(raw)) {
    return next(ApiError.badRequest(`${paramName} must be a positive integer.`));
  }
  req.params[paramName] = Number(raw);
  next();
};

module.exports = validateIdParam;
