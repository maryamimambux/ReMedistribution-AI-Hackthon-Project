/**
 * Patient Routes
 */

const express = require('express');
const router = express.Router();
const {
  createRequest,
  getMyRequests,
  getRequestById,
  updateRequest,
  deleteRequest,
  getAllRequests,
  chatbotRequest,
} = require('../controllers/patientController');
const { authenticate, requireVerified, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createRequestSchema, updateRequestSchema, chatbotRequestSchema } = require('../utils/validators');

router.post('/', authenticate, requireVerified, authorize('PATIENT'), validate(createRequestSchema), createRequest);
router.post('/chat', authenticate, requireVerified, validate(chatbotRequestSchema), chatbotRequest);
router.get('/my-requests', authenticate, requireVerified, authorize('PATIENT'), getMyRequests);
router.get('/', authenticate, requireVerified, authorize('PHARMACIST', 'ADMIN'), getAllRequests);
router.get('/:id', authenticate, requireVerified, getRequestById);
router.patch('/:id', authenticate, requireVerified, authorize('PATIENT'), validate(updateRequestSchema), updateRequest);
router.delete('/:id', authenticate, requireVerified, authorize('PATIENT'), deleteRequest);

module.exports = router;
