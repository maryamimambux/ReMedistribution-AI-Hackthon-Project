/**
 * Matching Routes
 */

const express = require('express');
const router = express.Router();
const {
  runMatching,
  getMatches,
  verifyPickup,
  verifyPickupByCode,
  completeMatch,
  getQRCode,
  findMatchForRequest,
  approveMatch,
} = require('../controllers/matchingController');
const { authenticate, requireVerified, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { verifyPickupSchema, verifyPickupByCodeSchema, approveMatchSchema } = require('../utils/validators');

// Per-request pharmacist flow: "Find Match" preview + "Approve & Generate Pickup Code"
router.get('/request/:requestId/candidates', authenticate, requireVerified, authorize('PHARMACIST', 'ADMIN'), findMatchForRequest);
router.post('/request/:requestId/approve', authenticate, requireVerified, authorize('PHARMACIST', 'ADMIN'), validate(approveMatchSchema), approveMatch);

// Verify a pickup by the 6-digit code alone (manual entry or decoded QR scan)
router.post('/verify-code', authenticate, requireVerified, authorize('PHARMACIST', 'ADMIN'), validate(verifyPickupByCodeSchema), verifyPickupByCode);

// Bulk matching + match listing
router.post('/run', authenticate, requireVerified, authorize('PHARMACIST', 'ADMIN'), runMatching);
router.get('/', authenticate, requireVerified, getMatches);

router.patch('/:id/pickup', authenticate, requireVerified, authorize('PHARMACIST', 'ADMIN'), validate(verifyPickupSchema), verifyPickup);
router.patch('/:id/complete', authenticate, requireVerified, authorize('PHARMACIST', 'ADMIN'), completeMatch);
router.get('/:id/qrcode', authenticate, requireVerified, getQRCode);

module.exports = router;
