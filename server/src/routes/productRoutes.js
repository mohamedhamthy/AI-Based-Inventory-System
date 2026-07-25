import express from 'express';
import { createProduct, deleteProduct, getProductById, getProducts, updateProduct } from '../controllers/productController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import { validateMongoId, validateProduct, validate } from '../validators/validation.js';

const router = express.Router();

router.route('/').get(getProducts).post(protect, authorizeRoles('super_admin', 'admin', 'manager', 'store_keeper'), validateProduct, validate, createProduct);
router.route('/:id').get(validateMongoId('id'), validate, getProductById).put(protect, authorizeRoles('super_admin', 'admin', 'manager', 'store_keeper'), validateMongoId('id'), validateProduct, validate, updateProduct).delete(protect, authorizeRoles('super_admin', 'admin', 'manager'), validateMongoId('id'), validate, deleteProduct);

export default router;
