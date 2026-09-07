/**
 * Patient Controller — Patient request management + AI chatbot
 */

const prisma = require('../config/prisma');
const axios = require('axios');
const { asyncHandler } = require('../utils/asyncHandler');
const { createNotification } = require('../services/notificationService');

// Correct urgency ordering (CRITICAL > HIGH > MEDIUM > LOW) — string sort is wrong
const URGENCY_RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/**
 * Notify pharmacists about a newly created patient request.
 * Pharmacists in the same city are alerted first; if there are none,
 * every active pharmacist is notified (nearest / most appropriate fallback).
 */
async function notifyPharmacistsOfNewRequest(io, request) {
  try {
    const pharmacists = await prisma.user.findMany({
      where: { role: 'PHARMACIST', isActive: true, emailVerified: true },
      select: {
        id: true,
        city: true,
        centerId: true,
        center: { select: { city: true } },
      },
    });

    let targets = pharmacists;
    if (request.city) {
      const requestCity = request.city.toLowerCase();
      const sameCity = pharmacists.filter((p) => {
        // Prefer the linked center's city; fall back to the pharmacist profile city
        const pharmacistCity = (p.center?.city || p.city || '').trim().toLowerCase();
        return pharmacistCity === requestCity;
      });
      if (sameCity.length > 0) targets = sameCity;
    }

    const where = request.city ? ` in ${request.city}` : '';
    for (const pharmacist of targets) {
      await createNotification(
        io,
        pharmacist.id,
        'NEW_REQUEST',
        'New Medicine Request',
        `${request.patient?.name || 'A patient'} requested ${request.medicineName} (x${request.quantity})${where} — urgency: ${request.urgency}.`,
        '/patient-requests',
        { requestId: request.id, urgency: request.urgency, medicineName: request.medicineName }
      );
      io.to(`user:${pharmacist.id}`).emit('request:new', request);
    }
  } catch (err) {
    console.error('[Patients] Failed to notify pharmacists:', err.message);
  }
}

/**
 * Build a Prisma where clause that restricts patient requests to a pharmacist's area.
 * If the pharmacist is linked to a center, requests from the same city are shown so
 * every center in that city can try to find a match. Otherwise fall back to the
 * pharmacist's profile city.
 *
 * IMPORTANT: use the request's city field, not the patient's profile city, so a
 * patient registered in one city cannot leak into another city's pharmacy queue.
 */
function centerCityMatchesRequestFilter(pharmacist) {
  if (pharmacist.role !== 'PHARMACIST') return {};
  const city = (pharmacist.center?.city || pharmacist.city || '').trim();
  if (!city) return {};
  return {
    city: { equals: city, mode: 'insensitive' },
  };
}

/**
 * POST /api/patients
 * Create a patient medicine request
 */
const createRequest = asyncHandler(async (req, res) => {
  const { medicineName, medicineId, urgency, location, city, lat, lng, description, quantity } = req.body;

  if (!medicineName) {
    return res.status(400).json({
      success: false,
      message: 'Medicine name is required',
    });
  }

  const requestCity = (city && city.trim()) ? city.trim() : req.user.city;
  const requestLocation = (location && location.trim()) ? location.trim() : requestCity;

  const request = await prisma.patientRequest.create({
    data: {
      patientId: req.user.id,
      medicineName,
      medicineId,
      urgency: urgency || 'MEDIUM',
      location: requestLocation,
      city: requestCity,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      description,
      quantity: parseInt(quantity) || 1,
    },
    include: {
      patient: { select: { id: true, name: true, phone: true, city: true } },
    },
  });

  // Alert pharmacists at the nearest / most appropriate centers
  const io = req.app.get('io');
  await notifyPharmacistsOfNewRequest(io, request);

  res.status(201).json({
    success: true,
    message: 'Request created',
    data: request,
  });
});

/**
 * POST /api/patients/chat
 * AI Chatbot — parse free-text (Urdu/English) into structured request
 */
const chatbotRequest = asyncHandler(async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({
      success: false,
      message: 'Message is required',
    });
  }

  // Call the AI service to parse the message
  let parsedFields;
  try {
    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/api/chatbot/parse`,
      { message },
      { timeout: 15000 }
    );
    // aiResponse.data = { success: true, data: { medicineName, urgency, city, ... } }
    parsedFields = aiResponse.data?.data || aiResponse.data;
  } catch (error) {
    console.error('[Chatbot] AI service error:', error.message);

    // Fallback: try to parse with simple rules
    parsedFields = fallbackParse(message);
  }

  // Create the request from parsed data
  const chatCity = parsedFields.city || req.user.city;
  const chatLocation = parsedFields.location || chatCity;

  const request = await prisma.patientRequest.create({
    data: {
      patientId: req.user.id,
      medicineName: parsedFields.medicineName || 'Unknown',
      urgency: parsedFields.urgency || 'MEDIUM',
      location: chatLocation,
      city: chatCity,
      description: parsedFields.description || message,
      quantity: parsedFields.quantity || 1,
      chatInput: message,
    },
    include: {
      patient: { select: { id: true, name: true, phone: true, city: true } },
    },
  });

  // Alert pharmacists about the new request
  const io = req.app.get('io');
  await notifyPharmacistsOfNewRequest(io, request);

  res.status(201).json({
    success: true,
    message: 'Request created from chat',
    data: {
      request,
      parsed: parsedFields,
    },
  });
});

/**
 * Fallback parser for when AI service is unavailable
 */
function fallbackParse(message) {
  const lowerMsg = message.toLowerCase();

  // Extract medicine name (common Pakistani medicines)
  const knownMedicines = [
    'insulin', 'metformin', 'glimepiride', 'panadol', 'augmentin',
    'amlodipine', 'atorvastatin', 'omeprazole', 'losartan', 'salbutamol',
    'paracetamol', 'amoxicillin', 'ciprofloxacin', 'dexamethasone',
    'prednisolone', 'clopidogrel', 'warfarin', 'aspirin',
  ];

  let medicineName = null;
  for (const med of knownMedicines) {
    if (lowerMsg.includes(med)) {
      medicineName = med.charAt(0).toUpperCase() + med.slice(1);
      break;
    }
  }

  // Extract urgency
  let urgency = 'MEDIUM';
  if (lowerMsg.includes('urgent') || lowerMsg.includes('emergency') || lowerMsg.includes('critical')) {
    urgency = 'CRITICAL';
  } else if (lowerMsg.includes('soon') || lowerMsg.includes('need it')) {
    urgency = 'HIGH';
  }

  // Extract city
  const cities = ['karachi', 'lahore', 'islamabad', 'rawalpindi', 'peshawar', 'quetta', 'faisalabad', 'multan'];
  let city = null;
  for (const c of cities) {
    if (lowerMsg.includes(c)) {
      city = c.charAt(0).toUpperCase() + c.slice(1);
      break;
    }
  }

  // Extract quantity
  const qtyMatch = message.match(/(\d+)\s*(units?|boxes?|strips?|tablets?|bottles?|pens?)/i);
  const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;

  return { medicineName, urgency, city, quantity, location: city };
}

/**
 * GET /api/patients/my-requests
 */
const getMyRequests = asyncHandler(async (req, res) => {
  const { status, urgency, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 20 } = req.query;

  const where = { patientId: req.user.id };
  if (status) where.status = status;
  if (urgency) where.urgency = urgency;

  // Build orderBy
  const validSortFields = ['createdAt', 'urgency', 'status'];
  const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';

  const [requests, total] = await Promise.all([
    prisma.patientRequest.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { [orderField]: orderDir },
      include: {
        matches: {
          include: {
            inventoryItem: {
              include: {
                medicine: true,
                center: { select: { name: true, address: true, city: true } },
              },
            },
          },
        },
      },
    }),
    prisma.patientRequest.count({ where }),
  ]);

  res.json({
    success: true,
    data: requests,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * GET /api/patients
 * All patient requests (for pharmacist/admin view), sorted by true urgency
 * (CRITICAL > HIGH > MEDIUM > LOW), then oldest first
 */
const getAllRequests = asyncHandler(async (req, res) => {
  const { status, urgency, page = 1, limit = 100 } = req.query;

  const where = {};
  if (status) where.status = status;
  if (urgency) where.urgency = urgency;

  // Pharmacists only see requests from their own city
  if (req.user.role === 'PHARMACIST') {
    Object.assign(where, centerCityMatchesRequestFilter(req.user));
  }

  const [requests, total] = await Promise.all([
    prisma.patientRequest.findMany({
      where,
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
      orderBy: { createdAt: 'asc' },
      include: {
        patient: { select: { id: true, name: true, phone: true, city: true } },
        matches: {
          include: {
            inventoryItem: {
              include: { medicine: true, center: { select: { id: true, name: true, address: true, city: true, phone: true } } },
            },
          },
        },
      },
    }),
    prisma.patientRequest.count({ where }),
  ]);

  // Sort by urgency rank (CRITICAL first), then oldest first
  requests.sort((a, b) => {
    const rankDiff = (URGENCY_RANK[b.urgency] || 0) - (URGENCY_RANK[a.urgency] || 0);
    if (rankDiff !== 0) return rankDiff;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  res.json({
    success: true,
    data: requests,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * PATCH /api/patients/:id
 * Patient updates their own pending request
 */
const updateRequest = asyncHandler(async (req, res) => {
  const request = await prisma.patientRequest.findUnique({ where: { id: req.params.id } });

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  if (request.patientId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not authorized to update this request' });
  }

  if (request.status !== 'PENDING') {
    return res.status(400).json({
      success: false,
      message: 'Only pending requests can be edited',
    });
  }

  const { medicineName, urgency, city, description, quantity } = req.body;

  const updated = await prisma.patientRequest.update({
    where: { id: req.params.id },
    data: {
      medicineName: medicineName !== undefined ? medicineName : request.medicineName,
      urgency: urgency !== undefined ? urgency : request.urgency,
      city: city !== undefined ? city : request.city,
      description: description !== undefined ? description : request.description,
      quantity: quantity !== undefined ? parseInt(quantity) : request.quantity,
    },
  });

  res.json({ success: true, message: 'Request updated successfully', data: updated });
});

/**
 * DELETE /api/patients/:id
 * Patient deletes their own pending request
 */
const deleteRequest = asyncHandler(async (req, res) => {
  const request = await prisma.patientRequest.findUnique({ where: { id: req.params.id } });

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  if (request.patientId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not authorized to delete this request' });
  }

  if (request.status !== 'PENDING') {
    return res.status(400).json({
      success: false,
      message: 'Only pending requests can be deleted',
    });
  }

  await prisma.patientRequest.delete({ where: { id: req.params.id } });

  res.json({ success: true, message: 'Request deleted successfully' });
});

/**
 * GET /api/patients/:id
 */
const getRequestById = asyncHandler(async (req, res) => {
  const request = await prisma.patientRequest.findUnique({
    where: { id: req.params.id },
    include: {
      patient: { select: { id: true, name: true, phone: true, email: true, city: true } },
      matches: {
        include: {
          inventoryItem: {
            include: {
              medicine: true,
              center: { select: { id: true, name: true, address: true, city: true } },
            },
          },
        },
      },
    },
  });

  if (!request) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  res.json({ success: true, data: request });
});

module.exports = { createRequest, getMyRequests, getRequestById, updateRequest, deleteRequest, getAllRequests, chatbotRequest };
