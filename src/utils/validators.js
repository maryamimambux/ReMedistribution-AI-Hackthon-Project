/**
 * Zod Validation Schemas — Centralized input validation for all API routes
 */

const { z } = require('zod');

// ─── Auth ────────────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['DONOR', 'PHARMACIST', 'PATIENT', 'ADMIN']),
  phone: z.string().max(20).optional(),
  cnic: z.string().max(15).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  centerId: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  centerId: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Must contain at least one letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
});

const verifyEmailSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Must contain at least one letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
});

// ─── Donations ───────────────────────────────────────────────────────

const createDonationSchema = z.object({
  medicineName: z.string().min(2, 'Medicine name is required').max(200),
  category: z.string().max(100).optional(),
  manufacturer: z.string().max(200).optional(),
  dosage: z.string().max(50).optional(),
  form: z.string().max(50).optional(),
  batchNumber: z.string().max(50).optional(),
  expiryDate: z.string().optional(),
  quantity: z.coerce.number().int().min(1).max(10000).default(1),
  sealIntact: z.coerce.boolean().default(true),
  storageVerified: z.coerce.boolean().default(false),
  centerId: z.string().min(1, 'Collection center is required'),
  scannedText: z.string().optional(),
  ocrConfidence: z.coerce.number().min(0).max(1).optional(),
});

const verifyDonationSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED']).optional(),
  status: z.enum(['APPROVED', 'REJECTED']).optional(),
  notes: z.string().max(1000).optional(),
  reason: z.string().max(200).optional(),
  checklist: z
    .object({
      sealIntact: z.enum(['YES', 'NO']).optional(),
      packagingMatch: z.enum(['YES', 'NO', 'OVERRIDE']).optional(),
      coldChain: z.enum(['YES', 'NO', 'N/A']).optional(),
      batchExpiry: z.enum(['YES', 'NO']).optional(),
      notes: z.string().max(1000).optional(),
    })
    .optional(),
});

const updateDonationSchema = z.object({
  medicineName: z.string().min(2, 'Medicine name is required').max(200).optional(),
  category: z.string().max(100).optional(),
  manufacturer: z.string().max(200).optional(),
  dosage: z.string().max(50).optional(),
  form: z.string().max(50).optional(),
  batchNumber: z.string().max(50).optional(),
  expiryDate: z.string().optional(),
  quantity: z.coerce.number().int().min(1).max(10000).optional(),
  sealIntact: z.coerce.boolean().optional(),
  storageVerified: z.coerce.boolean().optional(),
  centerId: z.string().optional(),
});

// ─── Patient Requests ────────────────────────────────────────────────

const createRequestSchema = z.object({
  medicineName: z.string().min(2, 'Medicine name is required').max(200),
  medicineId: z.string().optional(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  location: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
  description: z.string().max(2000).optional(),
  quantity: z.coerce.number().int().min(1).max(1000).default(1),
});

const updateRequestSchema = z.object({
  medicineName: z.string().min(2, 'Medicine name is required').max(200).optional(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  city: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  quantity: z.coerce.number().int().min(1).max(1000).optional(),
});

const chatbotRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000),
});

// ─── Matching ────────────────────────────────────────────────────────

const verifyPickupSchema = z.object({
  code: z.string().length(6, 'Pickup code must be 6 digits'),
});

const verifyPickupByCodeSchema = z.object({
  code: z.string().length(6, 'Pickup code must be 6 digits'),
  matchId: z.string().optional(), // present when verifying a scanned QR code
});

const approveMatchSchema = z.object({
  inventoryItemId: z.string().optional(), // omit to use the best-scoring candidate
});

// ─── Inventory ───────────────────────────────────────────────────────

const updateInventoryStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'RESERVED', 'DISPATCHED', 'EXPIRED']),
});

// ─── Centers ─────────────────────────────────────────────────────────

const createCenterSchema = z.object({
  name: z.string().min(2, 'Center name is required').max(200),
  address: z.string().min(5, 'Address is required').max(500),
  city: z.string().min(2, 'City is required').max(100),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(255).optional(),
  type: z.enum(['HOSPITAL', 'PHARMACY', 'NGO']).default('NGO'),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  openTime: z.string().max(10).optional(),
  closeTime: z.string().max(10).optional(),
});

// ─── Medicines ───────────────────────────────────────────────────────

const createMedicineSchema = z.object({
  name: z.string().min(2, 'Medicine name is required').max(200),
  genericName: z.string().max(200).optional(),
  category: z.string().min(2, 'Category is required').max(100),
  manufacturer: z.string().max(200).optional(),
  dosage: z.string().max(50).optional(),
  form: z.string().max(50).optional(),
  requiresColdChain: z.coerce.boolean().default(false),
});

// ─── Queries / Support Tickets ───────────────────────────────────────

const createQuerySchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(200),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

const replyQuerySchema = z.object({
  adminReply: z.string().min(1, 'Reply is required').max(2000),
});

const queryStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
});

const announcementSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  message: z.string().min(5, 'Message must be at least 5 characters').max(2000),
  targetRole: z.enum(['ALL', 'DONOR', 'PATIENT', 'PHARMACIST', 'ADMIN']).default('ALL'),
  userId: z.string().optional(),
  link: z.string().max(500).optional(),
});

// ─── Query Param Schemas (pagination, search, filter) ────────────────

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createDonationSchema,
  verifyDonationSchema,
  updateDonationSchema,
  createRequestSchema,
  updateRequestSchema,
  chatbotRequestSchema,
  verifyPickupSchema,
  verifyPickupByCodeSchema,
  approveMatchSchema,
  updateInventoryStatusSchema,
  createCenterSchema,
  createMedicineSchema,
  paginationSchema,
  createQuerySchema,
  replyQuerySchema,
  queryStatusSchema,
  announcementSchema,
};
