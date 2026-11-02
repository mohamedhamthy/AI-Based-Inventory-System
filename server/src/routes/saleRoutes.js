import express from 'express';
import { createSale, getSales } from '../controllers/saleController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/').get(protect, authorizeRoles('super_admin', 'admin', 'manager', 'store_keeper', 'demo'), getSales).post(protect, authorizeRoles('super_admin', 'admin', 'manager', 'store_keeper'), createSale);

export default router;
