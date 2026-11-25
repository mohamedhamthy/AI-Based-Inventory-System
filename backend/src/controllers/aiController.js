import MarketPriceForecast from '../models/MarketPriceForecast.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import { getDemandInsights } from '../services/demandService.js';
import { buildAssistantResponse } from '../services/assistantResponse.js';

export const getDemandForecast = asyncHandler(async (req, res) => {
  const insights = await getDemandInsights(req.workspaceId);
  res.set('Cache-Control', 'private, no-store');
  res.status(200).json({ success: true, data: insights });
});

export const askInventoryAssistant = asyncHandler(async (req, res, next) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < 2 || query.length > 250) {
    return next(new AppError('Ask a question between 2 and 250 characters', 400));
  }

  const insights = await getDemandInsights(req.workspaceId);
  let savedPriceForecasts = [];
  if (/(price|market|cost)/i.test(query)) {
    const records = await MarketPriceForecast.find({
      workspaceId: req.workspaceId,
      status: 'reliable',
    })
      .sort({ generatedAt: -1 })
      .limit(100)
      .select('product productName priceType forecastPeriod predictedPrice metrics generatedAt')
      .lean();
    const latestByProduct = new Map();
    records.forEach((record) => {
      const key = String(record.product);
      if (!latestByProduct.has(key)) latestByProduct.set(key, record);
    });
    savedPriceForecasts = [...latestByProduct.values()];
  }

  const reply = buildAssistantResponse(query, insights.items, savedPriceForecasts);
  res.set('Cache-Control', 'private, no-store');
  res.status(200).json({
    success: true,
    data: { reply, generatedAt: insights.generatedAt },
  });
});
