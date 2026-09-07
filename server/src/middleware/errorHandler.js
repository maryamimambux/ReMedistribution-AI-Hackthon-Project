/**
 * Global error handler middleware.
 * Catches all errors and returns a consistent JSON response.
 * Uses Pino for structured logging.
 */

const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Log with context
  logger.error({
    err: { message: err.message, stack: err.stack },
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  }, 'Request error');

  // Prisma known errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'A record with this value already exists',
      field: err.meta?.target?.join(', '),
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Record not found',
    });
  }

  // Validation errors from Zod (shouldn't reach here since validate middleware handles it)
  if (err.type === 'validation') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors,
    });
  }

  // JWT errors (also handled in auth middleware, but as a safety net)
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' });
  }

  // Multer file size errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File too large. Maximum size is 5MB.' });
  }

  // Default server error — never leak internals in production
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { errorHandler };
