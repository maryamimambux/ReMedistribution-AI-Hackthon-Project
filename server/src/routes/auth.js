/**
 * Auth Routes — Register, Login, Verify, Reset
 */

const express = require('express');
const router = express.Router();
const {
  register, login, getProfile, updateProfile,
  verifyEmail, resendVerification,
  forgotPassword, resetPassword, changePassword, logout,
} = require('../controllers/authController');
const { authenticate, requireVerified } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  registerSchema, loginSchema, updateProfileSchema,
  changePasswordSchema, verifyEmailSchema,
  forgotPasswordSchema, resetPasswordSchema,
} = require('../utils/validators');

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);
router.get('/me', authenticate, getProfile);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, requireVerified, validate(updateProfileSchema), updateProfile);
router.put('/change-password', authenticate, requireVerified, validate(changePasswordSchema), changePassword);

// Email verification
router.post('/verify-email', authenticate, validate(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', authenticate, resendVerification);

// Password reset
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

module.exports = router;
