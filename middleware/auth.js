const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { verifyAccessToken } = require('../utils/tokens');
const User = require('../models/User');

// Verifies the Bearer access token and attaches `req.user` (a lean auth
// payload) for downstream RBAC checks. Does NOT hit the DB on every
// request except to confirm the account is still active — keeps things
// fast while still respecting suspensions in near-real time.
exports.protect = catchAsync(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in. Please log in to continue.', 401));
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    return next(new AppError('Invalid or expired session. Please log in again.', 401));
  }

  const user = await User.findById(decoded.sub);
  if (!user) {
    return next(new AppError('The account belonging to this session no longer exists.', 401));
  }
  if (user.status !== 'active') {
    return next(new AppError('This account has been suspended or deactivated.', 403));
  }

  req.user = {
    id: user._id.toString(),
    accountType: user.accountType,
    staffRole: user.staffRole,
    permissions: user.getPermissions(),
    studentProfile: user.studentProfile,
    staffProfile: user.staffProfile,
    parentProfile: user.parentProfile,
    doc: user,
  };

  next();
});
