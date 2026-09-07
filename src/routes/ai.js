/**
 * AI Routes — OCR, Computer Vision, Chatbot, Demand Prediction
 */

const express = require('express');
const router = express.Router();
const {
  ocrScan,
  visionCheck,
  chatbotParse,
  demandForecast,
} = require('../controllers/aiController');
const { authenticate, requireVerified } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.post('/ocr', authenticate, requireVerified, upload.array('images', 3), ocrScan);
router.post('/vision', authenticate, requireVerified, upload.array('images', 3), visionCheck);
router.post('/chatbot/parse', authenticate, requireVerified, chatbotParse);
router.get('/forecast', authenticate, requireVerified, demandForecast);

module.exports = router;
