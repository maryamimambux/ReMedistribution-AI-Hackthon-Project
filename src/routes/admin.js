/**
 * Admin Routes — User management, detailed records, exports
 */

const express = require('express');
const router = express.Router();
const {
  getAllUsers, updateUserStatus, updateUserRole,
  getAllDonations, getAllRequests, getAllCenters,
  getAdminExportData, sendAnnouncement,
} = require('../controllers/adminController');
const { authenticate, requireVerified, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { announcementSchema } = require('../utils/validators');

router.use(authenticate, requireVerified, authorize('ADMIN'));

router.get('/users', getAllUsers);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id/role', updateUserRole);

router.get('/donations', getAllDonations);
router.get('/requests', getAllRequests);
router.get('/centers', getAllCenters);

router.get('/export', getAdminExportData);

router.post('/announce', validate(announcementSchema), sendAnnouncement);

module.exports = router;
