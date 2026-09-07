/**
 * Query / Support Ticket Controller
 * Users submit queries; admins reply and manage status.
 * Notifications are sent on create and reply.
 */

const prisma = require('../config/prisma');
const { asyncHandler } = require('../utils/asyncHandler');
const { createNotification } = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * POST /api/queries
 * Create a new support query (any authenticated user)
 */
const createQuery = asyncHandler(async (req, res) => {
  const { subject, message, priority = 'MEDIUM' } = req.body;
  const userId = req.user.id;

  const query = await prisma.query.create({
    data: {
      userId,
      subject,
      message,
      priority,
      status: 'OPEN',
    },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  // Notify admin(s) about new query
  const io = req.app.get('io');
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
  await Promise.all(
    admins.map((admin) =>
      createNotification(
        io,
        admin.id,
        'NEW_QUERY',
        'New Support Query',
        `${query.user.name} (${query.user.role}) submitted: ${subject}`,
        '/dashboard',
        { queryId: query.id, userId }
      )
    )
  );

  logger.info({ queryId: query.id, userId }, 'New query created');
  res.status(201).json({ success: true, message: 'Query submitted', data: query });
});

/**
 * GET /api/queries
 * List queries for the current user
 */
const getMyQueries = asyncHandler(async (req, res) => {
  const queries = await prisma.query.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  res.json({ success: true, data: queries });
});

/**
 * GET /api/admin/queries
 * List all queries (admin only)
 */
const getAllQueries = asyncHandler(async (req, res) => {
  const { status, priority, search, page = 1, limit = 20 } = req.query;

  const where = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { message: { contains: search, mode: 'insensitive' } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [queries, total] = await Promise.all([
    prisma.query.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, phone: true } },
      },
    }),
    prisma.query.count({ where }),
  ]);

  res.json({
    success: true,
    data: queries,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
});

/**
 * PATCH /api/admin/queries/:id/reply
 * Admin replies to a query
 */
const replyToQuery = asyncHandler(async (req, res) => {
  const { adminReply } = req.body;

  const query = await prisma.query.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!query) return res.status(404).json({ success: false, message: 'Query not found' });

  const updated = await prisma.query.update({
    where: { id: query.id },
    data: {
      adminReply,
      repliedById: req.user.id,
      repliedAt: new Date(),
      status: 'RESOLVED',
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  // Notify the user that admin has replied
  const io = req.app.get('io');
  await createNotification(
    io,
    query.userId,
    'QUERY_REPLIED',
    'Reply to Your Query',
    `Admin replied to: ${query.subject}`,
    '/my-queries',
    { queryId: query.id }
  );

  logger.info({ queryId: query.id, adminId: req.user.id }, 'Admin replied to query');
  res.json({ success: true, message: 'Reply sent', data: updated });
});

/**
 * PATCH /api/admin/queries/:id/status
 * Admin updates query status
 */
const updateQueryStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  const query = await prisma.query.update({
    where: { id: req.params.id },
    data: { status },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  logger.info({ queryId: query.id, status }, 'Query status updated');
  res.json({ success: true, message: 'Status updated', data: query });
});

/**
 * GET /api/admin/queries/:id
 * Get single query details (admin)
 */
const getQueryById = asyncHandler(async (req, res) => {
  const query = await prisma.query.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, phone: true } },
    },
  });

  if (!query) return res.status(404).json({ success: false, message: 'Query not found' });
  res.json({ success: true, data: query });
});

module.exports = {
  createQuery,
  getMyQueries,
  getAllQueries,
  replyToQuery,
  updateQueryStatus,
  getQueryById,
};
