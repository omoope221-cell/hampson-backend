const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

// Run after an array of express-validator checks to collect and forward
// any validation errors as a single AppError.
module.exports = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors
      .array()
      .map((e) => e.msg)
      .join('. ');
    return next(new AppError(message, 400));
  }
  next();
};
