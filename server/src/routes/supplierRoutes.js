import express from 'express';
import { createSupplier, deleteSupplier, getSupplierById, getSuppliers, updateSupplier } from '../controllers/supplierController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import { validateMongoId, validateSupplier, validate } from '../validators/validation.js';

const router = express.Router();

router.route('/').get(getSuppliers).post(protect, authorizeRoles('super_admin', 'admin', 'manager'), validateSupplier, validate, createSupplier);
router.route('/:id').get(validateMongoId('id'), validate, getSupplierById).put(protect, authorizeRoles('super_admin', 'admin', 'manager'), validateMongoId('id'), validateSupplier, validate, updateSupplier).delete(protect, authorizeRoles('super_admin', 'admin', 'manager'), validateMongoId('id'), validate, deleteSupplier);

export default router;
