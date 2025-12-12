import ApiError from "../utils/ApiError.js";

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const notFound = (req, res, next) => {
  next(new ApiError(404, `Not Found - ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Log for server-side inspection
  if (process.env.NODE_ENV === "development") {
    console.error(err);
  } else if (!err.isOperational) {
    // Unexpected error — still log
    console.error(err);
  }

  const payload = {
    success: false,
    message,
  };

  if (err.details) payload.details = err.details;
  if (process.env.NODE_ENV === "development" && err.stack) payload.stack = err.stack;

  res.status(statusCode).json(payload);
};

export default asyncHandler;
export { notFound, errorHandler };
