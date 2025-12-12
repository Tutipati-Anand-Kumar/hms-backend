class ApiError extends Error {
  constructor(statusCode = 500, message = "Internal Server Error", details = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
