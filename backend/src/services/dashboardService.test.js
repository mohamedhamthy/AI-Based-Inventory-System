import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDashboardOverviewData, getLowStockAlerts } from './dashboardService.js';

const workspaceId = '64b000000000000000000010';
const userId = '64b000000000000000000050';
const now = new Date('2026-07-14T15:30:00.000Z');

const chain = (value) => ({
  select() { return this; },
  sort() { return this; },
  limit() { return this; },
  populate() { return this; },
  lean() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});

const createDashboardModels = ({
  inventoryRows = [],
  salesRows = [],
  recentSales = [],
  recentMovements = [],
  recentOrders = [],
  pendingOrders = 0,
} = {}) => {
  const productPipelines = [];
  const salePipelines = [];
  const saleFindQueries = [];
  const movementQueries = [];
  const purchaseOrderQueries = [];
  const ProductModel = {
    aggregate(pipeline) {
      productPipelines.push(pipeline);
      return Promise.resolve(inventoryRows);
    },
    find(query) { return chain(query.alertFixture || []); },
    countDocuments() { return Promise.resolve(0); },
  };
  const SaleModel = {
    aggregate(pipeline) {
      salePipelines.push(pipeline);
      return Promise.resolve(salesRows);
    },
    find(query) {
      saleFindQueries.push(query);
      return chain(recentSales);
    },
  };
  const MovementModel = {
    find(query) {
      movementQueries.push(query);
      return chain(recentMovements);
    },
  };
  const PurchaseOrderModel = {
    countDocuments(query) {
      purchaseOrderQueries.push(query);
      return Promise.resolve(pendingOrders);
    },
    find(query) {
      purchaseOrderQueries.push(query);
      return chain(recentOrders);
    },
  };
  return {
    models: {
      ProductModel,
      SaleModel,
      MovementModel,
      PurchaseOrderModel,
      CategoryModel: { countDocuments: async () => 3 },
      SupplierModel: { countDocuments: async () => 4 },
    },
    productPipelines,
    salePipelines,
    saleFindQueries,
    movementQueries,
    purchaseOrderQueries,
  };
};

test('empty dashboard data returns zero metrics and six Sri Lankan monthly buckets', async () => {
  const database = createDashboardModels();
  const result = await getDashboardOverviewData(workspaceId, {
    now,
    ...database.models,
  });

  assert.equal(result.overview.totalProducts, 0);
  assert.equal(result.overview.totalStockQuantity, 0);
  assert.equal(result.overview.todaySales, 0);
  assert.equal(result.overview.todayTransactions, 0);
  assert.equal(result.overview.pendingOrders, 0);
  assert.deepEqual(result.statusDistribution, [
    { name: 'In Stock', value: 0 },
    { name: 'Low Stock', value: 0 },
    { name: 'Out of Stock', value: 0 },
  ]);
  assert.equal(result.monthlySales.length, 6);
  assert.equal(result.monthlySales[0].monthKey, '2026-02');
  assert.equal(result.monthlySales[5].monthKey, '2026-07');
  assert.equal(result.timezone, 'Asia/Colombo');
});

test('dashboard aggregates workspace inventory, Sri Lankan sales windows, recent activity and pending orders', async () => {
  const database = createDashboardModels({
    inventoryRows: [{
      summary: [{
        totalProducts: 2,
        totalStockQuantity: 7,
        inventoryValue: 45,
        lowStockProducts: 1,
        outOfStockProducts: 1,
      }],
      statusDistribution: [
        { name: 'Low Stock', value: 1 },
        { name: 'Out of Stock', value: 1 },
      ],
      stockByCategory: [{ name: 'Engine', units: 7, value: 45 }],
      recentProducts: [{ id: 'product-1', stock: 2 }],
    }],
    salesRows: [{
      today: [{ total: 25, transactions: 2 }],
      monthly: [{ _id: '2026-07', sales: 25, quantitySold: 3, transactions: 2 }],
    }],
    recentSales: [{ totalAmount: 25 }],
    recentMovements: [{ movementType: 'stock_in' }],
    recentOrders: [{ poNumber: 'PO-1' }],
    pendingOrders: 2,
  });
  const result = await getDashboardOverviewData(workspaceId, {
    role: 'manager',
    now,
    ...database.models,
  });

  assert.equal(result.overview.totalProducts, 2);
  assert.equal(result.overview.totalStockQuantity, 7);
  assert.equal(result.overview.inventoryValue, 45);
  assert.equal(result.overview.todaySales, 25);
  assert.equal(result.overview.todayTransactions, 2);
  assert.deepEqual(result.monthlySales[5], {
    monthKey: '2026-07',
    month: 'Jul 2026',
    sales: 25,
    quantitySold: 3,
    transactions: 2,
  });
  assert.equal(result.recentSales.length, 1);
  assert.equal(result.recentMovements.length, 1);
  assert.equal(result.recentPurchaseOrders.length, 1);
  assert.equal(database.productPipelines[0][0].$match.workspaceId, workspaceId);
  assert.equal(database.productPipelines[0][0].$match.isActive, true);
  assert.deepEqual(
    database.productPipelines[0][1].$facet.summary[0].$group.inventoryValue,
    { $sum: { $multiply: ['$currentStock', '$costPrice'] } },
  );
  const salesMatch = database.salePipelines[0][0].$match;
  assert.equal(salesMatch.workspaceId, workspaceId);
  assert.equal(salesMatch.saleDate.$gte.toISOString(), '2026-01-31T18:30:00.000Z');
  assert.equal(salesMatch.saleDate.$lt.toISOString(), '2026-07-14T18:30:00.000Z');
  assert.equal(database.salePipelines[0][1].$facet.monthly[0].$group._id.$dateToString.timezone, 'Asia/Colombo');
  assert.deepEqual(database.movementQueries[0], { workspaceId });
  assert.equal(database.purchaseOrderQueries[0].status.$in.includes('ordered'), true);
});

test('six dashboard trend buckets follow Sri Lankan months at the local month boundary', async () => {
  const database = createDashboardModels();
  const result = await getDashboardOverviewData(workspaceId, {
    now: new Date('2026-01-31T18:30:00.000Z'),
    ...database.models,
  });
  assert.deepEqual(result.monthlySales.map(({ monthKey }) => monthKey), [
    '2025-09',
    '2025-10',
    '2025-11',
    '2025-12',
    '2026-01',
    '2026-02',
  ]);
});

test('today sales query switches at Sri Lankan midnight, including early UTC hours', async () => {
  const beforeMidnight = createDashboardModels();
  await getDashboardOverviewData(workspaceId, {
    now: new Date('2026-07-14T18:29:59.000Z'),
    ...beforeMidnight.models,
  });
  assert.equal(beforeMidnight.salePipelines[0][1].$facet.today[0].$match.saleDate.$gte.toISOString(), '2026-07-13T18:30:00.000Z');
  assert.equal(beforeMidnight.salePipelines[0][1].$facet.today[0].$match.saleDate.$lt.toISOString(), '2026-07-14T18:30:00.000Z');

  const afterMidnight = createDashboardModels();
  await getDashboardOverviewData(workspaceId, {
    now: new Date('2026-07-14T20:00:00.000Z'),
    ...afterMidnight.models,
  });
  assert.equal(afterMidnight.salePipelines[0][1].$facet.today[0].$match.saleDate.$gte.toISOString(), '2026-07-14T18:30:00.000Z');
  assert.equal(afterMidnight.salePipelines[0][1].$facet.today[0].$match.saleDate.$lt.toISOString(), '2026-07-15T18:30:00.000Z');
});

test('employee dashboard sales are scoped to that employee while inventory remains workspace-scoped', async () => {
  const database = createDashboardModels();
  await getDashboardOverviewData(workspaceId, {
    role: 'employee',
    userId,
    now,
    ...database.models,
  });

  assert.equal(database.salePipelines[0][0].$match.workspaceId, workspaceId);
  assert.equal(database.salePipelines[0][0].$match.createdBy, userId);
  assert.deepEqual(database.saleFindQueries[0], { workspaceId, createdBy: userId });
});

test('low-stock alerts use active products and separate low stock from out of stock', async () => {
  let capturedQuery;
  const categoryId = '64b000000000000000000070';
  const ProductModel = {
    find(query) {
      capturedQuery = query;
      return chain([{
        _id: '64b000000000000000000031',
        productName: 'Brake pad',
        sku: 'BP-1',
        currentStock: 0,
        minimumStock: 3,
        category: { _id: categoryId, name: 'Brakes' },
      }, {
        _id: '64b000000000000000000032',
        productName: 'Oil filter',
        sku: 'OF-1',
        currentStock: 2,
        minimumStock: 4,
        category: null,
      }]);
    },
    countDocuments: async () => 2,
  };
  const result = await getLowStockAlerts(workspaceId, { ProductModel });

  assert.equal(capturedQuery.workspaceId, workspaceId);
  assert.equal(capturedQuery.isActive, true);
  assert.equal(result.count, 2);
  assert.equal(result.alerts[0].status, 'out_of_stock');
  assert.equal(result.alerts[0].threshold, 3);
  assert.equal(result.alerts[0].category.name, 'Brakes');
  assert.equal(result.alerts[1].status, 'low_stock');
  assert.equal(result.truncated, false);
});
