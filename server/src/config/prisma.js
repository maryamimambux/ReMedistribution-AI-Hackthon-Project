const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

// Route Prisma logs through Pino
prisma.$on('query', (e) => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug({ duration: `${e.duration}ms` }, e.query);
  }
});

prisma.$on('warn', (e) => {
  logger.warn(e.message, 'Prisma warning');
});

prisma.$on('error', (e) => {
  logger.error(e.message, 'Prisma error');
});

module.exports = prisma;
