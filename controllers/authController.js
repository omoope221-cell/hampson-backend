const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshCookieOptions,
} = require('../utils/tokens');
const recordAudit = require('../utils/audit');
const { passwordStrengthError } = require('../utils/validatePassword');

function sendAuthResponse(res, user, statusCode = 200) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  res.cookie('refreshToken', refreshToken, refreshCookieOptions());

  res.status(statusCode).json({
    status: 'success',
    accessToken,
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      accountType: user.accountType,
      staffRole: user.staffRole,
      permissions: user.getPermissions(),
      profilePicture: user.profilePicture,
      mustChangePassword: user.mustChangePassword,
      studentProfile: user.studentProfile,
      staffProfile: user.staffProfile,
      parentProfile: user.parentProfile,
    },
  });
}

// POST /api/v1/auth/login
// Body: { accountType, identifier (email or username), password }
// The client's role-selector screen sets `accountType` before this call.
exports.login = catchAsync(async (req, res, next) => {
  const { accountType, identifier, password } = req.body;
  const ip = req.ip;
  const userAgent = req.headers['user-agent'];

  if (!accountType || !identifier || !password) {
    return next(new AppError('Please select an account type and provide credentials.', 400));
  }

  const query = {
    $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
    accountType,
  };

  const user = await User.findOne(query).select('+passwordHash');

  if (!user || !(await user.comparePassword(password))) {
    await recordAudit({
      attemptedEmail: identifier,
      accountType,
      action: 'auth.login_failed',
      success: false,
      reason: 'invalid_credentials',
      ip,
      userAgent,
    });
    return next(new AppError('Incorrect credentials or account type selected.', 401));
  }

  if (user.status !== 'active') {
    await recordAudit({
      actor: user._id,
      accountType,
      action: 'auth.login_failed',
      success: false,
      reason: 'account_suspended',
      ip,
      userAgent,
    });
    return next(new AppError('This account has been suspended. Contact the school administrator.', 403));
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  await recordAudit({
    actor: user._id,
    accountType: user.accountType,
    action: 'auth.login',
    targetModel: 'User',
    targetId: user._id,
    ip,
    userAgent,
  });

  sendAuthResponse(res, user);
});

// POST /api/v1/auth/refresh
// Reads the httpOnly refresh cookie and issues a new access token.
exports.refresh = catchAsync(async (req, res, next) => {
  const token = req.cookies?.refreshToken;
  if (!token) return next(new AppError('No refresh token provided.', 401));

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch (err) {
    return next(new AppError('Invalid or expired refresh token. Please log in again.', 401));
  }

  const user = await User.findById(decoded.sub);
  if (!user || user.status !== 'active') {
    return next(new AppError('Session no longer valid. Please log in again.', 401));
  }
  if ((user.tokenVersion || 0) !== decoded.tokenVersion) {
    return next(new AppError('Session has been revoked. Please log in again.', 401));
  }

  sendAuthResponse(res, user);
});

// POST /api/v1/auth/logout
exports.logout = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      const decoded = verifyRefreshToken(token);
      await recordAudit({
        actor: decoded.sub,
        action: 'auth.logout',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } catch {
      // Expired/invalid refresh token on logout is fine — nothing to log.
    }
  }
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  res.status(200).json({ status: 'success', message: 'Logged out.' });
});

// GET /api/v1/auth/me
exports.getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id)
    .populate({
      path: 'studentProfile',
      populate: [
        { path: 'class', select: 'name arm section' },
        { path: 'session', select: 'name' },
      ],
    })
    .populate('staffProfile')
    .populate('parentProfile');
  res.status(200).json({ status: 'success', data: user.toSafeJSON() });
});

// PATCH /api/v1/auth/change-password
exports.changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return next(new AppError('Please provide your current and new password.', 400));
  }
  const strengthError = passwordStrengthError(newPassword);
  if (strengthError) return next(new AppError(strengthError, 400));

  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!(await user.comparePassword(currentPassword))) {
    return next(new AppError('Current password is incorrect.', 401));
  }

  user.passwordHash = newPassword; // re-hashed by pre-save hook
  user.mustChangePassword = false;
  user.tokenVersion = (user.tokenVersion || 0) + 1; // invalidate old refresh tokens
  await user.save();

  await recordAudit({
    actor: user._id,
    accountType: user.accountType,
    action: 'auth.change_password',
    targetModel: 'User',
    targetId: user._id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  sendAuthResponse(res, user);
});

// Every 401 the client gets from an expired access token should first
// try POST /auth/refresh silently before forcing a re-login — that flow
// lives on the frontend; this controller just supports it.
