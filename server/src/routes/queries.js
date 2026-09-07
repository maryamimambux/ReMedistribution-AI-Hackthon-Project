/**
 * Query / Support Ticket Routes
 */

const express = require('express');
const router = express.Router();
const {
  createQuery, getMyQueries,
  getAllQueries, replyToQuery, updateQueryStatus, getQueryById,
} = require('../controllers/queryController');
const { authenticate, requireVerified, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createQuerySchema, replyQuerySchema, queryStatusSchema } = require('../utils/validators');

// User routes
router.post('/', authenticate, requireVerified, validate(createQuerySchema), createQuery);
router.get('/my', authenticate, requireVerified, getMyQueries);

// Admin routes
router.get('/', authenticate, requireVerified, authorize('ADMIN'), getAllQueries);
router.get('/:id', authenticate, requireVerified, authorize('ADMIN'), getQueryById);
router.patch('/:id/reply', authenticate, requireVerified, authorize('ADMIN'), validate(replyQuerySchema), replyToQuery);
router.patch('/:id/status', authenticate, requireVerified, authorize('ADMIN'), validate(queryStatusSchema), updateQueryStatus);

module.exports = router;
