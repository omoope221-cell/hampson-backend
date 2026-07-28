const rateLimit = require('express-rate-limit');

// General API limiter — applied globally.
exports.apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many requests. Please try again later.' },
});

// Tighter limiter for the login endpoint to slow down credential stuffing.
exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many login attempts. Please try again in 15 minutes.' },
});

// Forgot-password code requests: generous enough for a genuine retry,
// tight enough to blunt spam/enumeration.
exports.otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many code requests. Please try again in 15 minutes.' },
});

// Verifying a code: slow down brute-forcing the 6-digit OTP itself.
exports.otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Too many attempts. Please try again in 15 minutes.' },
});
