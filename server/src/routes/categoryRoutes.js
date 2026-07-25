import express from 'express';
import { createCategory, deleteCategory, getCategories, getCategoryById, updateCategory } from '../controllers/categoryController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import { validateCategory, validateMongoId, validate } from '../validators/validation.js';

const router = express.Router();

router.route('/').get(getCategories).post(protect, authorizeRoles('super_admin', 'admin', 'manager'), validateCategory, validate, createCategory);
router.route('/:id').get(validateMongoId('id'), validate, getCategoryById).put(protect, authorizeRoles('super_admin', 'admin', 'manager'), validateMongoId('id'), validateCategory, validate, updateCategory).delete(protect, authorizeRoles('super_admin', 'admin', 'manager'), validateMongoId('id'), validate, deleteCategory);

export default router;
