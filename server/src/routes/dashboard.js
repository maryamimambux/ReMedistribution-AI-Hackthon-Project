/**
 * Dashboard Routes
 */

const express = require('express');
const router = express.Router();
const { getDashboardStats, getSystemOverview, getExportData } = require('../controllers/dashboardController');
const { authenticate, requireVerified, authorize } = require('../middleware/auth');

router.get('/', authenticate, requireVerified, getDashboardStats);
router.get('/overview', authenticate, requireVerified, authorize('ADMIN'), getSystemOverview);
router.get('/export', authenticate, requireVerified, authorize('ADMIN'), getExportData);

module.exports = router;
