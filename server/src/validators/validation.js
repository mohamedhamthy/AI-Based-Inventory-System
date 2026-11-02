import { body, param, validationResult } from 'express-validator';

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

export const validateRegister = [
  body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be between 2 and 80 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters'),
];

export const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isString().notEmpty().isLength({ max: 128 }).withMessage('Password is required'),
];

export const validateProduct = [
  body('productName').trim().notEmpty().withMessage('Product name is required'),
  body('sku').trim().notEmpty().withMessage('SKU is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('supplier').notEmpty().withMessage('Supplier is required'),
  body('costPrice').optional().isFloat({ min: 0 }).withMessage('Cost price must be zero or greater'),
  body('sellingPrice').optional().isFloat({ min: 0 }).withMessage('Selling price must be zero or greater'),
  body('currentStock').optional().isFloat({ min: 0 }).withMessage('Current stock must be zero or greater'),
  body('minimumStock').optional().isFloat({ min: 0 }).withMessage('Minimum stock must be zero or greater'),
  body('maximumStock').optional().isFloat({ min: 0 }).withMessage('Maximum stock must be zero or greater'),
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
