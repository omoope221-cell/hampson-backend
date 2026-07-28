const express = require('express');
const authController = require('../controllers/authController');
const passwordController = require('../controllers/passwordController');
const { protect } = require('../middleware/auth');
const { restrictTo } = require('../middleware/rbac');
const { loginLimiter, otpRequestLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/login', loginLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', protect, authController.getMe);

// Per the "no forgot password, no self-service reset" policy: only the
// Super Admin portal supports self-service password recovery (OTP-based,
// below). Staff and Student accounts can only have their password changed
// by the Super Admin — see PATCH /users/:id/reset-password in userRoutes.js.
router.patch('/change-password', protect, restrictTo('super_admin'), authController.changePassword);

// Self-service OTP forgot-password flow — Super Admin and Parent accounts
// only. Each controller internally scopes the lookup to those two
// account types, so Staff/Student emails can never trigger or complete
// this flow even if submitted directly.
router.post('/forgot-password', otpRequestLimiter, passwordController.forgotPassword);
router.post('/verify-otp', otpVerifyLimiter, passwordController.verifyOtp);
router.post('/reset-password', otpVerifyLimiter, passwordController.resetPasswordWithOtp);

module.exports = router;