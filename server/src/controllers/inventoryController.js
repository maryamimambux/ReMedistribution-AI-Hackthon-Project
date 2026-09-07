/**
 * Inventory Controller — Track verified medicine stock
 */

const prisma = require('../config/prisma');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * GET /api/inventory
 * List all available inventory with medicine details
 */
const getInventory = asyncHandler(async (req, res) => {
  const { status, category, city, search, sortBy = 'expiryDate', sortOrder = 'asc', page = 1, limit = 20 } = req.query;

  const where = {};
  if (status) where.status = status;
  else where.status = 'AVAILABLE';

  if (category) {
    where.medicine = { ...where.medicine, category };
  }

  // Search by medicine name
  if (search) {
    where.medicine = { ...where.medicine, name: { contains: search, mode: 'insensitive' } };
  }

  if (city) {
    where.center = { city: { equals: city } };
  }

  // Build orderBy
  const validSortFields = ['expiryDate', 'receivedAt', 'quantity'];
  const orderField = validSortFields.includes(sortBy) ? sortBy : 'expiryDate';
  const orderDir = sortOrder === 'desc' ? 'desc' : 'asc';

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { [orderField]: orderDir },
      include: {
        medicine: true,
        center: { select: { id: true, name: true, city: true, address: true } },
        donation: { select: { id: true, aiRiskScore: true } },
      },
    }),
    prisma.inventoryItem.count({ where }),
  ]);

  res.json({
    success: true,
    data: items,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * GET /api/inventory/center/:centerId
 * Get inventory for a specific center
 */
const getInventoryByCenter = asyncHandler(async (req, res) => {
  const items = await prisma.inventoryItem.findMany({
    where: {
      centerId: req.params.centerId,
      status: 'AVAILABLE',
    },
    orderBy: { expiryDate: 'asc' },
    include: {
      medicine: true,
      donation: { select: { id: true, aiRiskScore: true, aiConfidence: true } },
    },
  });

  res.json({ success: true, data: items });
});

/**
 * GET /api/inventory/expiry-risk
 * Expiry-risk triage dashboard — items ranked by waste risk
 * Soon-to-expire + low demand items rise to the top
 */
const getExpiryRisk = asyncHandler(async (req, res) => {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const sixtyDaysFromNow = new Date();
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

  const items = await prisma.inventoryItem.findMany({
    where: { status: 'AVAILABLE', expiryDate: { not: null } },
    orderBy: { expiryDate: 'asc' },
    include: {
      medicine: true,
      center: { select: { id: true, name: true, city: true } },
    },
  });

  // Score each item by risk
  const scored = items.map((item) => {
    const daysUntilExpiry = Math.ceil(
      (new Date(item.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)
    );

    let riskLevel = 'LOW';
    let riskScore = 0;

    if (daysUntilExpiry <= 0) {
      riskLevel = 'CRITICAL';
      riskScore = 100;
    } else if (daysUntilExpiry <= 7) {
      riskLevel = 'HIGH';
      riskScore = 80 + (7 - daysUntilExpiry) * 2;
    } else if (daysUntilExpiry <= 30) {
      riskLevel = 'MEDIUM';
      riskScore = 50 + (30 - daysUntilExpiry);
    } else if (daysUntilExpiry <= 60) {
      riskLevel = 'LOW';
      riskScore = 20 + (60 - daysUntilExpiry) * 0.5;
    }

    return {
      ...item,
      daysUntilExpiry,
      riskLevel,
      riskScore: Math.round(riskScore),
    };
  });

  // Sort by risk score descending (highest risk first)
  scored.sort((a, b) => b.riskScore - a.riskScore);

  res.json({
    success: true,
    data: scored,
    summary: {
      critical: scored.filter((i) => i.riskLevel === 'CRITICAL').length,
      high: scored.filter((i) => i.riskLevel === 'HIGH').length,
      medium: scored.filter((i) => i.riskLevel === 'MEDIUM').length,
      low: scored.filter((i) => i.riskLevel === 'LOW').length,
    },
  });
});

/**
 * PATCH /api/inventory/:id/status
 * Update inventory item status
 */
const updateInventoryStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const validStatuses = ['AVAILABLE', 'RESERVED', 'DISPATCHED', 'EXPIRED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Status must be one of: ${validStatuses.join(', ')}`,
    });
  }

  const item = await prisma.inventoryItem.update({
    where: { id: req.params.id },
    data: { status },
    include: { medicine: true, center: true },
  });

  res.json({ success: true, message: 'Inventory updated', data: item });
});

module.exports = { getInventory, getInventoryByCenter, getExpiryRisk, updateInventoryStatus };
