const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const recordAudit = require('../utils/audit');
const { generateOtp, hashOtp, compareOtp } = require('../utils/otp');
const { sendEmail } = require('../utils/email');
const { otpTemplate, passwordResetSuccessTemplate } = require('../utils/emailTemplates');
const { passwordStrengthError } = require('../utils/validatePassword');

const OTP_TTL_MINUTES = 10;

// Per the school's password policy: only Super Admin and Parent accounts
// support self-service password recovery. Staff and Student accounts can
// only be reset by a Super Admin from the Password Management dashboard
// — see userController.adminResetPassword.
const SELF_SERVICE_ACCOUNT_TYPES = ['super_admin', 'parent'];

// POST /api/v1/auth/forgot-password  { email }  — Admin & Parent only
exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  if (!email) return next(new AppError('Please provide your registered email address.', 400));

  const user = await User.findOne({ email: email.toLowerCase(), accountType: { $in: SELF_SERVICE_ACCOUNT_TYPES } });

  // Always respond the same way whether or not the account exists, so the
  // endpoint can't be used to enumerate valid admin emails.
  if (user) {
    const otp = generateOtp();
    user.otpCodeHash = hashOtp(otp);
    user.otpExpires = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    user.otpVerified = false;
    user.otpLastSentAt = new Date();
    user.otpAttempts = 0;
    await user.save({ validateBeforeSave: false });

    const { subject, html } = otpTemplate({ fullName: user.fullName, otp, minutes: OTP_TTL_MINUTES });
    await sendEmail({ to: user.email, toName: user.fullName, subject, html }).catch(() => {});

    await recordAudit({
      actor: user._id, accountType: user.accountType, action: 'auth.forgot_password_requested',
      targetModel: 'User', targetId: user._id, ip: req.ip, userAgent: req.headers['user-agent'],
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'If that email is registered, a verification code has been sent.',
  });
});

// POST /api/v1/auth/verify-otp  { email, otp }  — Admin & Parent only
exports.verifyOtp = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body;
  if (!email || !otp) return next(new AppError('Please provide your email and the verification code.', 400));

  const user = await User.findOne({ email: email.toLowerCase(), accountType: { $in: SELF_SERVICE_ACCOUNT_TYPES } })
    .select('+otpCodeHash +otpExpires +otpVerified +otpAttempts');

  if (!user || !user.otpCodeHash || !user.otpExpires || user.otpExpires < new Date()) {
    return next(new AppError('That code is invalid or has expired. Please request a new one.', 400));
  }

  if (user.otpAttempts >= 5) {
    return next(new AppError('Too many incorrect attempts. Please request a new code.', 429));
  }

  if (!compareOtp(otp, user.otpCodeHash)) {
    user.otpAttempts = (user.otpAttempts || 0) + 1;
    await user.save({ validateBeforeSave: false });
    return next(new AppError('Incorrect verification code.', 400));
  }

  // Verified — keep the window open a little longer for the final
  // "set new password" step, without allowing the same code to be reused
  // indefinitely.
  user.otpVerified = true;
  user.otpExpires = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  user.otpAttempts = 0;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ status: 'success', message: 'Code verified. You may now set a new password.' });
});

// POST /api/v1/auth/reset-password  { email, otp, newPassword }  — Admin & Parent only
exports.resetPasswordWithOtp = catchAsync(async (req, res, next) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return next(new AppError('Please provide your email, verification code, and new password.', 400));
  }

  const strengthError = passwordStrengthError(newPassword);
  if (strengthError) return next(new AppError(strengthError, 400));

  const user = await User.findOne({ email: email.toLowerCase(), accountType: { $in: SELF_SERVICE_ACCOUNT_TYPES } })
    .select('+otpCodeHash +otpExpires +otpVerified +passwordHash');

  if (!user || !user.otpVerified || !user.otpCodeHash || !user.otpExpires || user.otpExpires < new Date()) {
    return next(new AppError('Your verification session has expired. Please start again.', 400));
  }

  if (!compareOtp(otp, user.otpCodeHash)) {
    return next(new AppError('Incorrect verification code.', 400));
  }

  user.passwordHash = newPassword; // re-hashed by the pre-save hook
  user.mustChangePassword = false;
  user.tokenVersion = (user.tokenVersion || 0) + 1; // invalidate any existing sessions
  user.otpCodeHash = undefined;
  user.otpExpires = undefined;
  user.otpVerified = false;
  user.otpAttempts = 0;
  await user.save();

  const { subject, html } = passwordResetSuccessTemplate({ fullName: user.fullName });
  await sendEmail({ to: user.email, toName: user.fullName, subject, html }).catch(() => {});

  await recordAudit({
    actor: user._id, accountType: user.accountType, action: 'auth.forgot_password_reset',
    targetModel: 'User', targetId: user._id, ip: req.ip, userAgent: req.headers['user-agent'],
  });

  res.status(200).json({ status: 'success', message: 'Your password has been reset. You can now log in.' });
});
