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

  // Multer upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: { message: 'Image exceeds the maximum allowed size of 10MB.' },
    });
  }

  // Postgres foreign key violation (SQLSTATE 23503) covers both directions;
  // distinguish by message since pg uses one code for both cases.
  if (err.code === '23503') {
    if (err.detail && err.detail.includes('is still referenced from table')) {
      return res.status(409).json({
        error: { message: 'This record cannot be deleted because other records depend on it.' },
      });
    }
    return res.status(400).json({
      error: { message: 'Referenced record does not exist (invalid foreign key).' },
    });
  }
  // Postgres unique violation
  if (err.code === '23505') {
    return res.status(409).json({
      error: { message: 'A record with this value already exists.' },
    });
  }

  // express.json()/body-parser errors (malformed JSON body, payload too
  // large, wrong content-type, etc.) set err.status/err.expose themselves
  // via the `http-errors` package — expose is only true for 4xx, so this is
  // always safe to forward to the client as-is, unlike a raw stack trace.
  if (err.status && err.status < 500 && err.expose) {
    return res.status(err.status).json({
      error: { message: err.message },
    });
  }

  console.error(err);
  return res.status(500).json({
    error: { message: 'Internal server error.' },
  });
};

module.exports = errorHandler;
