/**
 * Donation Routes
 */

const express = require('express');
const router = express.Router();
const {
  createDonation,
  getDonations,
  getDonationById,
  updateDonation,
  deleteDonation,
  verifyDonation,
  getDonorDonations,
  getDonationVerifications,
} = require('../controllers/donationController');
const { authenticate, requireVerified, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { validate } = require('../middleware/validate');
const { verifyDonationSchema, updateDonationSchema } = require('../utils/validators');

router.post('/', authenticate, requireVerified, authorize('DONOR'), upload.array('photos', 4), createDonation);
router.get('/', authenticate, requireVerified, getDonations);
router.get('/my-donations', authenticate, requireVerified, authorize('DONOR'), getDonorDonations);
router.get('/:id', authenticate, requireVerified, getDonationById);
router.patch('/:id', authenticate, requireVerified, authorize('DONOR'), validate(updateDonationSchema), updateDonation);
router.delete('/:id', authenticate, requireVerified, authorize('DONOR'), deleteDonation);
router.patch('/:id/verify', authenticate, requireVerified, authorize('PHARMACIST', 'ADMIN'), validate(verifyDonationSchema), verifyDonation);
router.get('/:id/verifications', authenticate, requireVerified, authorize('PHARMACIST', 'ADMIN'), getDonationVerifications);

module.exports = router;
