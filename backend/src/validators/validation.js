import { body, header, param, validationResult } from 'express-validator';
import { USER_ROLES } from '../constants/userRoles.js';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((error) => ({ field: error.path, message: error.msg })),
    });
  }
  next();
};

export const validateMongoId = (field = 'id') => param(field).isMongoId().withMessage(`${field} must be a valid MongoDB ID`);

export const validateIdempotencyKeyHeader = () => header('Idempotency-Key')
  .exists().withMessage('Idempotency-Key header is required')
  .bail()
  .isString().withMessage('Idempotency-Key must be a string')
  .bail()
  .trim()
  .notEmpty().withMessage('Idempotency-Key cannot be blank')
  .bail()
  .isLength({ min: 8, max: 128 }).withMessage('Idempotency-Key must be between 8 and 128 characters')
  .bail()
  .matches(/^[A-Za-z0-9._:-]+$/).withMessage('Idempotency-Key contains invalid characters');

export const validateUserCreate = [
  body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be between 2 and 80 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters'),
  body('role').optional().isIn(USER_ROLES).withMessage('Role is not supported'),
];

export const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isString().notEmpty().isLength({ max: 128 }).withMessage('Password is required'),
];

export const validateChangePassword = [
  body('currentPassword').isString().notEmpty().isLength({ max: 128 }).withMessage('Current password is required'),
  body('newPassword')
    .isString().withMessage('New password is required')
    .bail()
    .isLength({ min: 8, max: 128 }).withMessage('New password must be between 8 and 128 characters')
    .bail()
    .custom((value, { req }) => {
      if (typeof req.body.currentPassword === 'string' && value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),
  body('confirmPassword')
    .isString().withMessage('Confirm password is required')
    .bail()
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('New password and confirm password must match');
      }
      return true;
    }),
];

export const validateProduct = [
  body('productName').trim().notEmpty().withMessage('Product name is required'),
  body('sku').trim().notEmpty().withMessage('SKU is required'),
  body('oemPartNumber').optional({ nullable: true }).isString().withMessage('OEM part number must be text').bail().isLength({ max: 100 }).withMessage('OEM part number must be 100 characters or fewer'),
  body('barcode').optional({ nullable: true }).isString().withMessage('Barcode must be text'),
  body('category').notEmpty().withMessage('Category is required'),
  body('supplier').notEmpty().withMessage('Supplier is required'),
  body('costPrice').optional().isFloat({ min: 0 }).withMessage('Cost price must be zero or greater'),
  body('sellingPrice').optional().isFloat({ min: 0 }).withMessage('Selling price must be zero or greater'),
  body('currentStock').optional().isFloat({ min: 0 }).withMessage('Current stock must be zero or greater'),
  body('minimumStock').optional().isFloat({ min: 0 }).withMessage('Minimum stock must be zero or greater'),
  body('maximumStock').optional().isFloat({ min: 0 }).withMessage('Maximum stock must be zero or greater'),
  body('stockReference').optional().isString().trim().isLength({ max: 120 }).withMessage('Stock reference must be at most 120 characters'),
  body('stockReason').optional().isString().trim().isLength({ max: 500 }).withMessage('Stock reason must be at most 500 characters'),
  body('sellingPrice').custom((value, { req }) => {
    if (value && req.body.costPrice !== undefined && Number(value) <= Number(req.body.costPrice)) {
      throw new Error('Selling price must be greater than cost price');
    }
    return true;
  }),
  body('maximumStock').custom((value, { req }) => {
    if (value && req.body.minimumStock !== undefined && Number(value) <= Number(req.body.minimumStock)) {
      throw new Error('Maximum stock must be greater than minimum stock');
    }
    return true;
  }),
];

export const validateCategory = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('code').trim().notEmpty().withMessage('Category code is required'),
];

export const validateSupplier = [
  body('name').trim().notEmpty().withMessage('Supplier name is required'),
  body('supplierCode').trim().notEmpty().withMessage('Supplier code is required'),
];

export const validateUserUpdate = [
  body('role').optional().isIn(USER_ROLES).withMessage('Role is not supported'),
  body('isActive').optional().isBoolean().withMessage('Active status must be a boolean').toBoolean(),
];
