/**
 * Medicine Routes
 */

const express = require('express');
const router = express.Router();
const {
  getAllMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
  searchMedicines,
} = require('../controllers/medicineController');
const { authenticate, requireVerified, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createMedicineSchema } = require('../utils/validators');

router.get('/', getAllMedicines);
router.get('/search', searchMedicines);
router.get('/:id', getMedicineById);
router.post('/', authenticate, requireVerified, authorize('ADMIN', 'PHARMACIST'), validate(createMedicineSchema), createMedicine);
router.put('/:id', authenticate, requireVerified, authorize('ADMIN', 'PHARMACIST'), validate(createMedicineSchema), updateMedicine);

module.exports = router;
