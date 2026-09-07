/**
 * Notification Utility — Create notifications and broadcast via Socket.io
 * Used across controllers to notify users of important events
 */

const prisma = require('../config/prisma');
const logger = require('../utils/logger');

/**
 * Create a notification for a user and broadcast via socket
 * @param {object} io - Socket.io instance (from req.app.get('io'))
 * @param {string} userId - Target user ID
 * @param {string} type - Notification type
 * @param {string} title - Short title
 * @param {string} message - Notification body
 * @param {string} [link] - Deep link to related page
 * @param {object} [metadata] - Extra context as JSON
 */
async function createNotification(io, userId, type, title, message, link = null, metadata = null) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    // Broadcast real-time notification
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', notification);
    }

    return notification;
  } catch (err) {
    logger.error({ err, userId, type }, 'Notification creation failed');
    return null;
  }
}

module.exports = { createNotification };
