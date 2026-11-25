import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDemandInsights, getForwardDemandPeriod } from './demandService.js';

const workspaceId = '64b000000000000000000010';
const productId = '64b000000000000000000030';
const now = new Date('2026-11-18T10:00:00.000Z');

const productsQuery = (products) => ({
  select() { return this; },
  sort() { return this; },
  lean() { return Promise.resolve(products); },
});

const createModels = ({ products = [], salesByWeek = [], outstandingRows = [] } = {}) => {
  const productQueries = [];
  const salePipelines = [];
  const purchaseOrderPipelines = [];
  return {
    productQueries,
    salePipelines,
    purchaseOrderPipelines,
    ProductModel: {
      find(query) {
        productQueries.push(query);
        return productsQuery(products);
      },
    },
    SaleModel: {
      aggregate(pipeline) {
        salePipelines.push(pipeline);
        return Promise.resolve(salesByWeek);
      },
    },
    PurchaseOrderModel: {
      aggregate(pipeline) {
        purchaseOrderPipelines.push(pipeline);
        return Promise.resolve(outstandingRows);
      },
    },
  };
};

const product = (overrides = {}) => ({
  _id: productId,
  productName: 'Oil filter',
  sku: 'OF-1',
  currentStock: 4,
  minimumStock: 10,
  maximumStock: 0,
  costPrice: 40,
  sellingPrice: 60,
  unit: 'Unit',
  ...overrides,
});

test('demand service scopes sources to workspace and aggregates chronological Colombo weeks', async () => {
  const currentWeekStart = new Date('2026-11-15T18:30:00.000Z');
  const historyStart = new Date(currentWeekStart.getTime() - 26 * 7 * 24 * 60 * 60 * 1000);
  const salesByWeek = Array.from({ length: 26 }, (_, index) => ({
    _id: {
      product: productId,
      week: new Date(historyStart.getTime() + index * 7 * 24 * 60 * 60 * 1000),
    },
    quantity: 2,
  }));
  const models = createModels({
    products: [product()],
    salesByWeek,
    outstandingRows: [{ _id: productId, quantity: 3 }],
  });
  const result = await getDemandInsights(workspaceId, now, models);

  assert.deepEqual(models.productQueries[0], { workspaceId, isActive: true });
  assert.equal(models.salePipelines[0][0].$match.workspaceId, workspaceId);
  assert.equal(models.salePipelines[0][0].$match.saleDate.$lt.toISOString(), currentWeekStart.toISOString());
  assert.equal(models.salePipelines[0][1].$group._id.week.$dateTrunc.timezone, 'Asia/Colombo');
  assert.equal(models.salePipelines[0][1].$group._id.week.$dateTrunc.startOfWeek, 'monday');
  assert.deepEqual(models.purchaseOrderPipelines[0][0].$match, {
    workspaceId,
    status: { $in: ['ordered', 'partially_received'] },
  });
  assert.equal(result.items[0].forecast.status, 'reliable');
  assert.equal(result.items[0].forecast.weeklyHistory.length, 26);
  assert.equal(result.items[0].forecast.weeklyHistory[0].weekStart, historyStart.toISOString());
  assert.equal(result.items[0].forecast.weeklyForecastPeriods.length, 5);
  assert.equal(result.forecastPeriod.startDate, '2026-11-19');
  assert.equal(result.forecastPeriod.endDate, '2026-12-16');
  assert.equal(result.forecastPeriod.dayCount, 28);
  assert.equal(result.items[0].forecast.next28DayDemand, 8);
  assert.equal(result.items[0].forecast.weeklyForecastPeriods[0].startDate, '2026-11-19');
  assert.equal(result.items[0].forecast.weeklyForecastPeriods[0].includedDays, 4);
  assert.equal(
    result.items[0].forecast.weeklyForecastPeriods.reduce((sum, period) => sum + period.periodDemand, 0),
    result.items[0].forecast.next28DayDemand,
  );
  assert.equal(
    result.items[0].purchaseRecommendation.projected28DayDemand,
    result.items[0].forecast.next28DayDemand,
  );
  assert.equal(result.items[0].outstandingQuantity, 3);
  assert.equal(result.items[0].recommendedPurchaseQty, 11);
});

test('28-day Colombo demand periods start on the next full business date and cover exact week portions', () => {
  const cases = [
    {
      label: 'Monday',
      now: '2026-11-16T04:30:00.000Z',
      startDate: '2026-11-17',
      endDate: '2026-12-14',
      weekDayCounts: [6, 7, 7, 7, 1],
    },
    {
      label: 'Wednesday',
      now: '2026-11-18T04:30:00.000Z',
      startDate: '2026-11-19',
      endDate: '2026-12-16',
      weekDayCounts: [4, 7, 7, 7, 3],
    },
    {
      label: 'Sunday',
      now: '2026-11-22T04:30:00.000Z',
      startDate: '2026-11-23',
      endDate: '2026-12-20',
      weekDayCounts: [0, 7, 7, 7, 7],
    },
    {
      label: 'end/start of month',
      now: '2026-11-30T04:30:00.000Z',
      startDate: '2026-12-01',
      endDate: '2026-12-28',
      weekDayCounts: [6, 7, 7, 7, 1],
    },
  ];

  for (const { label, now, startDate, endDate, weekDayCounts } of cases) {
    const period = getForwardDemandPeriod(new Date(now));
    const startOrdinal = Date.parse(`${period.startDate}T00:00:00.000Z`);
    const endOrdinal = Date.parse(`${period.endDate}T00:00:00.000Z`);
    assert.equal(period.startDate, startDate, label);
    assert.equal(period.endDate, endDate, label);
    assert.equal((endOrdinal - startOrdinal) / (24 * 60 * 60 * 1000) + 1, 28, label);
    assert.equal(period.forecastWeekDayCounts.reduce((sum, days) => sum + days, 0), 28, label);
    assert.deepEqual(period.forecastWeekDayCounts, weekDayCounts, label);
    assert.equal(period.weekSegments.filter(Boolean)[0].startDate, startDate, label);
    assert.equal(period.weekSegments.filter(Boolean).at(-1).endDate, endDate, label);
  }
});

test('products without sales history receive no demand forecast or suggested purchase quantity', async () => {
  const models = createModels({ products: [product()], salesByWeek: [] });
  const result = await getDemandInsights(workspaceId, now, models);
  assert.equal(result.items[0].forecast.status, 'insufficient_data');
  assert.equal(result.items[0].forecast.next28DayDemand, null);
  assert.equal(result.items[0].recommendedPurchaseQty, null);
  assert.equal(result.items[0].purchaseRecommendation.action, 'Monitor');
  assert.equal(result.items[0].purchaseRecommendation.suggestedQuantity, null);
});

test('missing sales weeks remain explicit zero buckets in chronological history', async () => {
  const currentWeekStart = new Date('2026-11-15T18:30:00.000Z');
  const historyStart = new Date(currentWeekStart.getTime() - 26 * 7 * 24 * 60 * 60 * 1000);
  const salesByWeek = [0, 2, 4, 6, 8, 10].map((index) => ({
    _id: {
      product: productId,
      week: new Date(historyStart.getTime() + index * 7 * 24 * 60 * 60 * 1000),
    },
    quantity: 1,
  }));
  const models = createModels({ products: [product()], salesByWeek });
  const result = await getDemandInsights(workspaceId, now, models);
  const history = result.items[0].forecast.weeklyHistory;
  assert.equal(history.length, 26);
  assert.deepEqual(history.slice(0, 7).map(({ quantity }) => quantity), [1, 0, 1, 0, 1, 0, 1]);
});

test('stock equal to minimum is low stock while stock above minimum is not', async () => {
  const products = [
    product({ _id: 'below', currentStock: 4, minimumStock: 5 }),
    product({ _id: 'equal', currentStock: 5, minimumStock: 5 }),
    product({ _id: 'above', currentStock: 6, minimumStock: 5 }),
  ];
  const result = await getDemandInsights(workspaceId, now, createModels({ products }));
  const lowStockById = Object.fromEntries(result.items.map((item) => [item.id, item.isLowStock]));

  assert.deepEqual(lowStockById, { below: true, equal: true, above: false });
  assert.equal(result.summary.lowStockProducts, 2);
});
