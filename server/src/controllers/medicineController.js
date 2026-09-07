/**
 * Medicine Controller — CRUD operations for medicine catalog
 */

const prisma = require('../config/prisma');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * GET /api/medicines
 * Get all medicines with optional category filter
 */
const getAllMedicines = asyncHandler(async (req, res) => {
  const { category, page = 1, limit = 20 } = req.query;

  const where = {};
  if (category) where.category = category;

  const [medicines, total] = await Promise.all([
    prisma.medicine.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { donations: true, inventoryItems: true },
        },
      },
    }),
    prisma.medicine.count({ where }),
  ]);

  res.json({
    success: true,
    data: medicines,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * GET /api/medicines/search
 * Search medicines by name or generic name
 */
const searchMedicines = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({
      success: false,
      message: 'Search query parameter "q" is required',
    });
  }

  const medicines = await prisma.medicine.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { genericName: { contains: q, mode: 'insensitive' } },
        { manufacturer: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 20,
    orderBy: { name: 'asc' },
  });

  res.json({ success: true, data: medicines });
});

/**
 * GET /api/medicines/:id
 */
const getMedicineById = asyncHandler(async (req, res) => {
  const medicine = await prisma.medicine.findUnique({
    where: { id: req.params.id },
    include: {
      _count: {
        select: { donations: true, inventoryItems: true },
      },
    },
  });

  if (!medicine) {
    return res.status(404).json({ success: false, message: 'Medicine not found' });
  }

  res.json({ success: true, data: medicine });
});

/**
 * POST /api/medicines
 */
const createMedicine = asyncHandler(async (req, res) => {
  const { name, genericName, category, manufacturer, dosage, form, requiresColdChain } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Medicine name is required' });
  }

  const medicine = await prisma.medicine.create({
    data: {
      name,
      genericName,
      category,
      manufacturer,
      dosage,
      form,
      requiresColdChain: requiresColdChain || false,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Medicine created',
    data: medicine,
  });
});

/**
 * PUT /api/medicines/:id
 */
const updateMedicine = asyncHandler(async (req, res) => {
  const medicine = await prisma.medicine.update({
    where: { id: req.params.id },
    data: req.body,
  });

  res.json({ success: true, message: 'Medicine updated', data: medicine });
});

module.exports = { getAllMedicines, getMedicineById, createMedicine, updateMedicine, searchMedicines };
