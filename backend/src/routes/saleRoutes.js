import express from 'express';
import { body } from 'express-validator';
import { createSale, getSales } from '../controllers/saleController.js';
import { protect, authorizePermissions } from '../middleware/authMiddleware.js';
import { validate, validateIdempotencyKeyHeader } from '../validators/validation.js';

const router = express.Router();

router.route('/')
  .get(protect, authorizePermissions('sales:read'), getSales)
  .post(
    protect,
    authorizePermissions('sales:create'),
    body('customerName').optional().isString().trim().notEmpty(),
    body('customerId').optional().isMongoId(),
    body('product').optional().isMongoId(),
    body('quantity').optional().isFloat({ min: 1 }),
    body('unitPrice').optional().isFloat({ min: 0 }),
    body('items').optional().isArray({ min: 1, max: 50 }),
    body('items.*.productId').optional().isMongoId(),
    body('items.*.quantity').optional().isFloat({ min: 1 }),
    body('items.*.unitPrice').optional().isFloat({ min: 0 }),
    body().custom((_value, { req }) => {
      const hasItems = Array.isArray(req.body.items) && req.body.items.length > 0;
      const hasLegacyLine = req.body.product && req.body.quantity !== undefined && req.body.unitPrice !== undefined;
      if (!hasItems && !hasLegacyLine) throw new Error('Provide one product line or an items array');
      if (!req.body.customerId && !req.body.customerName) throw new Error('Select a customer or enter a customer name');
      return true;
    }),
    body('paymentStatus').optional().isIn(['Paid', 'Pending', 'Partial']),
    body('phone').optional().isString(),
    body('notes').optional().isString(),
    validateIdempotencyKeyHeader(),
    validate,
    createSale,
  );

export default router;
