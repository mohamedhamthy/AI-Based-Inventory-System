import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import { buildDemandForecast } from "./demandForecast.js";
import { buildPurchaseRecommendation } from "./aiRecommendations.js";
import {
  addBusinessCalendarDays,
  businessMidnightUtc,
  BUSINESS_TIME_ZONE,
  getBusinessDateParts,
} from "../utils/businessTime.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HISTORY_WEEKS = 26;

export const startOfBusinessWeek = (date) => {
  const { year, month, day } = getBusinessDateParts(date);
  const start = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return businessMidnightUtc(
    start.getUTCFullYear(),
    start.getUTCMonth() + 1,
    start.getUTCDate(),
  );
};

const dateKey = ({ year, month, day }) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export const getForwardDemandPeriod = (
  now,
  currentWeekStart = startOfBusinessWeek(now),
) => {
  const today = getBusinessDateParts(now);
  const startParts = addBusinessCalendarDays(today, 1);
  const endParts = addBusinessCalendarDays(startParts, 27);
  const endExclusiveParts = addBusinessCalendarDays(startParts, 28);
  const startUtc = businessMidnightUtc(
    startParts.year,
    startParts.month,
    startParts.day,
  );
  const endExclusiveUtc = businessMidnightUtc(
    endExclusiveParts.year,
    endExclusiveParts.month,
    endExclusiveParts.day,
  );
  const weekSegments = [];

  for (let dayOffset = 0; dayOffset < 28; dayOffset += 1) {
    const businessDate = addBusinessCalendarDays(startParts, dayOffset);
    const dayStart = businessMidnightUtc(
      businessDate.year,
      businessDate.month,
      businessDate.day,
    );
    const weekStart = startOfBusinessWeek(dayStart);
    const weekIndex = Math.floor(
      (weekStart.getTime() - currentWeekStart.getTime()) / WEEK_MS,
    );
    const key = dateKey(businessDate);
    while (weekSegments.length <= weekIndex) {
      weekSegments.push(null);
    }
    if (!weekSegments[weekIndex]) {
      weekSegments[weekIndex] = {
        weekIndex,
        weekStart: weekStart.toISOString(),
        startDate: key,
        endDate: key,
        includedDays: 0,
      };
    }
    weekSegments[weekIndex].endDate = key;
    weekSegments[weekIndex].includedDays += 1;
  }

  const forecastWeekDayCounts = weekSegments.map(
    (segment) => segment?.includedDays || 0,
  );
  return {
    startDate: dateKey(startParts),
    endDate: dateKey(endParts),
    endExclusiveDate: dateKey(endExclusiveParts),
    startUtc,
    endExclusiveUtc,
    dayCount: 28,
    timeZone: BUSINESS_TIME_ZONE,
    distributionAssumption:
      "Each weekly forecast is distributed evenly across its 7 Colombo calendar days; only days in this forward window contribute.",
    forecastWeekDayCounts,
    weekSegments,
  };
};

export const getDemandInsights = async (
  workspaceId,
  now = new Date(),
  {
    ProductModel = Product,
    SaleModel = Sale,
    PurchaseOrderModel = PurchaseOrder,
  } = {},
) => {
  const currentWeekStart = startOfBusinessWeek(now);
  const demandPeriod = getForwardDemandPeriod(now, currentWeekStart);
  const historyStart = new Date(
    currentWeekStart.getTime() - HISTORY_WEEKS * WEEK_MS,
  );
  const [products, salesByWeek, outstandingRows] = await Promise.all([
    ProductModel.find({ workspaceId, isActive: true })
      .select(
        "productName sku oemPartNumber currentStock minimumStock maximumStock costPrice sellingPrice unit",
      )
      .sort({ productName: 1 })
      .lean(),
    SaleModel.aggregate([
      {
        $match: {
          workspaceId,
          saleDate: { $gte: historyStart, $lt: currentWeekStart },
        },
      },
      {
        $group: {
          _id: {
            product: "$product",
            week: {
              $dateTrunc: {
                date: "$saleDate",
                unit: "week",
                startOfWeek: "monday",
                timezone: BUSINESS_TIME_ZONE,
              },
            },
          },
          quantity: { $sum: "$quantity" },
        },
      },
      { $sort: { "_id.week": 1 } },
    ]),
    PurchaseOrderModel.aggregate([
      {
        $match: {
          workspaceId,
          status: { $in: ["ordered", "partially_received"] },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          quantity: {
            $sum: {
              $subtract: ["$items.orderedQuantity", "$items.receivedQuantity"],
            },
          },
        },
      },
    ]),
  ]);

  const outstandingByProduct = new Map(
    outstandingRows.map((row) => [String(row._id), Number(row.quantity || 0)]),
  );
  const salesByProduct = new Map();
  for (const row of salesByWeek) {
    const weekStart = new Date(row._id.week);
    const weekIndex = Math.floor(
      (weekStart.getTime() - historyStart.getTime()) / WEEK_MS,
    );
    const productId = String(row._id.product);
    if (!salesByProduct.has(productId))
      salesByProduct.set(productId, Array(HISTORY_WEEKS).fill(0));
    if (weekIndex >= 0 && weekIndex < HISTORY_WEEKS) {
      salesByProduct.get(productId)[weekIndex] += row.quantity;
    }
  }

  const items = products.map((product) => {
    const currentStock = Number(product.currentStock || 0);
    const minimumStock = Number(product.minimumStock || 0);
    const series =
      salesByProduct.get(String(product._id)) || Array(HISTORY_WEEKS).fill(0);
    const forecast = buildDemandForecast(
      series,
      demandPeriod.forecastWeekDayCounts,
    );
    forecast.weeklyHistory = series.map((quantity, index) => ({
      weekStart: new Date(
        historyStart.getTime() + index * WEEK_MS,
      ).toISOString(),
      quantity,
    }));
    forecast.period = {
      startDate: demandPeriod.startDate,
      endDate: demandPeriod.endDate,
      dayCount: demandPeriod.dayCount,
      timeZone: demandPeriod.timeZone,
      distributionAssumption: demandPeriod.distributionAssumption,
    };
    forecast.weeklyForecastPeriods =
      forecast.status === "reliable"
        ? demandPeriod.weekSegments
            .filter((segment) => segment && segment.includedDays > 0)
            .map((segment) => {
              const weeklyDemandEstimate =
                forecast.weeklyForecast[segment.weekIndex];
              return {
                weekStart: segment.weekStart,
                startDate: segment.startDate,
                endDate: segment.endDate,
                includedDays: segment.includedDays,
                weeklyDemandEstimate,
                periodDemand: Number(
                  ((weeklyDemandEstimate * segment.includedDays) / 7).toFixed(
                    2,
                  ),
                ),
              };
            })
        : [];
    const outstandingQuantity =
      outstandingByProduct.get(String(product._id)) || 0;
    const purchaseRecommendation = buildPurchaseRecommendation({
      forecast,
      currentStock,
      minimumStock,
      outstandingQuantity,
    });
    const stockGap = Math.max(0, minimumStock - currentStock);
    const estimatedDaysUntilStockout =
      forecast.next28DayDemand > 0
        ? Math.floor(currentStock / (forecast.next28DayDemand / 28))
        : null;

    return {
      id: String(product._id),
      productName: product.productName,
      sku: product.sku,
      oemPartNumber: product.oemPartNumber,
      unit: product.unit,
      currentStock,
      minimumStock,
      maximumStock: Number(product.maximumStock || 0),
      costPrice: Number(product.costPrice || 0),
      sellingPrice: Number(product.sellingPrice || 0),
      stockGap,
      isLowStock: currentStock <= minimumStock,
      outstandingQuantity,
      purchaseRecommendation,
      recommendedPurchaseQty: purchaseRecommendation.suggestedQuantity,
      estimatedDaysUntilStockout,
      forecast,
    };
  });

  items.sort((left, right) => {
    const leftUrgency = left.currentStock <= 0 ? 0 : left.isLowStock ? 1 : 2;
    const rightUrgency = right.currentStock <= 0 ? 0 : right.isLowStock ? 1 : 2;
    return (
      leftUrgency - rightUrgency ||
      (right.recommendedPurchaseQty || 0) -
        (left.recommendedPurchaseQty || 0) ||
      (right.forecast.next28DayDemand || 0) -
        (left.forecast.next28DayDemand || 0)
    );
  });

  const confidentForecasts = items.filter(
    (item) => item.forecast.status === "reliable",
  );
  return {
    generatedAt: now.toISOString(),
    historyWeeks: HISTORY_WEEKS,
    forecastPeriod: {
      startDate: demandPeriod.startDate,
      endDate: demandPeriod.endDate,
      dayCount: demandPeriod.dayCount,
      timeZone: demandPeriod.timeZone,
      distributionAssumption: demandPeriod.distributionAssumption,
    },
    summary: {
      totalProducts: items.length,
      lowStockProducts: items.filter((item) => item.isLowStock).length,
      outOfStockProducts: items.filter((item) => item.currentStock <= 0).length,
      forecastableProducts: confidentForecasts.length,
      averageConfidence: confidentForecasts.length
        ? Math.round(
            confidentForecasts.reduce(
              (sum, item) => sum + item.forecast.confidence,
              0,
            ) / confidentForecasts.length,
          )
        : 0,
    },
    items,
  };
};
