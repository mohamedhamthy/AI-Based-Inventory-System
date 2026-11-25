import express from 'express';
import { createProduct, deleteProduct, getProductById, getProducts, updateProduct } from '../controllers/productController.js';
import { protect, authorizePermissions } from '../middleware/authMiddleware.js';
import { validateMongoId, validateProduct, validate } from '../validators/validation.js';

const router = express.Router();

router.route('/').get(getProducts).post(protect, authorizePermissions('products:create'), validateProduct, validate, createProduct);
router.route('/:id').get(validateMongoId('id'), validate, getProductById).put(protect, authorizePermissions('products:update'), validateMongoId('id'), validateProduct, validate, updateProduct).delete(protect, authorizePermissions('products:delete'), validateMongoId('id'), validate, deleteProduct);

export default router;
