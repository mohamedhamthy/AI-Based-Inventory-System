import express from 'express';
import { createCategory, deleteCategory, getCategories, getCategoryById, updateCategory } from '../controllers/categoryController.js';
import { protect, authorizePermissions } from '../middleware/authMiddleware.js';
import { validateCategory, validateMongoId, validate } from '../validators/validation.js';

const router = express.Router();

router.route('/').get(getCategories).post(protect, authorizePermissions('catalog:manage'), validateCategory, validate, createCategory);
router.route('/:id').get(validateMongoId('id'), validate, getCategoryById).put(protect, authorizePermissions('catalog:manage'), validateMongoId('id'), validateCategory, validate, updateCategory).delete(protect, authorizePermissions('catalog:manage'), validateMongoId('id'), validate, deleteCategory);

export default router;
