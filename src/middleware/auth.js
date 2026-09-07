/**
 * JWT authentication middleware.
 * Reads token from httpOnly cookie (preferred) or Authorization header (fallback).
 * Verifies the token and attaches the user to req.user.
 *
 * Use requireVerified() AFTER authenticate() on routes that should only be
 * accessible to users with a verified email address.
 */

const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
  try {
    // 1. Try httpOnly cookie first (most secure)
    // 2. Fallback to Authorization: Bearer header (for mobile/external clients)
    let token = req.cookies?.token || null;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true, name: true, email: true, role: true, city: true,
        centerId: true,
        center: { select: { id: true, name: true, city: true } },
        isActive: true, emailVerified: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      // Clear invalid cookie
      res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
      return res.status(401).json({
        success: false,
        message: error.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid token.',
      });
    }
    logger.error({ err: error }, 'Auth middleware error');
    next(error);
  }
};

/**
 * Require a verified email address for the current route.
 * Must be used after authenticate().
 */
const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email not verified. Please verify your email to access this feature.',
    });
  }

  next();
};

/**
 * Role-based authorization middleware.
 * Must be used after authenticate.
 * Usage: authorize('ADMIN', 'PHARMACIST')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }

    next();
  };
};

module.exports = { authenticate, requireVerified, authorize };
