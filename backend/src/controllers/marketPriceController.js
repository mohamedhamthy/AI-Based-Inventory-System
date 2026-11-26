import mongoose from 'mongoose';
import MarketPrice from '../models/MarketPrice.js';
import MarketPriceForecast from '../models/MarketPriceForecast.js';
import Product from '../models/Product.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { differenceInBusinessCalendarDays } from '../utils/businessTime.js';
import { loadMarketPriceAnalysis } from '../services/marketPriceAnalysis.js';
import { buildPriceForecastSummary, runPriceForecast } from '../services/marketPriceForecast.js';
import { isDemoUser } from '../middleware/authMiddleware.js';

const priceTypes = new Set(['Retail', 'Wholesale', 'Online', 'Other']);
const getRecommendationNote = (recommendation) => {
  if (recommendation === 'Buy Now') {
    return 'The forecast is reliable, stock is at or below its reorder point, and the saved supplier cost is below the predicted market price. Confirm a current supplier quote before buying.';
  }
  if (recommendation === 'Wait') {
    return 'The forecast is reliable and indicates a meaningful decrease while stock is above its reorder point. Recheck stock and supplier quotes before delaying a purchase.';
  }
  return 'Prediction is uncertain, inventory/quote conditions do not support acting, or the change is not meaningful; monitor prices and verify supplier quotes.';
};
const isValidPrice = (value) => (
  (typeof value === 'number' || typeof value === 'string')
  && String(value).trim() !== ''
  && Number.isFinite(Number(value))
  && Number(value) > 0
);
const parseRecordedAt = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getProduct = async (productId, workspaceId) => {
  if (!mongoose.isValidObjectId(productId)) return null;
  return Product.findOne({ _id: productId, workspaceId, isActive: true })
    .select('productName sku oemPartNumber currentStock minimumStock costPrice sellingPrice')
    .lean();
};

const validatePriceInput = (body) => {
  const errors = [];
  if (!mongoose.isValidObjectId(body.productId)) errors.push({ field: 'productId', message: 'Select a valid product' });
  if (!isValidPrice(body.price)) errors.push({ field: 'price', message: 'Price must be greater than zero' });
  if (typeof body.source !== 'string' || !body.source.trim() || body.source.trim().length > 120) {
    errors.push({ field: 'source', message: 'Source/shop name is required and must be 120 characters or fewer' });
  }
  if (!priceTypes.has(body.priceType)) errors.push({ field: 'priceType', message: 'Select a valid price type' });
  if (body.currency !== undefined && body.currency !== 'LKR') errors.push({ field: 'currency', message: 'Currency must be LKR' });
  if (!parseRecordedAt(body.recordedAt)) errors.push({ field: 'recordedAt', message: 'Enter a valid recorded date' });
  return errors;
};

export const getMarketPriceHistory = asyncHandler(async (req, res) => {
  const data = await loadMarketPriceAnalysis(req.params.productId, req.workspaceId);
  res.status(200).json({ success: true, data });
});

export const getLatestMarketPriceForecast = asyncHandler(async (req, res, next) => {
  const days = Number(req.query.days || 7);
  const priceType = req.query.priceType || 'Retail';
  if (![7, 30, 60].includes(days)) return next(new AppError('Forecast period must be 7, 30, or 60 days', 400));
  if (!priceTypes.has(priceType)) return next(new AppError('Select a valid price type', 400));
  const product = await getProduct(req.params.productId, req.workspaceId);
  if (!product) return next(new AppError('Product not found', 404));
  const forecast = await MarketPriceForecast.findOne({
    workspaceId: req.workspaceId,
    product: product._id,
    priceType,
    forecastPeriod: days,
  }).sort({ generatedAt: -1, createdAt: -1 }).lean();
  const currentRecord = await MarketPrice.findOne({
    workspaceId: req.workspaceId,
    product: product._id,
    priceType,
    currency: 'LKR',
  }).sort({ recordedAt: -1, createdAt: -1 }).select('price recordedAt').lean();
  const now = new Date();
  res.status(200).json({
    success: true,
    data: {
      forecast,
      currentPrice: currentRecord?.price ?? null,
      currentRecordedAt: currentRecord?.recordedAt ?? null,
      latestObservationAgeDays: currentRecord
        ? differenceInBusinessCalendarDays(currentRecord.recordedAt, now)
        : null,
      recommendationNote: getRecommendationNote(forecast?.recommendation || 'Monitor Price'),
    },
  });
});

export const createMarketPrice = asyncHandler(async (req, res, next) => {
  const body = req.body || {};
  const errors = validatePriceInput(body);
  if (errors.length) return res.status(400).json({ success: false, message: 'Validation failed', errors });
  const product = await getProduct(body.productId, req.workspaceId);
  if (!product) return next(new AppError('Product not found', 404));

  const record = await MarketPrice.create({
    workspaceId: req.workspaceId,
    product: product._id,
    productName: product.productName,
    price: Number(body.price),
    source: body.source.trim(),
    priceType: body.priceType,
    currency: 'LKR',
    recordedAt: parseRecordedAt(body.recordedAt),
    recordedBy: req.user._id,
  });
  res.status(201).json({ success: true, message: 'Market price recorded', data: { record } });
});

export const updateMarketPrice = asyncHandler(async (req, res, next) => {
  const body = req.body || {};
  const errors = [];
  if (!isValidPrice(body.price)) errors.push({ field: 'price', message: 'Price must be greater than zero' });
  if (typeof body.source !== 'string' || !body.source.trim() || body.source.trim().length > 120) {
    errors.push({ field: 'source', message: 'Source/shop name is required and must be 120 characters or fewer' });
  }
  if (!priceTypes.has(body.priceType)) errors.push({ field: 'priceType', message: 'Select a valid price type' });
  if (body.currency !== undefined && body.currency !== 'LKR') errors.push({ field: 'currency', message: 'Currency must be LKR' });
  if (!parseRecordedAt(body.recordedAt)) errors.push({ field: 'recordedAt', message: 'Enter a valid recorded date' });
  if (errors.length) return res.status(400).json({ success: false, message: 'Validation failed', errors });

  const record = await MarketPrice.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
  if (!record) return next(new AppError('Market price record not found', 404));
  Object.assign(record, {
    price: Number(body.price),
    source: body.source.trim(),
    priceType: body.priceType,
    recordedAt: parseRecordedAt(body.recordedAt),
    recordedBy: req.user._id,
  });
  await record.save();
  res.status(200).json({ success: true, message: 'Market price updated', data: { record } });
});

export const deleteMarketPrice = asyncHandler(async (req, res, next) => {
  const record = await MarketPrice.findOneAndDelete({ _id: req.params.id, workspaceId: req.workspaceId });
  if (!record) return next(new AppError('Market price record not found', 404));
  res.status(200).json({ success: true, message: 'Market price deleted' });
});

export const importMarketPrices = asyncHandler(async (req, res, next) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 500) {
    return next(new AppError('Provide between 1 and 500 CSV rows per import', 400));
  }
  if (rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    return next(new AppError('Every CSV row must contain named columns', 400));
  }

  const ids = [...new Set(rows.map((row) => row.productId).filter((id) => mongoose.isValidObjectId(id)))];
  const skus = [...new Set(rows.map((row) => typeof row.sku === 'string' ? row.sku.trim() : '').filter(Boolean))];
  const products = await Product.find({
    workspaceId: req.workspaceId,
    isActive: true,
    $or: [{ _id: { $in: ids } }, { sku: { $in: skus } }],
  }).select('productName sku oemPartNumber').lean();
  const productMap = new Map();
  products.forEach((product) => {
    productMap.set(String(product._id), product);
    productMap.set(`sku:${product.sku}`, product);
  });

  const errors = [];
  const documents = rows.map((row, index) => {
    const rowNumber = index + 2;
    const product = mongoose.isValidObjectId(row.productId)
      ? productMap.get(String(row.productId))
      : productMap.get(`sku:${String(row.sku || '').trim()}`);
    const price = Number(row.price);
    const source = typeof row.source === 'string' ? row.source.trim() : '';
    const priceType = row.priceType;
    const recordedAt = parseRecordedAt(row.recordedAt);
    if (!product) errors.push({ row: rowNumber, field: 'productId/sku', message: 'Product was not found in this inventory' });
    if (!isValidPrice(price)) errors.push({ row: rowNumber, field: 'price', message: 'Price must be greater than zero' });
    if (!source || source.length > 120) errors.push({ row: rowNumber, field: 'source', message: 'Source/shop name is required (max 120 characters)' });
    if (!priceTypes.has(priceType)) errors.push({ row: rowNumber, field: 'priceType', message: 'Price type must be Retail, Wholesale, Online, or Other' });
    if (row.currency && row.currency !== 'LKR') errors.push({ row: rowNumber, field: 'currency', message: 'Currency must be LKR' });
    if (!recordedAt) errors.push({ row: rowNumber, field: 'recordedAt', message: 'Recorded date must be a valid ISO date or date string' });
    if (!product || !isValidPrice(price) || !source || source.length > 120 || !priceTypes.has(priceType) || (row.currency && row.currency !== 'LKR') || !recordedAt) {
      return null;
    }
    return {
      workspaceId: req.workspaceId,
      product: product._id,
      productName: product.productName,
      price,
      source,
      priceType,
      currency: 'LKR',
      recordedAt,
      recordedBy: req.user._id,
    };
  });
  if (errors.length) return res.status(400).json({ success: false, message: 'Import contains invalid rows; no records were imported', errors });

  const records = await MarketPrice.insertMany(documents);
  res.status(201).json({ success: true, message: `${records.length} market price records imported`, data: { imported: records.length } });
});

export const forecastMarketPrice = asyncHandler(async (req, res, next) => {
  const body = req.body || {};
  const days = Number(body.days);
  const priceType = body.priceType;
  if (![7, 30, 60].includes(days)) return next(new AppError('Forecast period must be 7, 30, or 60 days', 400));
  if (!priceTypes.has(priceType)) return next(new AppError('Select a valid price type', 400));
  const product = await getProduct(req.params.productId, req.workspaceId);
  if (!product) return next(new AppError('Product not found', 404));

  const newestFirstHistory = await MarketPrice.find({
    workspaceId: req.workspaceId,
    product: product._id,
    priceType,
    currency: 'LKR',
  }).sort({ recordedAt: -1, createdAt: -1 }).select('price recordedAt createdAt').lean();
  const currentRecord = newestFirstHistory[0] || null;
  const history = newestFirstHistory.slice().reverse();
  const result = await runPriceForecast(history.map(({ price, recordedAt }) => ({ price, recordedAt })), days);
  const currentPrice = currentRecord?.price ?? null;
  const forecastRunAt = new Date();
  const forecastSummary = buildPriceForecastSummary({
    workspaceId: req.workspaceId,
    product,
    currentPrice,
    result,
    priceType,
    forecastPeriod: days,
    generatedAt: forecastRunAt,
    generatedBy: req.user._id,
  });
  const forecast = isDemoUser(req.user)
    ? forecastSummary
    : await MarketPriceForecast.create(forecastSummary);

  res.set('Cache-Control', 'private, no-store');
  res.status(200).json({
    success: true,
    data: {
      forecast,
      currentPrice,
      currentRecordedAt: currentRecord?.recordedAt ?? null,
      latestObservationAgeDays: currentRecord
        ? differenceInBusinessCalendarDays(currentRecord.recordedAt, forecastRunAt)
        : null,
      message: result.message,
      recommendationNote: getRecommendationNote(forecast.recommendation),
    },
  });
});
