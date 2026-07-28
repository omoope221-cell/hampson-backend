const AppError = require('../utils/AppError');

// Restrict a route to one or more top-level account types.
// e.g. restrictTo('super_admin'), restrictTo('super_admin', 'staff')
exports.restrictTo = (...accountTypes) => (req, res, next) => {
  if (!req.user || !accountTypes.includes(req.user.accountType)) {
    return next(new AppError('You do not have permission to perform this action.', 403));
  }
  next();
};

// Restrict a route to staff holding specific sub-roles.
// e.g. restrictToStaffRole('accountant', 'bursar')
exports.restrictToStaffRole = (...roles) => (req, res, next) => {
  if (req.user?.accountType === 'super_admin') return next();
  if (req.user?.accountType !== 'staff' || !roles.includes(req.user.staffRole)) {
    return next(new AppError('You do not have permission to perform this action.', 403));
  }
  next();
};

// Fine-grained permission check, e.g. requirePermission('fees.create').
// Super admins always pass.
exports.requirePermission = (...permissions) => (req, res, next) => {
  if (!req.user) return next(new AppError('Not authenticated.', 401));
  if (req.user.accountType === 'super_admin') return next();

  const owned = req.user.permissions || [];
  const hasAll = permissions.every((p) => owned.includes(p));
  if (!hasAll) {
    return next(new AppError('You do not have permission to perform this action.', 403));
  }
  next();
};
