/**
 * Inventory Routes
 */

const express = require('express');
const router = express.Router();
const {
  getInventory,
  getInventoryByCenter,
  getExpiryRisk,
  updateInventoryStatus,
} = require('../controllers/inventoryController');
const { authenticate, requireVerified, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { updateInventoryStatusSchema } = require('../utils/validators');

router.get('/', authenticate, requireVerified, getInventory);
router.get('/center/:centerId', authenticate, requireVerified, getInventoryByCenter);
router.get('/expiry-risk', authenticate, requireVerified, getExpiryRisk);
router.patch('/:id/status', authenticate, requireVerified, authorize('PHARMACIST', 'ADMIN'), validate(updateInventoryStatusSchema), updateInventoryStatus);

module.exports = router;
