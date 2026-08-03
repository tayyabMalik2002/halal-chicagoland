class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message, details = null) {
    return new ApiError(400, message, details);
  }

  static notFound(message) {
    return new ApiError(404, message);
  }

  static conflict(message) {
    return new ApiError(409, message);
  }

  static unsupportedMediaType(message) {
    return new ApiError(415, message);
  }

  static unprocessable(message, details = null) {
    return new ApiError(422, message, details);
  }

  static badGateway(message, details = null) {
    return new ApiError(502, message, details);
  }
}

module.exports = ApiError;
