/**
 * Collection Center Controller
 */

const prisma = require('../config/prisma');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * GET /api/centers
 * List all collection centers with optional filters
 */
const getCenters = asyncHandler(async (req, res) => {
  const { type, city, isActive } = req.query;

  const where = {};
  if (type) where.type = type;
  if (city) where.city = city;
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const centers = await prisma.collectionCenter.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { donations: true, inventoryItems: true },
      },
    },
  });

  res.json({ success: true, data: centers });
});

/**
 * GET /api/centers/nearby?lat=...&lng=...&radius=...
 * Find collection centers near a given location
 */
const getNearbyCenters = asyncHandler(async (req, res) => {
  const { lat, lng, radius = 50 } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({
      success: false,
      message: 'Latitude and longitude are required',
    });
  }

  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  const radiusKm = parseFloat(radius);

  // Get all active centers and calculate distance
  const centers = await prisma.collectionCenter.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: { inventoryItems: { where: { status: 'AVAILABLE' } } },
      },
    },
  });

  // Haversine formula for distance calculation
  const withDistance = centers
    .map((center) => {
      const distance = haversineDistance(userLat, userLng, center.lat, center.lng);
      return { ...center, distance: Math.round(distance * 100) / 100 };
    })
    .filter((c) => c.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);

  res.json({ success: true, data: withDistance });
});

/**
 * GET /api/centers/:id
 */
const getCenterById = asyncHandler(async (req, res) => {
  const center = await prisma.collectionCenter.findUnique({
    where: { id: req.params.id },
    include: {
      donations: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { medicine: true, donor: { select: { name: true } } },
      },
      inventoryItems: {
        where: { status: 'AVAILABLE' },
        include: { medicine: true },
      },
    },
  });

  if (!center) {
    return res.status(404).json({ success: false, message: 'Center not found' });
  }

  res.json({ success: true, data: center });
});

/**
 * POST /api/centers
 */
const createCenter = asyncHandler(async (req, res) => {
  const { name, address, city, phone, email, type, lat, lng, openTime, closeTime } = req.body;

  if (!name || !address || !city || !type || lat === undefined || lng === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Name, address, city, type, lat, and lng are required',
    });
  }

  const center = await prisma.collectionCenter.create({
    data: {
      name,
      address,
      city,
      phone,
      email,
      type,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      openTime,
      closeTime,
    },
  });

  res.status(201).json({ success: true, message: 'Center created', data: center });
});

/**
 * PUT /api/centers/:id
 */
const updateCenter = asyncHandler(async (req, res) => {
  const center = await prisma.collectionCenter.update({
    where: { id: req.params.id },
    data: req.body,
  });

  res.json({ success: true, message: 'Center updated', data: center });
});

/**
 * Haversine distance formula — returns distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = { getCenters, getCenterById, getNearbyCenters, createCenter, updateCenter };
