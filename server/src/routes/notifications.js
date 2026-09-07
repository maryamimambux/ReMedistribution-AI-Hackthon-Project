/**
 * Notification Routes
 */

const express = require('express');
const router = express.Router();
const { getNotifications, getUnreadCount, markAsRead, markAllAsRead } = require('../controllers/notificationController');
const { authenticate, requireVerified } = require('../middleware/auth');

router.use(authenticate, requireVerified);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);

module.exports = router;
