/**
 * Matching Controller — Smart matching algorithm + Fulfillment tracking
 * Matches patients to nearest available medicine with earliest expiry and highest priority
 * Manages full fulfillment lifecycle: MATCHED -> READY_FOR_PICKUP -> PICKED_UP -> COMPLETED (Delivered)
 *
 * Per-request flow (pharmacist driven):
 *   1. GET  /api/matching/request/:requestId/candidates  → "Find Match" preview
 *   2. POST /api/matching/request/:requestId/approve      → "Approve & Generate Pickup Code"
 *   3. POST /api/matching/verify-code                      → verify 6-digit code / scanned QR
 *   4. PATCH /api/matching/:id/complete                    → mark Delivered
 */

const prisma = require('../config/prisma');
const { asyncHandler } = require('../utils/asyncHandler');
const { createNotification } = require('../services/notificationService');
const QRCode = require('qrcode');

// Correct urgency ordering (string sort would put MEDIUM above CRITICAL)
const URGENCY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/**
 * Ensure a pharmacist can only act on patient requests from their center's city.
 */
function requestMatchesPharmacistArea(request, pharmacist) {
  if (!pharmacist || pharmacist.role !== 'PHARMACIST' || !request) return true;
  const pcity = (pharmacist.center?.city || pharmacist.city || '').trim().toLowerCase();
  if (!pcity) return true;
  const requestCity = (request.city || '').trim().toLowerCase();
  return !requestCity || requestCity === pcity;
}

/**
 * Limit inventory candidates to the pharmacist's own center.
 * If no center is linked, fall back to the pharmacist's city.
 */
function filterInventoryForPharmacist(inventoryItems, pharmacist) {
  if (!pharmacist || pharmacist.role !== 'PHARMACIST') return inventoryItems;
  if (pharmacist.centerId) {
    return inventoryItems.filter((item) => item.centerId === pharmacist.centerId);
  }
  if (pharmacist.city) {
    const city = pharmacist.city.trim().toLowerCase();
    return inventoryItems.filter((item) => item.center?.city?.toLowerCase() === city);
  }
  return inventoryItems;
}

/**
 * Cancel every other active/ready match for the same request and release the
 * reserved inventory so only the chosen pickup option remains.
 */
async function cancelOtherActiveMatches(keepMatchId, patientRequestId, io) {
  try {
    const others = await prisma.match.findMany({
      where: {
        patientRequestId,
        id: { not: keepMatchId },
        status: { in: ['ACTIVE', 'READY_FOR_PICKUP'] },
      },
      include: { inventoryItem: { select: { id: true, status: true } } },
    });

    for (const other of others) {
      const history = other.fulfillmentHistory ? JSON.parse(other.fulfillmentHistory) : [];
      history.push({
        status: 'CANCELLED',
        timestamp: new Date().toISOString(),
        actorId: null,
        notes: 'Cancelled because patient picked up medicine from another center',
      });

      await prisma.match.update({
        where: { id: other.id },
        data: { status: 'CANCELLED', fulfillmentHistory: JSON.stringify(history) },
      });

      if (other.inventoryItem && other.inventoryItem.status === 'RESERVED') {
        await prisma.inventoryItem.update({
          where: { id: other.inventoryItem.id },
          data: { status: 'AVAILABLE' },
        });
      }

      if (io) {
        io.to(`patient:${patientRequestId}`).emit('match:cancelled', other);
      }
    }
  } catch (err) {
    console.error('[Matching] Failed to cancel other matches:', err.message);
  }
}

/**
 * Generate a random 6-digit pickup code, checking uniqueness against live matches
 */
async function generateUniquePickupCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const existing = await prisma.match.findFirst({
      where: { pickupCode: code, status: { in: ['ACTIVE', 'READY_FOR_PICKUP', 'PICKED_UP'] } },
      select: { id: true },
    });
    if (!existing) return code;
  }
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Score available inventory items against a single patient request.
 * Returns [{ item, score, distanceKm }] sorted by score desc.
 *
 * Scoring: distance 40% · expiry (FEFO) 30% · urgency 20% · quantity 10%
 */
function scoreCandidates(request, inventoryItems) {
  const patientLat = request.lat || request.patient?.lat;
  const patientLng = request.lng || request.patient?.lng;

  const scored = inventoryItems.map((item) => {
    let score = 0;
    let distanceKm = null;

    // 1. Distance score (40%) — closer is better
    if (patientLat && patientLng && item.center?.lat != null && item.center?.lng != null) {
      distanceKm = haversineDistance(patientLat, patientLng, item.center.lat, item.center.lng);
      score += Math.max(0, 40 - distanceKm * 2); // Lose 2 points per km
    } else if (request.city && item.center.city.toLowerCase() === request.city.toLowerCase()) {
      score += 30; // Same city bonus when no coordinates
    }

    // 2. Expiry score (30%) — earlier expiry used first to reduce waste (FEFO)
    if (item.expiryDate) {
      const daysUntilExpiry = Math.ceil((new Date(item.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry > 0 && daysUntilExpiry <= 90) {
        score += 30 - (daysUntilExpiry / 90) * 25;
      }
    }

    // 3. Urgency score (20%) — higher urgency = higher priority
    const urgencyMultiplier = { CRITICAL: 1.0, HIGH: 0.75, MEDIUM: 0.5, LOW: 0.25 };
    score += 20 * (urgencyMultiplier[request.urgency] || 0.5);

    // 4. Quantity score (10%) — has enough stock
    if (item.quantity >= request.quantity) {
      score += 10;
    }

    return { item, score: Math.round(score * 100) / 100, distanceKm };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Filter inventory items whose medicine name/generic matches the request text
 */
function findNameMatches(request, inventoryItems) {
  const needle = request.medicineName.toLowerCase();
  return inventoryItems.filter(
    (item) =>
      item.medicine.name.toLowerCase().includes(needle) ||
      needle.includes(item.medicine.name.toLowerCase()) ||
      (item.medicine.genericName && item.medicine.genericName.toLowerCase().includes(needle))
  );
}

/**
 * GET /api/matching/request/:requestId/candidates
 * "Find Match" — preview the best available inventory candidates for one request.
 * No database changes; pharmacist reviews before approving.
 */
const findMatchForRequest = asyncHandler(async (req, res) => {
  const request = await prisma.patientRequest.findUnique({
    where: { id: req.params.requestId },
    include: { patient: { select: { id: true, name: true, city: true, lat: true, lng: true } } },
  });

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  if (!['PENDING', 'MATCHED'].includes(request.status)) {
    return res.status(400).json({
      success: false,
      message: `This request is already ${request.status.toLowerCase()} — no new match needed.`,
    });
  }

  if (req.user.role === 'PHARMACIST' && !requestMatchesPharmacistArea(request, req.user)) {
    return res.status(403).json({
      success: false,
      message: 'This request is outside your center city. You can only match requests from your own city.',
    });
  }

  const availableInventory = await prisma.inventoryItem.findMany({
    where: { status: 'AVAILABLE' },
    include: {
      medicine: true,
      center: { select: { id: true, name: true, address: true, city: true, phone: true, lat: true, lng: true } },
    },
  });

  const candidates = scoreCandidates(request, findNameMatches(request, filterInventoryForPharmacist(availableInventory, req.user))).map(
    ({ item, score, distanceKm }) => ({
      inventoryItemId: item.id,
      medicine: item.medicine,
      center: item.center,
      quantity: item.quantity,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      score,
      distanceKm: distanceKm !== null ? Math.round(distanceKm * 10) / 10 : null,
    })
  );

  res.json({
    success: true,
    data: {
      request: {
        id: request.id,
        medicineName: request.medicineName,
        quantity: request.quantity,
        urgency: request.urgency,
        city: request.city,
        location: request.location,
      },
      candidates,
    },
  });
});

/**
 * POST /api/matching/request/:requestId/approve
 * "Approve & Generate Pickup Code" — create the match for this request:
 *   • reserves the inventory item (status -> RESERVED)
 *   • generates a unique 6-digit pickup code with 48h validity
 *   • builds the QR code payload
 *   • marks the request MATCHED, notifies the patient
 */
const approveMatch = asyncHandler(async (req, res) => {
  const { inventoryItemId } = req.body;
  const io = req.app.get('io');

  const request = await prisma.patientRequest.findUnique({
    where: { id: req.params.requestId },
    include: { patient: { select: { id: true, name: true, city: true, lat: true, lng: true, phone: true } } },
  });

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  if (!['PENDING', 'MATCHED'].includes(request.status)) {
    return res.status(400).json({
      success: false,
      message: `This request is already ${request.status.toLowerCase()} — cannot create another match.`,
    });
  }

  if (req.user.role === 'PHARMACIST' && !requestMatchesPharmacistArea(request, req.user)) {
    return res.status(403).json({
      success: false,
      message: 'This request is outside your center city. You can only match requests from your own city.',
    });
  }

  // Pharmacists can only create one active match per request for their own center
  if (req.user.role === 'PHARMACIST' && req.user.centerId) {
    const existingMatch = await prisma.match.findFirst({
      where: {
        patientRequestId: request.id,
        status: { in: ['ACTIVE', 'READY_FOR_PICKUP'] },
        inventoryItem: { centerId: req.user.centerId },
      },
      select: { id: true },
    });
    if (existingMatch) {
      return res.status(409).json({
        success: false,
        message: 'Your center already has an active match for this request.',
      });
    }
  }

  const availableInventory = await prisma.inventoryItem.findMany({
    where: { status: 'AVAILABLE' },
    include: {
      medicine: true,
      center: { select: { id: true, name: true, address: true, city: true, phone: true, lat: true, lng: true } },
    },
  });

  const scored = scoreCandidates(request, findNameMatches(request, filterInventoryForPharmacist(availableInventory, req.user)));
  if (scored.length === 0) {
    return res.status(400).json({
      success: false,
      message: `No available inventory matches "${request.medicineName}". Ask the patient to try again later.`,
    });
  }

  // Use the pharmacist-selected item (if provided and valid) or the best-scoring one
  let chosen = scored[0];
  if (inventoryItemId) {
    const selected = scored.find((s) => s.item.id === inventoryItemId);
    if (!selected) {
      return res.status(400).json({ success: false, message: 'Selected inventory item is not a valid candidate for this request.' });
    }
    chosen = selected;
  }

  // Re-check current status to avoid double-reservation races
  const [freshItem, pickupCode] = await Promise.all([
    prisma.inventoryItem.findUnique({ where: { id: chosen.item.id }, select: { status: true } }),
    generateUniquePickupCode(),
  ]);

  if (!freshItem || freshItem.status !== 'AVAILABLE') {
    return res.status(409).json({
      success: false,
      message: 'This inventory item was just reserved by someone else. Please pick another candidate.',
    });
  }

  const pickupCodeExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48-hour validity

  const now = new Date().toISOString();
  const historyEntry = JSON.stringify([
    { status: 'MATCHED', timestamp: now, actorId: req.user.id, notes: `Matched to inventory at ${chosen.item.center.name} (score ${chosen.score})` },
    { status: 'READY_FOR_PICKUP', timestamp: now, actorId: req.user.id, notes: 'Pickup code generated — patient notified' },
  ]);

  const match = await prisma.match.create({
    data: {
      inventoryItemId: chosen.item.id,
      patientRequestId: request.id,
      score: chosen.score,
      status: 'READY_FOR_PICKUP',
      pickupCode,
      pickupCodeExpiresAt,
      fulfillmentHistory: historyEntry,
    },
    include: {
      inventoryItem: {
        include: {
          medicine: true,
          center: { select: { id: true, name: true, address: true, city: true, phone: true } },
        },
      },
      patientRequest: {
        include: { patient: { select: { id: true, name: true, phone: true } } },
      },
    },
  });

  // Reserve the inventory item + mark the request as MATCHED the first time
  const updates = [
    prisma.inventoryItem.update({
      where: { id: chosen.item.id },
      data: { status: 'RESERVED' },
    }),
  ];
  if (request.status === 'PENDING') {
    updates.push(
      prisma.patientRequest.update({
        where: { id: request.id },
        data: { status: 'MATCHED' },
      })
    );
  }
  await Promise.all(updates);

  // Build the QR code image so the pharmacist can confirm instantly
  const qrData = JSON.stringify({
    matchId: match.id,
    pickupCode: match.pickupCode,
    medicineName: request.medicineName,
  });
  const qrImage = await QRCode.toDataURL(qrData, {
    width: 300,
    margin: 2,
    color: { dark: '#065f46', light: '#ffffff' },
  });

  // Real-time updates to the patient
  io.to(`patient:${request.patientId}`).emit('match:found', match);
  io.to(`patient:${request.patientId}`).emit('match:ready', match);

  // Notify the patient
  await createNotification(
    io,
    request.patientId,
    'MATCH_FOUND',
    'Match Found — Ready for Pickup!',
    `${request.medicineName} is available at ${chosen.item.center.name}${chosen.distanceKm !== null ? ` (~${Math.round(chosen.distanceKm)} km away)` : ''}. Your pickup code: ${pickupCode} — valid for 48 hours.`,
    '/my-requests',
    { matchId: match.id, pickupCode, centerName: chosen.item.center.name, expiresAt: pickupCodeExpiresAt.toISOString() }
  );

  res.status(201).json({
    success: true,
    message: 'Match approved — pickup code generated',
    data: {
      match,
      qrImage,
      pickupCode,
      expiresAt: pickupCodeExpiresAt,
    },
  });
});

/**
 * POST /api/matching/run
 * Run the smart matching algorithm for all pending patient requests (bulk)
 */
const runMatching = asyncHandler(async (req, res) => {
  // Get all pending patient requests, ordered by true urgency (CRITICAL first)
  const pendingRequests = await prisma.patientRequest.findMany({
    where: { status: 'PENDING' },
    include: {
      patient: { select: { id: true, name: true, city: true, lat: true, lng: true } },
    },
  });
  pendingRequests.sort((a, b) => {
    const rankDiff = (URGENCY_RANK[b.urgency] || 0) - (URGENCY_RANK[a.urgency] || 0);
    if (rankDiff !== 0) return rankDiff;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  if (pendingRequests.length === 0) {
    return res.json({
      success: true,
      message: 'No pending requests to match',
      data: { matched: 0 },
    });
  }

  // Get all available inventory
  const availableInventory = await prisma.inventoryItem.findMany({
    where: { status: 'AVAILABLE' },
    include: {
      medicine: true,
      center: true,
    },
  });

  const matchResults = [];
  const io = req.app.get('io');

  for (const request of pendingRequests) {
    const scored = scoreCandidates(request, findNameMatches(request, availableInventory));

    if (scored.length === 0) continue;

    const bestMatch = scored[0];

    if (bestMatch && bestMatch.score > 10) {
      const pickupCode = await generateUniquePickupCode();
      const pickupCodeExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

      const now = new Date().toISOString();
      const historyEntry = JSON.stringify([
        { status: 'MATCHED', timestamp: now, actorId: req.user.id, notes: 'Match created by matching algorithm' },
        { status: 'READY_FOR_PICKUP', timestamp: now, actorId: req.user.id, notes: 'Pickup code generated' },
      ]);

      // Create the match with pickup code
      const match = await prisma.match.create({
        data: {
          inventoryItemId: bestMatch.item.id,
          patientRequestId: request.id,
          score: bestMatch.score,
          status: 'READY_FOR_PICKUP',
          pickupCode,
          pickupCodeExpiresAt,
          fulfillmentHistory: historyEntry,
        },
        include: {
          inventoryItem: {
            include: {
              medicine: true,
              center: { select: { id: true, name: true, address: true, city: true } },
            },
          },
          patientRequest: {
            include: {
              patient: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      });

      // Update statuses
      await prisma.inventoryItem.update({
        where: { id: bestMatch.item.id },
        data: { status: 'RESERVED' },
      });

      await prisma.patientRequest.update({
        where: { id: request.id },
        data: { status: 'MATCHED' },
      });

      // Remove from available pool
      const idx = availableInventory.findIndex((i) => i.id === bestMatch.item.id);
      if (idx !== -1) availableInventory.splice(idx, 1);

      matchResults.push(match);

      // Emit socket event to patient
      io.to(`patient:${request.patientId}`).emit('match:found', match);
      io.to(`patient:${request.patientId}`).emit('match:ready', match);

      // Notify patient
      await createNotification(
        io,
        request.patientId,
        'MATCH_FOUND',
        'Medicine Match Found!',
        `${request.medicineName} is ready for pickup at ${bestMatch.item.center.name}. Your pickup code: ${pickupCode}`,
        '/my-requests',
        { matchId: match.id, pickupCode, centerName: bestMatch.item.center.name }
      );
    }
  }

  res.json({
    success: true,
    message: `Matched ${matchResults.length} of ${pendingRequests.length} pending requests`,
    data: {
      matched: matchResults.length,
      total: pendingRequests.length,
      matches: matchResults,
    },
  });
});

/**
 * GET /api/matching
 * List all matches with fulfillment info
 */
const getMatches = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const where = {};
  if (status) where.status = status;

  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { matchedAt: 'desc' },
      include: {
        inventoryItem: {
          include: {
            medicine: true,
            center: { select: { id: true, name: true, address: true, city: true } },
          },
        },
        patientRequest: {
          include: {
            patient: { select: { id: true, name: true, phone: true, city: true } },
          },
        },
      },
    }),
    prisma.match.count({ where }),
  ]);

  res.json({
    success: true,
    data: matches,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * Core pickup verification shared by both entry points
 * (PATCH /:id/pickup with known match, POST /verify-code with code only)
 * Validates the code + expiry, transitions to PICKED_UP, dispatches inventory,
 * and notifies the patient.
 */
async function executePickupVerification(match, code, user, io) {
  if (match.status !== 'READY_FOR_PICKUP') {
    return {
      status: 400,
      body: {
        success: false,
        message: `Cannot verify pickup. Current status: ${match.status}`,
      },
    };
  }

  // Check code
  if (match.pickupCode !== code) {
    return { status: 400, body: { success: false, message: 'Invalid pickup code' } };
  }

  // Check expiry
  if (match.pickupCodeExpiresAt && new Date(match.pickupCodeExpiresAt) < new Date()) {
    return {
      status: 400,
      body: { success: false, message: 'Pickup code has expired. Please request a new match.' },
    };
  }

  // Append to fulfillment history
  const history = match.fulfillmentHistory ? JSON.parse(match.fulfillmentHistory) : [];
  history.push({
    status: 'PICKED_UP',
    timestamp: new Date().toISOString(),
    actorId: user.id,
    notes: `Pickup verified by ${user.name}`,
  });

  // Transition to PICKED_UP
  const updated = await prisma.match.update({
    where: { id: match.id },
    data: {
      status: 'PICKED_UP',
      fulfillmentHistory: JSON.stringify(history),
    },
    include: {
      inventoryItem: { include: { medicine: true, center: { select: { id: true, name: true, city: true } } } },
      patientRequest: { include: { patient: { select: { id: true, name: true, phone: true } } } },
    },
  });

  // Update inventory to DISPATCHED
  await prisma.inventoryItem.update({
    where: { id: match.inventoryItemId },
    data: { status: 'DISPATCHED' },
  });

  // Cancel all other active pickup options for this request
  await cancelOtherActiveMatches(match.id, match.patientRequestId, io);

  // Emit socket events
  io.to(`patient:${match.patientRequest.patientId}`).emit('match:picked_up', updated);

  // Notify patient
  await createNotification(
    io,
    match.patientRequest.patientId,
    'PICKUP_CONFIRMED',
    'Medicine Picked Up',
    `Your medicine (${match.inventoryItem.medicine.name}) has been picked up successfully. It will be marked Delivered once you receive it.`,
    '/my-requests',
    { matchId: match.id }
  );

  return { status: 200, body: { success: true, message: 'Pickup verified successfully', data: updated } };
}

/**
 * PATCH /api/matching/:id/pickup
 * Pharmacist verifies pickup code (match known by id) and transitions to PICKED_UP
 */
const verifyPickup = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const io = req.app.get('io');

  const match = await prisma.match.findUnique({
    where: { id: req.params.id },
    include: {
      inventoryItem: { include: { medicine: true, center: true } },
      patientRequest: { include: { patient: true } },
    },
  });

  if (!match) {
    return res.status(404).json({ success: false, message: 'Match not found' });
  }

  const result = await executePickupVerification(match, code, req.user, io);
  res.status(result.status).json(result.body);
});

/**
 * POST /api/matching/verify-code
 * Verify a pickup by the 6-digit code alone (manual entry or decoded QR scan).
 * Optional matchId confirms the code belongs to the scanned match.
 */
const verifyPickupByCode = asyncHandler(async (req, res) => {
  const { code, matchId } = req.body;
  const io = req.app.get('io');

  if (!code || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ success: false, message: 'Please provide a valid 6-digit pickup code' });
  }

  const match = await prisma.match.findFirst({
    where: { pickupCode: code },
    orderBy: { matchedAt: 'desc' },
    include: {
      inventoryItem: { include: { medicine: true, center: true } },
      patientRequest: { include: { patient: true } },
    },
  });

  if (!match) {
    return res.status(404).json({ success: false, message: 'No active match found with this pickup code' });
  }

  if (matchId && match.id !== matchId) {
    return res.status(400).json({ success: false, message: 'This code does not match the scanned QR code. Please re-check.' });
  }

  const result = await executePickupVerification(match, code, req.user, io);
  res.status(result.status).json(result.body);
});

/**
 * PATCH /api/matching/:id/complete
 * Mark a match as completed (delivery confirmed — patient physically received the medicine)
 */
const completeMatch = asyncHandler(async (req, res) => {
  const io = req.app.get('io');

  const match = await prisma.match.findUnique({
    where: { id: req.params.id },
    include: {
      inventoryItem: { include: { medicine: true } },
      patientRequest: { include: { patient: true } },
    },
  });

  if (!match) {
    return res.status(404).json({ success: false, message: 'Match not found' });
  }

  if (!['PICKED_UP', 'READY_FOR_PICKUP'].includes(match.status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot complete. Current status: ${match.status}`,
    });
  }

  // Append to fulfillment history
  const history = match.fulfillmentHistory ? JSON.parse(match.fulfillmentHistory) : [];
  history.push({
    status: 'COMPLETED',
    timestamp: new Date().toISOString(),
    actorId: req.user.id,
    notes: `Delivery confirmed by ${req.user.name}`,
  });

  const updated = await prisma.match.update({
    where: { id: match.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      fulfillmentHistory: JSON.stringify(history),
    },
    include: {
      inventoryItem: { include: { medicine: true } },
      patientRequest: { include: { patient: true } },
    },
  });

  // Update patient request to FULFILLED (request finalized)
  await prisma.patientRequest.update({
    where: { id: match.patientRequestId },
    data: { status: 'FULFILLED' },
  });

  // Ensure inventory is DISPATCHED
  await prisma.inventoryItem.update({
    where: { id: match.inventoryItemId },
    data: { status: 'DISPATCHED' },
  });

  // Cancel any remaining pickup options now that this request is finalized
  await cancelOtherActiveMatches(match.id, match.patientRequestId, io);

  // Emit socket event
  io.to(`patient:${match.patientRequest.patientId}`).emit('match:completed', updated);

  // Notify patient
  await createNotification(
    io,
    match.patientRequest.patientId,
    'DELIVERY_COMPLETE',
    'Medicine Delivered!',
    `Your request for ${match.inventoryItem.medicine.name} has been fulfilled. We hope you feel better!`,
    '/my-requests',
    { matchId: match.id }
  );

  res.json({ success: true, message: 'Match completed — request delivered', data: updated });
});

/**
 * GET /api/matching/:id/qrcode
 * Generate QR code for pickup
 */
const getQRCode = asyncHandler(async (req, res) => {
  const match = await prisma.match.findUnique({
    where: { id: req.params.id },
    include: {
      patientRequest: { include: { patient: true } },
    },
  });

  if (!match) {
    return res.status(404).json({ success: false, message: 'Match not found' });
  }

  // Only the patient or pharmacist/admin can view the QR code
  if (req.user.role === 'PATIENT' && match.patientRequest.patientId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  if (!match.pickupCode) {
    return res.status(400).json({ success: false, message: 'No pickup code available' });
  }

  const qrData = JSON.stringify({
    matchId: match.id,
    pickupCode: match.pickupCode,
    medicineName: match.patientRequest?.medicineName || 'Medicine',
  });

  const qrImage = await QRCode.toDataURL(qrData, {
    width: 300,
    margin: 2,
    color: { dark: '#065f46', light: '#ffffff' },
  });

  res.json({
    success: true,
    data: {
      qrImage,
      pickupCode: match.pickupCode,
      expiresAt: match.pickupCodeExpiresAt,
    },
  });
});

/**
 * Haversine distance in km
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
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

module.exports = {
  runMatching,
  getMatches,
  verifyPickup,
  verifyPickupByCode,
  completeMatch,
  getQRCode,
  findMatchForRequest,
  approveMatch,
};
