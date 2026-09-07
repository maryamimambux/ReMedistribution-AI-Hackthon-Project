/**
 * Donation Controller — Donation lifecycle management
 */

const prisma = require('../config/prisma');
const { asyncHandler } = require('../utils/asyncHandler');
const { calculateRiskScore } = require('../services/riskScoring');
const { createNotification } = require('../services/notificationService');

/**
 * Safely parse a JSON string field; returns defaultValue on failure.
 */
function safeJsonParse(value, defaultValue = null) {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return defaultValue;
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

/**
 * Normalize a donation record so JSON-string fields arrive as objects/arrays
 * to the frontend.
 */
function normalizeDonationResponse(donation) {
  if (!donation) return donation;
  return {
    ...donation,
    photos: safeJsonParse(donation.photos, []),
    aiOcrResult: safeJsonParse(donation.aiOcrResult, null),
    aiVisionResult: safeJsonParse(donation.aiVisionResult, null),
  };
}

/**
 * Build a Prisma where clause that restricts donations to a pharmacist's center.
 * If the pharmacist account is linked to a specific center, only donations booked
 * to that center are shown. Otherwise fall back to donations whose selected center
 * is in the pharmacist's city.
 *
 * IMPORTANT: never use the donor's profile city — the donor explicitly chose a
 * collection center, so the donation must only be visible to that center.
 */
function centerMatchesDonationFilter(pharmacist) {
  if (pharmacist.role !== 'PHARMACIST') return {};
  if (pharmacist.centerId) {
    return { centerId: pharmacist.centerId };
  }
  // Fallback for accounts not yet linked to a center
  if (!pharmacist.city) return {};
  const city = pharmacist.city.trim();
  return {
    center: { city: { equals: city, mode: 'insensitive' } },
  };
}

/**
 * POST /api/donations
 * Create a new donation (donor uploads medicine info + photos)
 */
const createDonation = asyncHandler(async (req, res) => {
  const {
    medicineId, medicineName, centerId, quantity,
    batchNumber, expiryDate, sealIntact, storageVerified,
    scannedText, ocrConfidence, category, manufacturer, dosage, form,
    visionResult, ocrResult,
  } = req.body;

  let resolvedMedicineId = medicineId;

  // If no medicineId but medicineName is provided, find or create the medicine
  if (!resolvedMedicineId && medicineName) {
    let medicine = await prisma.medicine.findFirst({
      where: { name: medicineName },
    });

    if (!medicine) {
      medicine = await prisma.medicine.create({
        data: {
          name: medicineName,
          category: category || 'Uncategorized',
          manufacturer,
          dosage,
          form,
        },
      });
    }
    resolvedMedicineId = medicine.id;
  }

  if (!resolvedMedicineId) {
    return res.status(400).json({
      success: false,
      message: 'Either medicineId or medicineName is required',
    });
  }

  // Collect photo paths from uploaded files (stored as JSON string for SQLite)
  const photos = JSON.stringify(req.files ? req.files.map((f) => `/uploads/${f.filename}`) : []);

  // Parse vision result if sent as JSON string via multipart
  let parsedVisionResult = visionResult;
  if (typeof visionResult === 'string') {
    try {
      parsedVisionResult = JSON.parse(visionResult);
    } catch {
      parsedVisionResult = null;
    }
  }

  // Parse OCR result if sent as JSON string via multipart
  let parsedOcrResult = ocrResult;
  if (typeof ocrResult === 'string') {
    try {
      parsedOcrResult = JSON.parse(ocrResult);
    } catch {
      parsedOcrResult = null;
    }
  }

  // Build structured AI snapshots for later pharmacist review.
  // Prefer AI-extracted values, but fall back to donor-entered/corrected values
  // so the pharmacist always has something to compare against.
  const aiOcrSnapshot = parsedOcrResult && parsedOcrResult.fields
    ? {
        text: parsedOcrResult.text || scannedText || '',
        fields: {
          medicineName: parsedOcrResult.fields.medicineName || medicineName || null,
          batchNumber: parsedOcrResult.fields.batchNumber || batchNumber || null,
          expiryDate: parsedOcrResult.fields.expiryDate || expiryDate || null,
          manufacturer: parsedOcrResult.fields.manufacturer || manufacturer || null,
          dosage: parsedOcrResult.fields.dosage || dosage || null,
          category: parsedOcrResult.fields.category || category || null,
        },
        confidence: parsedOcrResult.confidence ?? parseFloat(ocrConfidence) ?? 0,
        source: parsedOcrResult.source || 'ocr',
      }
    : {
        text: scannedText || '',
        fields: {
          medicineName: medicineName || null,
          batchNumber: batchNumber || null,
          expiryDate: expiryDate || null,
          manufacturer: manufacturer || null,
          dosage: dosage || null,
          category: category || null,
        },
        confidence: parseFloat(ocrConfidence) || 0,
        source: 'donor-form',
      };

  const aiVisionSnapshot = parsedVisionResult
    ? {
        sealIntact: parsedVisionResult.sealIntact ?? null,
        damaged: parsedVisionResult.damaged ?? null,
        tampered: parsedVisionResult.tampered ?? null,
        labelReadable: parsedVisionResult.labelReadable ?? null,
        confidence: parsedVisionResult.confidence ?? 0,
        flags: parsedVisionResult.flags || [],
        source: parsedVisionResult.source || 'vision',
      }
    : null;

  // Calculate AI risk score
  const riskResult = calculateRiskScore({
    batchNumber,
    expiryDate,
    sealIntact: sealIntact === 'true' || sealIntact === true,
    ocrConfidence: parseFloat(ocrConfidence) || 0,
    manufacturer,
    visionResult: parsedVisionResult,
  });

  const donation = await prisma.donation.create({
    data: {
      donorId: req.user.id,
      medicineId: resolvedMedicineId,
      centerId: centerId || null,
      quantity: parseInt(quantity) || 1,
      batchNumber,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      sealIntact: sealIntact === 'true' || sealIntact === true,
      storageVerified: storageVerified === 'true' || storageVerified === true,
      photos,
      scannedText,
      ocrConfidence: parseFloat(ocrConfidence) || null,
      aiRiskScore: riskResult.level,
      aiConfidence: riskResult.confidence,
      aiNotes: riskResult.notes,
      aiOcrResult: JSON.stringify(aiOcrSnapshot),
      aiVisionResult: aiVisionSnapshot ? JSON.stringify(aiVisionSnapshot) : null,
      status: 'SCANNED',
    },
    include: {
      medicine: true,
      donor: { select: { id: true, name: true, phone: true } },
      center: true,
    },
  });

  // Emit socket event to pharmacists at the chosen center
  const io = req.app.get('io');
  if (centerId) {
    io.to(`center:${centerId}`).emit('donation:new', donation);
  }

  // Notify donor
  await createNotification(
    io,
    req.user.id,
    'DONATION_RECEIVED',
    'Donation Submitted',
    `Your donation of ${donation.medicine?.name || 'medicine'} has been received and is pending verification.`,
    '/my-donations',
    { donationId: donation.id }
  );

  res.status(201).json({
    success: true,
    message: 'Donation created successfully',
    data: donation,
  });
});

/**
 * GET /api/donations
 * List donations with filters (for pharmacists and admins)
 */
const getDonations = asyncHandler(async (req, res) => {
  const { status, centerId, search, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 20 } = req.query;

  const where = {};
  if (status) where.status = status;
  if (centerId) where.centerId = centerId;

  // Search by medicine name
  if (search) {
    where.medicine = { name: { contains: search, mode: 'insensitive' } };
  }

  // Pharmacists only see donations at their center
  if (req.user.role === 'PHARMACIST') {
    if (!status) {
      where.status = { in: ['SCANNED', 'PENDING', 'VERIFIED'] };
    }
    Object.assign(where, centerMatchesDonationFilter(req.user));
  }

  // Build orderBy
  const validSortFields = ['createdAt', 'status', 'quantity'];
  const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';

  const [donations, total] = await Promise.all([
    prisma.donation.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { [orderField]: orderDir },
      include: {
        medicine: true,
        donor: { select: { id: true, name: true, phone: true, city: true } },
        center: true,
        verifiedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.donation.count({ where }),
  ]);

  res.json({
    success: true,
    data: donations,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * GET /api/donations/my-donations
 * Get the current donor's donations
 */
const getDonorDonations = asyncHandler(async (req, res) => {
  const { search, status, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 20 } = req.query;

  const where = { donorId: req.user.id };
  if (status) where.status = status;
  if (search) where.medicine = { name: { contains: search, mode: 'insensitive' } };

  const validSortFields = ['createdAt', 'status', 'quantity'];
  const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';

  const [donations, total] = await Promise.all([
    prisma.donation.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { [orderField]: orderDir },
      include: {
        medicine: true,
        center: { select: { id: true, name: true, address: true } },
      },
    }),
    prisma.donation.count({ where }),
  ]);

  res.json({
    success: true,
    data: donations,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * GET /api/donations/:id
 */
const getDonationById = asyncHandler(async (req, res) => {
  const donation = await prisma.donation.findUnique({
    where: { id: req.params.id },
    include: {
      medicine: true,
      donor: { select: { id: true, name: true, phone: true, email: true, city: true } },
      center: true,
      verifiedBy: { select: { id: true, name: true } },
      inventoryItem: true,
    },
  });

  if (!donation) {
    return res.status(404).json({ success: false, message: 'Donation not found' });
  }

  res.json({ success: true, data: normalizeDonationResponse(donation) });
});

/**
 * PATCH /api/donations/:id
 * Donor updates their own donation while it is still editable
 */
const updateDonation = asyncHandler(async (req, res) => {
  const donation = await prisma.donation.findUnique({
    where: { id: req.params.id },
    include: { medicine: true, inventoryItem: true },
  });

  if (!donation) {
    return res.status(404).json({ success: false, message: 'Donation not found' });
  }

  if (donation.donorId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not authorized to update this donation' });
  }

  // Only allow edits before the donation has been processed by a pharmacist
  if (!['PENDING', 'SCANNED'].includes(donation.status)) {
    return res.status(400).json({
      success: false,
      message: 'This donation can no longer be edited because it has already been reviewed',
    });
  }

  const {
    medicineName, category, manufacturer, dosage, form,
    batchNumber, expiryDate, quantity, sealIntact, storageVerified, centerId,
  } = req.body;

  let medicineId = donation.medicineId;

  // If medicine name changed, resolve (find or create) the new medicine record
  if (medicineName && medicineName !== donation.medicine?.name) {
    let medicine = await prisma.medicine.findFirst({ where: { name: medicineName } });
    if (!medicine) {
      medicine = await prisma.medicine.create({
        data: {
          name: medicineName,
          category: category || donation.medicine?.category || 'Uncategorized',
          manufacturer: manufacturer || donation.medicine?.manufacturer,
          dosage: dosage || donation.medicine?.dosage,
          form: form || donation.medicine?.form,
        },
      });
    }
    medicineId = medicine.id;
  }

  const updated = await prisma.donation.update({
    where: { id: req.params.id },
    data: {
      medicineId,
      batchNumber: batchNumber !== undefined ? batchNumber : donation.batchNumber,
      expiryDate: expiryDate !== undefined ? (expiryDate ? new Date(expiryDate) : null) : donation.expiryDate,
      quantity: quantity !== undefined ? parseInt(quantity) : donation.quantity,
      sealIntact: sealIntact !== undefined ? sealIntact : donation.sealIntact,
      storageVerified: storageVerified !== undefined ? storageVerified : donation.storageVerified,
      centerId: centerId !== undefined ? centerId || null : donation.centerId,
    },
    include: {
      medicine: true,
      center: { select: { id: true, name: true, address: true } },
    },
  });

  res.json({ success: true, message: 'Donation updated successfully', data: updated });
});

/**
 * DELETE /api/donations/:id
 * Donor removes their own donation before it is reviewed
 */
const deleteDonation = asyncHandler(async (req, res) => {
  const donation = await prisma.donation.findUnique({ where: { id: req.params.id } });

  if (!donation) {
    return res.status(404).json({ success: false, message: 'Donation not found' });
  }

  if (donation.donorId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not authorized to delete this donation' });
  }

  if (!['PENDING', 'SCANNED'].includes(donation.status)) {
    return res.status(400).json({
      success: false,
      message: 'This donation can no longer be deleted because it has already been reviewed',
    });
  }

  await prisma.donation.delete({ where: { id: req.params.id } });

  res.json({ success: true, message: 'Donation deleted successfully' });
});

/**
 * PATCH /api/donations/:id/verify
 * Pharmacist approves or rejects a donation and persists an audit record.
 */
const verifyDonation = asyncHandler(async (req, res) => {
  const {
    action, // legacy alias, kept for backwards compatibility
    status,
    notes,
    reason,
    checklist,
  } = req.body;

  // Support both `action` and `status` for the final decision
  const decision = status || action;

  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({
      success: false,
      message: 'Decision must be APPROVED or REJECTED',
    });
  }

  if (decision === 'REJECTED' && !reason) {
    return res.status(400).json({
      success: false,
      message: 'Rejection reason is required',
    });
  }

  const donation = await prisma.donation.findUnique({
    where: { id: req.params.id },
    include: { medicine: true },
  });

  if (!donation) {
    return res.status(404).json({ success: false, message: 'Donation not found' });
  }

  // Build a full snapshot of AI outputs at the time of decision
  const aiSnapshot = {
    riskScore: donation.aiRiskScore,
    riskConfidence: donation.aiConfidence,
    aiNotes: donation.aiNotes,
    ocr: safeJsonParse(donation.aiOcrResult, null),
    vision: safeJsonParse(donation.aiVisionResult, null),
    scannedText: donation.scannedText,
    ocrConfidence: donation.ocrConfidence,
  };

  // Update donation status
  const updated = await prisma.donation.update({
    where: { id: req.params.id },
    data: {
      status: decision,
      verifiedById: req.user.id,
      pharmacistNotes: notes || null,
    },
    include: { medicine: true },
  });

  // Persist immutable verification audit record
  await prisma.verification.create({
    data: {
      donationId: donation.id,
      pharmacistId: req.user.id,
      decision,
      reason: reason || null,
      checklist: JSON.stringify(checklist || {}),
      aiSnapshot: JSON.stringify(aiSnapshot),
      notes: notes || null,
    },
  });

  // If approved, add to inventory
  if (decision === 'APPROVED' && donation.centerId) {
    await prisma.inventoryItem.create({
      data: {
        centerId: donation.centerId,
        medicineId: donation.medicineId,
        donationId: donation.id,
        quantity: donation.quantity,
        batchNumber: donation.batchNumber,
        expiryDate: donation.expiryDate,
        status: 'AVAILABLE',
      },
    });
  }

  // Emit socket event
  const io = req.app.get('io');
  io.to(`donor:${donation.donorId}`).emit('donation:updated', updated);
  if (decision === 'APPROVED') {
    io.to(`donor:${donation.donorId}`).emit('donation:verified', updated);
  } else {
    io.to(`donor:${donation.donorId}`).emit('donation:rejected', updated);
  }

  // Notify donor of verification result
  await createNotification(
    io,
    donation.donorId,
    decision === 'APPROVED' ? 'DONATION_APPROVED' : 'DONATION_REJECTED',
    decision === 'APPROVED' ? 'Donation Approved!' : 'Donation Rejected',
    decision === 'APPROVED'
      ? `Your donation of ${donation.medicine?.name || 'medicine'} has been approved and added to inventory.`
      : `Your donation of ${donation.medicine?.name || 'medicine'} was rejected. ${reason ? `Reason: ${reason}.` : ''} ${notes || ''}`,
    '/my-donations',
    { donationId: donation.id, decision, reason }
  );

  res.json({
    success: true,
    message: `Donation ${decision.toLowerCase()}`,
    data: normalizeDonationResponse(updated),
  });
});

/**
 * GET /api/donations/:id/verifications
 * Fetch the audit history for a donation (newest first).
 */
const getDonationVerifications = asyncHandler(async (req, res) => {
  const donation = await prisma.donation.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });

  if (!donation) {
    return res.status(404).json({ success: false, message: 'Donation not found' });
  }

  const records = await prisma.verification.findMany({
    where: { donationId: req.params.id },
    orderBy: { createdAt: 'desc' },
    include: {
      pharmacist: { select: { id: true, name: true } },
    },
  });

  const normalized = records.map((record) => ({
    ...record,
    checklist: safeJsonParse(record.checklist, {}),
    aiSnapshot: safeJsonParse(record.aiSnapshot, {}),
  }));

  res.json({ success: true, data: normalized });
});

module.exports = {
  createDonation,
  getDonations,
  getDonationById,
  updateDonation,
  deleteDonation,
  verifyDonation,
  getDonorDonations,
  getDonationVerifications,
};
