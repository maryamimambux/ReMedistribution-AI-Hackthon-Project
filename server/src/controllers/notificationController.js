/**
 * Notification Controller — User notification management
 */

const prisma = require('../config/prisma');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * GET /api/notifications
 * List current user's notifications (paginated)
 */
const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;

  const where = { userId: req.user.id };
  if (unreadOnly === 'true') where.isRead = false;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
  ]);

  res.json({
    success: true,
    data: notifications,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * GET /api/notifications/unread-count
 * Quick unread count for bell badge
 */
const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await prisma.notification.count({
    where: { userId: req.user.id, isRead: false },
  });

  res.json({ success: true, data: { count } });
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.id },
    data: { isRead: true },
  });

  res.json({ success: true, message: 'Notification marked as read', data: notification });
});

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for current user
 */
const markAllAsRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true },
  });

  res.json({ success: true, message: 'All notifications marked as read' });
});

module.exports = { getNotifications, getUnreadCount, markAsRead, markAllAsRead };
