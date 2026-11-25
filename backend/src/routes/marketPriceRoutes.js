import express from 'express';
import {
  createMarketPrice,
  deleteMarketPrice,
  forecastMarketPrice,
  getLatestMarketPriceForecast,
  getMarketPriceHistory,
  importMarketPrices,
  updateMarketPrice,
} from '../controllers/marketPriceController.js';
import { authorizePermissions } from '../middleware/authMiddleware.js';
import { validate, validateMongoId } from '../validators/validation.js';

const router = express.Router();
const canManagePrices = authorizePermissions('marketPrices:manage');
const canViewPrices = authorizePermissions('marketPrices:read');

router.get('/history/:productId', canViewPrices, validateMongoId('productId'), validate, getMarketPriceHistory);
router.get('/:productId/forecast', canViewPrices, validateMongoId('productId'), validate, getLatestMarketPriceForecast);
router.post('/import', canManagePrices, importMarketPrices);
router.post('/:productId/forecast', canViewPrices, validateMongoId('productId'), validate, forecastMarketPrice);
router.post('/', canManagePrices, createMarketPrice);
router.put('/:id', canManagePrices, validateMongoId('id'), validate, updateMarketPrice);
router.delete('/:id', canManagePrices, validateMongoId('id'), validate, deleteMarketPrice);

export default router;
