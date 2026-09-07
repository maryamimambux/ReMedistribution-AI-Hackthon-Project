/**
 * Auth Controller — Registration, Login, Profile, Email Verification, Password Reset
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const { asyncHandler } = require('../utils/asyncHandler');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const logger = require('../utils/logger');

// Cookie options — httpOnly, secure in production, same-site lax for dev
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

// Generate JWT token
const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, cnic, address, city, lat, lng, centerId } = req.body;

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: 'Email already registered',
    });
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Generate verification code
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

  // Create user
  const user = await prisma.user.create({
    data: {
      name, email, password: hashedPassword, role, phone, cnic, address, city,
      lat: lat ?? null, lng: lng ?? null,
      centerId: centerId || null,
      verificationCode, verificationCodeExpiry,
    },
    select: {
      id: true, name: true, email: true, role: true, phone: true,
      city: true, centerId: true,
      center: { select: { id: true, name: true, city: true } },
      emailVerified: true, createdAt: true,
    },
  });

  // Send verification email
  const emailResult = await sendVerificationEmail(email, verificationCode);

  // In production, do not create an account if the verification email cannot be delivered.
  if (!emailResult.success && process.env.NODE_ENV === 'production') {
    await prisma.user.delete({ where: { id: user.id } });
    return res.status(500).json({
      success: false,
      message: emailResult.message || 'Failed to send verification email. Please try again later.',
    });
  }

  const token = generateToken(user.id, user.role);

  // Set httpOnly cookie
  res.cookie('token', token, cookieOptions);

  logger.info({ userId: user.id, role: user.role }, 'User registered');

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please verify your email.',
    data: { user, token },
  });
});

/**
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { center: { select: { id: true, name: true, city: true } } },
  });
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account is deactivated' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  const token = generateToken(user.id, user.role);

  // Set httpOnly cookie
  res.cookie('token', token, cookieOptions);

  logger.info({ userId: user.id, role: user.role }, 'User logged in');

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        phone: user.phone, city: user.city, centerId: user.centerId,
        center: user.center,
        emailVerified: user.emailVerified,
      },
      token,
    },
  });
});

/**
 * POST /api/auth/logout
 * Clear the httpOnly cookie
 */
const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
  });

  logger.info({ userId: req.user?.id }, 'User logged out');

  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/auth/profile  (also /api/auth/me)
 */
const getProfile = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true, name: true, email: true, role: true, phone: true, cnic: true,
      address: true, city: true, lat: true, lng: true, avatarUrl: true,
      centerId: true,
      center: { select: { id: true, name: true, city: true } },
      emailVerified: true, isActive: true, createdAt: true,
      _count: { select: { donations: true, patientRequests: true } },
    },
  });

  res.json({ success: true, data: user });
});

/**
 * PUT /api/auth/profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, address, city, lat, lng, centerId } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(name && { name }),
      ...(phone && { phone }),
      ...(address && { address }),
      ...(city && { city }),
      ...(centerId !== undefined && { centerId: centerId || null }),
      ...(lat !== undefined && { lat: parseFloat(lat) }),
      ...(lng !== undefined && { lng: parseFloat(lng) }),
    },
    select: {
      id: true, name: true, email: true, role: true, phone: true, address: true, city: true,
      centerId: true,
      center: { select: { id: true, name: true, city: true } },
    },
  });

  res.json({ success: true, message: 'Profile updated', data: user });
});

/**
 * POST /api/auth/verify-email
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const { code } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.user?.id || null } });
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (user.emailVerified) {
    return res.json({ success: true, message: 'Email already verified' });
  }

  if (user.verificationCode !== code) {
    return res.status(400).json({ success: false, message: 'Invalid verification code' });
  }

  if (user.verificationCodeExpiry && new Date(user.verificationCodeExpiry) < new Date()) {
    return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationCode: null, verificationCodeExpiry: null },
  });

  res.json({ success: true, message: 'Email verified successfully' });
});

/**
 * POST /api/auth/resend-verification
 */
const resendVerification = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (user.emailVerified) return res.json({ success: true, message: 'Email already verified' });

  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  const verificationCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { verificationCode, verificationCodeExpiry },
  });

  const emailResult = await sendVerificationEmail(user.email, verificationCode);
  if (!emailResult.success) {
    return res.status(500).json({
      success: false,
      message: emailResult.message || 'Failed to send verification email. Please try again later.',
    });
  }

  res.json({ success: true, message: 'Verification code sent to your email' });
});

/**
 * POST /api/auth/forgot-password
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.json({ success: true, message: 'If the email exists, a reset link has been sent.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const resetLink = `${clientUrl}/reset-password?token=${token}`;
  const emailResult = await sendPasswordResetEmail(email, resetLink);

  if (!emailResult.success) {
    return res.status(500).json({
      success: false,
      message: emailResult.message || 'Failed to send password reset email. Please try again later.',
    });
  }

  res.json({ success: true, message: 'If the email exists, a reset link has been sent.' });
});

/**
 * POST /api/auth/reset-password
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken) return res.status(400).json({ success: false, message: 'Invalid or expired reset link' });
  if (resetToken.usedAt) return res.status(400).json({ success: false, message: 'This reset link has already been used' });
  if (new Date(resetToken.expiresAt) < new Date()) return res.status(400).json({ success: false, message: 'Reset link has expired. Please request a new one.' });

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  await prisma.user.update({ where: { id: resetToken.userId }, data: { password: hashedPassword } });
  await prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } });

  res.json({ success: true, message: 'Password reset successfully. Please log in.' });
});

/**
 * PUT /api/auth/change-password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);
  await prisma.user.update({ where: { id: req.user.id }, data: { password: hashedPassword } });

  res.json({ success: true, message: 'Password changed successfully' });
});

module.exports = {
  register, login, logout, getProfile, updateProfile,
  verifyEmail, resendVerification,
  forgotPassword, resetPassword, changePassword,
};
