/**
 * AI Controller — OCR, Vision, Chatbot, Demand Prediction
 */

const axios = require('axios');
const prisma = require('../config/prisma');
const { asyncHandler } = require('../utils/asyncHandler');
const { calculateRiskScore } = require('../services/riskScoring');

/**
 * POST /api/ai/ocr
 * Send medicine label image for OCR processing
 * Calls Python AI service or uses built-in text parsing
 */
const ocrScan = asyncHandler(async (req, res) => {
  const files = req.files || (req.file ? [req.file] : []);
  if (files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one image is required',
    });
  }
  if (files.length > 3) {
    return res.status(400).json({
      success: false,
      message: 'Maximum 3 images allowed',
    });
  }

  let ocrResult;

  try {
    // Try calling the Python AI service first
    const FormData = require('form-data');
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', file.buffer || require('fs').createReadStream(file.path), {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    });

    const response = await axios.post(
      `${process.env.AI_SERVICE_URL}/api/ocr`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000,
      }
    );
    ocrResult = response.data;
  } catch (error) {
    console.log('[OCR] AI service unavailable');
    // Honest fallback: don't return fake data
    return res.json({
      success: true,
      aiAvailable: false,
      data: {
        text: null,
        fields: {
          medicineName: null,
          batchNumber: null,
          expiryDate: null,
          manufacturer: null,
          dosage: null,
        },
        confidence: 0,
      },
      message: 'AI service is currently unavailable. Please fill details manually.',
    });
  }

  res.json(ocrResult);
});

/**
 * POST /api/ai/vision
 * Check medicine packaging for seal integrity and damage
 */
const visionCheck = asyncHandler(async (req, res) => {
  const files = req.files || (req.file ? [req.file] : []);
  if (files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one image is required',
    });
  }
  if (files.length > 3) {
    return res.status(400).json({
      success: false,
      message: 'Maximum 3 images allowed',
    });
  }

  let visionResult;

  try {
    const FormData = require('form-data');
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', file.buffer || require('fs').createReadStream(file.path), {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    });

    const response = await axios.post(
      `${process.env.AI_SERVICE_URL}/api/vision`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000,
      }
    );
    visionResult = response.data;
  } catch (error) {
    console.log('[Vision] AI service unavailable');
    return res.json({
      success: true,
      aiAvailable: false,
      data: {
        sealIntact: null,
        damaged: null,
        tampered: null,
        labelReadable: null,
        confidence: 0,
        flags: [],
      },
      message: 'AI vision service is currently unavailable. Please verify manually.',
    });
  }

  res.json(visionResult);
});

/**
 * POST /api/ai/chatbot/parse
 * Parse free-text patient description into structured data
 */
const chatbotParse = asyncHandler(async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({
      success: false,
      message: 'Message is required',
    });
  }

  try {
    const response = await axios.post(
      `${process.env.AI_SERVICE_URL}/api/chatbot/parse`,
      { message },
      { timeout: 15000 }
    );
    return res.json(response.data);
  } catch (error) {
    console.log('[Chatbot] AI service unavailable, using fallback parser');

    // Fallback parser
    const parsed = fallbackParse(message);
    res.json({
      success: true,
      data: {
        ...parsed,
        source: 'fallback',
        note: 'AI service not connected. Using basic keyword parsing.',
      },
    });
  }
});

/**
 * GET /api/ai/forecast?city=...&category=...&months=6
 * Get demand forecast for a city/medicine category
 */
const demandForecast = asyncHandler(async (req, res) => {
  const { city, category, months = 6 } = req.query;

  try {
    const response = await axios.get(
      `${process.env.AI_SERVICE_URL}/api/forecast`,
      { params: { city, category, months }, timeout: 10000 }
    );
    return res.json(response.data);
  } catch (error) {
    console.log('[Forecast] AI service unavailable, using historical data');

    // Fallback: build a forecast for the requested number of months
    const monthCount = Math.min(parseInt(months) || 6, 24);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthCount + 1);

    const requests = await prisma.patientRequest.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...(city && { city }),
        ...(category && { medicineName: { contains: category, mode: 'insensitive' } }),
      },
      select: { createdAt: true, medicineName: true, quantity: true },
    });

    // Initialize all months with zero predicted demand
    const monthly = {};
    for (let i = 0; i < monthCount; i++) {
      const d = new Date(endDate.getFullYear(), endDate.getMonth() - (monthCount - 1 - i), 1);
      const key = d.toISOString().slice(0, 7);
      monthly[key] = { month: key, predicted: 0, requests: 0 };
    }

    requests.forEach((r) => {
      const key = r.createdAt.toISOString().slice(0, 7);
      if (monthly[key]) {
        monthly[key].requests++;
        monthly[key].predicted += r.quantity;
      }
    });

    res.json({
      success: true,
      data: {
        forecast: Object.values(monthly),
        source: 'historical',
        note: 'AI service not connected. Showing historical demand data.',
      },
    });
  }
});

/**
 * Fallback text parser
 */
function fallbackParse(message) {
  const lowerMsg = message.toLowerCase();

  const knownMedicines = [
    'insulin', 'metformin', 'glimepiride', 'panadol', 'augmentin',
    'amlodipine', 'atorvastatin', 'omeprazole', 'losartan', 'salbutamol',
    'paracetamol', 'amoxicillin', 'ciprofloxacin', 'dexamethasone',
  ];

  let medicineName = null;
  for (const med of knownMedicines) {
    if (lowerMsg.includes(med)) {
      medicineName = med.charAt(0).toUpperCase() + med.slice(1);
      break;
    }
  }

  let urgency = 'MEDIUM';
  if (/urgent|emergency|critical|asap|immediately/.test(lowerMsg)) urgency = 'CRITICAL';
  else if (/soon|need it|running out/.test(lowerMsg)) urgency = 'HIGH';

  const cities = ['karachi', 'lahore', 'islamabad', 'rawalpindi', 'peshawar', 'quetta', 'faisalabad', 'multan'];
  let city = null;
  for (const c of cities) {
    if (lowerMsg.includes(c)) {
      city = c.charAt(0).toUpperCase() + c.slice(1);
      break;
    }
  }

  const qtyMatch = message.match(/(\d+)\s*(units?|boxes?|strips?|tablets?|bottles?|pens?)/i);
  const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;

  return { medicineName, urgency, city, quantity, location: city };
}

module.exports = { ocrScan, visionCheck, chatbotParse, demandForecast };
