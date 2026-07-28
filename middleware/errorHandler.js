const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

function handleCastError(err) {
  return new AppError(`Invalid ${err.path}: ${err.value}`, 400);
}

function handleDuplicateFieldsError(err) {
  const field = Object.keys(err.keyValue || {})[0];
  const value = err.keyValue?.[field];
  return new AppError(`Duplicate value for '${field}': '${value}'. Please use another value.`, 409);
}

function handleValidationError(err) {
  const messages = Object.values(err.errors).map((el) => el.message);
  return new AppError(`Invalid input: ${messages.join('. ')}`, 400);
}

function handleJWTError() {
  return new AppError('Invalid token. Please log in again.', 401);
}

function handleJWTExpired() {
  return new AppError('Your session has expired. Please log in again.', 401);
}

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);
  error.message = err.message;

  if (err.name === 'CastError') error = handleCastError(err);
  if (err.code === 11000) error = handleDuplicateFieldsError(err);
  if (err.name === 'ValidationError') error = handleValidationError(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpired();

  if (!error.isOperational) {
    logger.error(err);
  }

  res.status(error.statusCode).json({
    status: error.status,
    message: error.isOperational ? error.message : 'Something went wrong on our end.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
