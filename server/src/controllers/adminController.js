/**
 * Admin Controller
 * Comprehensive admin operations: users, queries, detailed records, record keeping.
 */

const prisma = require('../config/prisma');
const { asyncHandler } = require('../utils/asyncHandler');
const { createNotification } = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * GET /api/admin/users
 * List all users with role and status filters
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const { role, status, search, page = 1, limit = 50 } = req.query;

  const where = {};
  if (role) where.role = role;
  if (status === 'active') where.isActive = true;
  if (status === 'inactive') where.isActive = false;
  if (status === 'pending') {
    where.emailVerified = false;
    where.isActive = true;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, role: true, phone: true,
        city: true, address: true, isActive: true, emailVerified: true,
        createdAt: true, updatedAt: true,
        _count: { select: { donations: true, patientRequests: true, queries: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    success: true,
    data: users,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
});

/**
 * PATCH /api/admin/users/:id/status
 * Activate or deactivate a user
 */
const updateUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  logger.info({ userId: user.id, isActive }, 'User status updated by admin');
  res.json({ success: true, message: `User ${isActive ? 'activated' : 'deactivated'}`, data: user });
});

/**
 * PATCH /api/admin/users/:id/role
 * Change user role (rare, but useful)
 */
const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  const validRoles = ['DONOR', 'PHARMACIST', 'PATIENT', 'ADMIN'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ success: false, message: `Role must be one of: ${validRoles.join(', ')}` });
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });

  logger.info({ userId: user.id, role }, 'User role updated by admin');
  res.json({ success: true, message: 'Role updated', data: user });
});

/**
 * GET /api/admin/donations
 * All donations with full donor, medicine, and center details
 */
const getAllDonations = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.query;

  const where = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { medicine: { name: { contains: search, mode: 'insensitive' } } },
      { donor: { name: { contains: search, mode: 'insensitive' } } },
      { donor: { email: { contains: search, mode: 'insensitive' } } },
      { batchNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [donations, total] = await Promise.all([
    prisma.donation.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        medicine: { select: { name: true, category: true, dosage: true, manufacturer: true } },
        donor: { select: { id: true, name: true, email: true, phone: true, city: true } },
        center: { select: { id: true, name: true, city: true, type: true } },
        verifiedBy: { select: { id: true, name: true, role: true } },
      },
    }),
    prisma.donation.count({ where }),
  ]);

  res.json({
    success: true,
    data: donations,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
});

/**
 * GET /api/admin/requests
 * All patient requests with full patient details
 */
const getAllRequests = asyncHandler(async (req, res) => {
  const { status, urgency, search, page = 1, limit = 50 } = req.query;

  const where = {};
  if (status) where.status = status;
  if (urgency) where.urgency = urgency;
  if (search) {
    where.OR = [
      { medicineName: { contains: search, mode: 'insensitive' } },
      { patient: { name: { contains: search, mode: 'insensitive' } } },
      { patient: { email: { contains: search, mode: 'insensitive' } } },
      { city: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [requests, total] = await Promise.all([
    prisma.patientRequest.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, name: true, email: true, phone: true, city: true, address: true } },
        matches: { select: { id: true, status: true, score: true } },
      },
    }),
    prisma.patientRequest.count({ where }),
  ]);

  res.json({
    success: true,
    data: requests,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
});

/**
 * GET /api/admin/centers
 * All collection centers with donation/inventory counts
 */
const getAllCenters = asyncHandler(async (req, res) => {
  const { city, search, page = 1, limit = 50 } = req.query;

  const where = {};
  if (city) where.city = city;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [centers, total] = await Promise.all([
    prisma.collectionCenter.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { donations: true, inventoryItems: true } },
      },
    }),
    prisma.collectionCenter.count({ where }),
  ]);

  res.json({
    success: true,
    data: centers,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
});

/**
 * GET /api/admin/export
 * Comprehensive export data for CSV/PDF
 */
const getAdminExportData = asyncHandler(async (req, res) => {
  const [users, donations, requests, centers, inventory, queries] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, role: true, phone: true,
        city: true, address: true, isActive: true, emailVerified: true, createdAt: true,
      },
    }),
    prisma.donation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        medicine: { select: { name: true, category: true, dosage: true } },
        donor: { select: { name: true, email: true, phone: true } },
        center: { select: { name: true, city: true } },
      },
    }),
    prisma.patientRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { name: true, email: true, phone: true, city: true } },
      },
    }),
    prisma.collectionCenter.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.inventoryItem.findMany({
      orderBy: { receivedAt: 'desc' },
      include: {
        medicine: { select: { name: true, category: true, dosage: true } },
        center: { select: { name: true, city: true } },
      },
    }),
    prisma.query.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true, role: true } },
      },
    }),
  ]);

  res.json({
    success: true,
    data: { users, donations, requests, centers, inventory, queries },
  });
});

/**
 * POST /api/admin/announce
 * Admin sends an announcement or direct message to users.
 */
const sendAnnouncement = asyncHandler(async (req, res) => {
  const { title, message, targetRole, userId, link } = req.body;

  let users = [];
  if (userId) {
    users = await prisma.user.findMany({
      where: { id: userId },
      select: { id: true },
    });
  } else if (targetRole && targetRole !== 'ALL') {
    users = await prisma.user.findMany({
      where: { role: targetRole },
      select: { id: true },
    });
  } else {
    users = await prisma.user.findMany({
      select: { id: true },
    });
  }

  const io = req.app.get('io');
  await Promise.all(
    users.map((u) =>
      createNotification(
        io,
        u.id,
        'ANNOUNCEMENT',
        title,
        message,
        link || '/notifications',
        { sentByAdminId: req.user.id }
      )
    )
  );

  logger.info({ count: users.length, targetRole, userId, adminId: req.user.id }, 'Admin announcement sent');
  res.json({
    success: true,
    message: `Message sent to ${users.length} user(s)`,
    data: { count: users.length, targetRole, userId },
  });
});

module.exports = {
  getAllUsers,
  updateUserStatus,
  updateUserRole,
  getAllDonations,
  getAllRequests,
  getAllCenters,
  getAdminExportData,
  sendAnnouncement,
};
