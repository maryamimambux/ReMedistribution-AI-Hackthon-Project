/**
 * ReMedistribution — Server Entry Point
 *
 * Production-hardened Express server with:
 * - httpOnly cookie auth + Bearer fallback
 * - Rate limiting (express-rate-limit)
 * - Structured logging (Pino)
 * - Input validation (Zod) on all routes
 * - Enhanced health check with DB connectivity
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server: SocketServer } = require('socket.io');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const logger = require('./utils/logger');
const prisma = require('./config/prisma');

// Route imports
const authRoutes = require('./routes/auth');
const medicineRoutes = require('./routes/medicines');
const donationRoutes = require('./routes/donations');
const centerRoutes = require('./routes/centers');
const inventoryRoutes = require('./routes/inventory');
const patientRoutes = require('./routes/patients');
const matchRoutes = require('./routes/matching');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes = require('./routes/ai');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const queryRoutes = require('./routes/queries');

// Middleware imports
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');

const app = express();
const httpServer = createServer(app);

// Socket.io for real-time updates
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

// ─── Global Middleware ────────────────────────────────────────────────

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Structured request logging via Pino (replaces morgan in production)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    };
    if (res.statusCode >= 400) {
      logger.warn(logData, 'Request failed');
    } else {
      logger.info(logData, 'Request completed');
    }
  });
  next();
});

// ─── Rate Limiting ────────────────────────────────────────────────────

// General API rate limit — 200 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// Stricter limit for auth endpoints — 50 per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Health Check ─────────────────────────────────────────────────────

app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {},
  };

  // DB connectivity check
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = 'connected';
  } catch {
    health.checks.database = 'disconnected';
    health.status = 'degraded';
  }

  // AI service check (non-blocking)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const aiRes = await fetch(`${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    health.checks.aiService = aiRes.ok ? 'available' : 'unavailable';
  } catch {
    health.checks.aiService = 'unavailable';
  }

  // Socket.io connection count
  health.checks.socketConnections = io.engine.clientsCount;

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// ─── API Routes ───────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/centers', centerRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/matching', matchRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/queries', queryRoutes);

// ─── Socket.io ────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  logger.debug({ socketId: socket.id }, 'Socket client connected');

  socket.on('join:pharmacist', (centerId) => socket.join(`center:${centerId}`));
  socket.on('join:patient', (patientId) => socket.join(`patient:${patientId}`));
  socket.on('join:user', (userId) => socket.join(`user:${userId}`));
  socket.on('join:donor', (donorId) => socket.join(`donor:${donorId}`));

  socket.on('disconnect', () => {
    logger.debug({ socketId: socket.id }, 'Socket client disconnected');
  });
});

// ─── Error Handling ───────────────────────────────────────────────────

app.use(notFound);
app.use(errorHandler);

// ─── Graceful Shutdown ────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;

const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  httpServer.close(async () => {
    await prisma.$disconnect();
    logger.info('Server closed');
    process.exit(0);
  });

  // Force close after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

httpServer.listen(PORT, () => {
  logger.info(`ReMedistribution API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = { app, io };
