/**
 * Collection Center Routes
 */

const express = require('express');
const router = express.Router();
const {
  getCenters,
  getCenterById,
  getNearbyCenters,
  createCenter,
  updateCenter,
} = require('../controllers/centerController');
const { authenticate, requireVerified, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createCenterSchema } = require('../utils/validators');

router.get('/', getCenters);
router.get('/nearby', getNearbyCenters);
router.get('/:id', getCenterById);
router.post('/', authenticate, requireVerified, authorize('ADMIN'), validate(createCenterSchema), createCenter);
router.put('/:id', authenticate, requireVerified, authorize('ADMIN'), validate(createCenterSchema), updateCenter);

module.exports = router;
