import express from 'express';
import { query } from 'express-validator';
import {
  exportInventoryReport,
  exportMonthlySalesReport,
  exportMovementReport,
  exportCustomerSalesReport,
  exportSalesReport,
  getInventoryReport,
  getMonthlySalesSummary,
  getMovementReport,
  getSalesReport,
} from '../controllers/reportController.js';
import { authorizePermissions } from '../middleware/authMiddleware.js';
import { validate } from '../validators/validation.js';

const router = express.Router();
const dateFilter = (label) => query(label)
  .optional()
  .isISO8601()
  .withMessage(`${label === 'from' ? 'From' : 'To'} date must be an ISO date or timestamp`)
  .bail()
  .custom((value) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
    if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return true;
    throw new Error('Timestamp must include a timezone offset (Z or ±HH:MM)');
  });
const sharedFilters = [
  dateFilter('from'),
  dateFilter('to'),
  query('productId').optional().isMongoId().withMessage('Product id must be valid'),
  query('categoryId').optional().isMongoId().withMessage('Category id must be valid'),
  query('supplierId').optional().isMongoId().withMessage('Supplier id must be valid'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];
const withFilters = (...extra) => [...sharedFilters, ...extra, validate];
const reportAccess = authorizePermissions('reports:read');

router.get('/inventory', reportAccess, ...withFilters(
  query('status').optional().isIn(['all', 'low_stock', 'out_of_stock', 'in_stock']),
), getInventoryReport);
router.get('/inventory/export.csv', reportAccess, ...withFilters(
  query('status').optional().isIn(['all', 'low_stock', 'out_of_stock', 'in_stock']),
  query('includeInactive').optional().isBoolean(),
), exportInventoryReport);
router.get('/movements', reportAccess, ...withFilters(
  query('type').optional().isIn(['stock_in', 'sale', 'adjustment']),
), getMovementReport);
router.get('/movements/export.csv', reportAccess, ...withFilters(
  query('type').optional().isIn(['stock_in', 'sale', 'adjustment']),
), exportMovementReport);
router.get('/sales', reportAccess, ...withFilters(), getSalesReport);
router.get('/sales/customers/export.csv', reportAccess, ...withFilters(), exportCustomerSalesReport);
router.get('/sales/monthly', reportAccess, ...withFilters(), getMonthlySalesSummary);
router.get('/sales/export.csv', reportAccess, ...withFilters(), exportSalesReport);
router.get('/sales/monthly/export.csv', reportAccess, ...withFilters(), exportMonthlySalesReport);

export default router;
