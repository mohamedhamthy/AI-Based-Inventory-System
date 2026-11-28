import Product from "../models/Product.js";
import MarketPrice from "../models/MarketPrice.js";
import AppError from "../utils/AppError.js";
import { buildSellingPriceRecommendation } from "./aiRecommendations.js";

const HISTORY_LIMIT = 500;
const SELLING_PRICE_REFERENCE_LIMIT = 10;
const priceTypes = ["Retail", "Wholesale", "Online", "Other"];
const roundMoney = (value) => Number(value.toFixed(2));

const summarizeType = (records) => {
  const newestFirst = records
    .slice()
    .sort(
      (left, right) =>
        new Date(right.recordedAt) - new Date(left.recordedAt) ||
        new Date(right.createdAt) - new Date(left.createdAt),
    );
  if (!newestFirst.length) {
    return {
      observationCount: 0,
      averagePrice: null,
      latestPrice: null,
      latestRecordedAt: null,
      latestSource: null,
      earliestPrice: null,
      changeAmount: null,
      percentageChange: null,
      sourceComparisons: [],
    };
  }

  const latest = newestFirst[0];
  const earliest = newestFirst[newestFirst.length - 1];
  const sourceGroups = new Map();
  for (const record of newestFirst) {
    if (!sourceGroups.has(record.source)) sourceGroups.set(record.source, []);
    sourceGroups.get(record.source).push(record);
  }
  const sourceComparisons = [...sourceGroups.entries()]
    .map(([source, observations]) => {
      const sourceLatest = observations[0];
      return {
        source,
        observationCount: observations.length,
        averagePrice: roundMoney(
          observations.reduce((sum, item) => sum + Number(item.price), 0) /
            observations.length,
        ),
        latestPrice: Number(sourceLatest.price),
        latestRecordedAt: sourceLatest.recordedAt,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.latestRecordedAt) - new Date(left.latestRecordedAt),
    );
  const changeAmount = roundMoney(
    Number(latest.price) - Number(earliest.price),
  );

  return {
    observationCount: newestFirst.length,
    averagePrice: roundMoney(
      newestFirst.reduce((sum, item) => sum + Number(item.price), 0) /
        newestFirst.length,
    ),
    latestPrice: Number(latest.price),
    latestRecordedAt: latest.recordedAt,
    latestSource: latest.source,
    earliestPrice: Number(earliest.price),
    changeAmount,
    percentageChange:
      Number(earliest.price) > 0
        ? roundMoney((changeAmount / Number(earliest.price)) * 100)
        : null,
    sourceComparisons,
  };
};

export const buildMarketPriceAnalysis = (records, truncated = false) => {
  const byPriceType = Object.fromEntries(
    priceTypes.map((priceType) => [
      priceType,
      summarizeType(records.filter((record) => record.priceType === priceType)),
    ]),
  );
  return {
    observationsUsed: records.length,
    historyLimit: HISTORY_LIMIT,
    truncated,
    byPriceType,
  };
};

export const loadMarketPriceAnalysis = async (
  productId,
  workspaceId,
  { ProductModel = Product, MarketPriceModel = MarketPrice } = {},
) => {
  const product = await ProductModel.findOne({
    _id: productId,
    workspaceId,
    isActive: true,
  })
    .select(
      "productName sku oemPartNumber currentStock minimumStock costPrice sellingPrice",
    )
    .lean();
  if (!product) throw new AppError("Product not found", 404);

  const recordsWithSentinel = await MarketPriceModel.find({
    workspaceId,
    product: product._id,
  })
    .sort({ recordedAt: -1, createdAt: -1 })
    .limit(HISTORY_LIMIT + 1)
    .select(
      "_id productName price source priceType currency recordedAt createdAt",
    )
    .lean();
  const truncated = recordsWithSentinel.length > HISTORY_LIMIT;
  const records = recordsWithSentinel.slice(0, HISTORY_LIMIT);
  const retailObservations = await MarketPriceModel.find({
    workspaceId,
    product: product._id,
    priceType: "Retail",
    currency: "LKR",
  })
    .sort({ recordedAt: -1, createdAt: -1 })
    .limit(SELLING_PRICE_REFERENCE_LIMIT)
    .select("price source recordedAt")
    .lean();

  return {
    product,
    records,
    analysis: buildMarketPriceAnalysis(records, truncated),
    sellingPriceRecommendation: buildSellingPriceRecommendation({
      costPrice: product.costPrice,
      currentSellingPrice: product.sellingPrice,
      retailObservations,
    }),
  };
};
