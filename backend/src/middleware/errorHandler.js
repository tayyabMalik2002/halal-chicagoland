const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  // MySQL foreign key / constraint errors
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({
      error: { message: 'Referenced record does not exist (invalid foreign key).' },
    });
  }
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
    return res.status(409).json({
      error: { message: 'This record cannot be deleted because other records depend on it.' },
    });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: { message: 'A record with this value already exists.' },
    });
  }

  console.error(err);
  return res.status(500).json({
    error: { message: 'Internal server error.' },
  });
};

module.exports = errorHandler;
