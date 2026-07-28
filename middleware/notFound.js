const AppError = require('../utils/AppError');

module.exports = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};
