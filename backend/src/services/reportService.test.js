import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  csvCell,
  MAX_EXPORT_ROWS,
  MAX_REPORT_SUMMARY_ROWS,
  exportCustomerSalesCsv,
  exportInventoryCsv,
  exportMonthlySalesCsv,
  exportMovementCsv,
  exportSalesCsv,
  getInventoryReport,
  getMonthlySalesSummary,
  getMovementReport,
  getSalesReport,
} from './reportService.js';

const workspaceId = '64b000000000000000000010';
const productId = '64b000000000000000000030';
const categoryId = '64b000000000000000000040';
const supplierId = '64b000000000000000000050';

const query = (value, hooks = {}) => ({
  select(fields) { hooks.select?.(fields); return this; },
  sort() { return this; },
  skip() { return this; },
  limit() { return this; },
  populate() { return this; },
  lean() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});

const referenceModels = ({
  products = [],
  productReference = { _id: productId },
  categoryReference = { _id: categoryId },
  supplierReference = { _id: supplierId },
} = {}) => {
  const productQueries = [];
  const ProductModel = {
    collection: { name: 'products' },
    findOne(filter) {
      productQueries.push(filter);
      if (filter._id === productId) return query(productReference);
      return query(null);
    },
    find(filter) {
      productQueries.push(filter);
      return query(products);
    },
  };
  const CategoryModel = {
    findOne(filter) {
      return query(filter._id === categoryId ? categoryReference : null);
    },
  };
  const SupplierModel = {
    findOne(filter) {
      return query(filter._id === supplierId ? supplierReference : null);
    },
  };
  return { ProductModel, CategoryModel, SupplierModel, productQueries };
};

test('inventory report uses active workspace products and returns zero-safe summaries', async () => {
  let capturedQuery;
  const models = referenceModels();
  const ProductModel = {
    ...models.ProductModel,
    find(filter) {
      capturedQuery = filter;
      return query([]);
    },
    countDocuments: async () => 0,
    aggregate: async () => [],
  };
  const result = await getInventoryReport({ workspaceId }, { ...models, ProductModel });
  assert.deepEqual(capturedQuery, { workspaceId, isActive: true });
  assert.deepEqual(result.summary, {
    totalProducts: 0,
    totalStockQuantity: 0,
    inventoryValue: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
  });
  assert.equal(result.pagination.totalItems, 0);
});

test('inventory report applies low-stock, category, supplier and workspace filters', async () => {
  let capturedQuery;
  let capturedAggregate;
  const references = referenceModels();
  const ProductModel = {
    ...references.ProductModel,
    find(filter) {
      capturedQuery = filter;
      return query([]);
    },
    countDocuments: async () => 0,
    aggregate(pipeline) {
      capturedAggregate = pipeline;
      return Promise.resolve([]);
    },
  };
  await getInventoryReport({
    workspaceId,
    categoryId,
    supplierId,
    status: 'low_stock',
  }, { ...references, ProductModel });

  assert.equal(capturedQuery.workspaceId, workspaceId);
  assert.equal(capturedQuery.isActive, true);
  assert.equal(capturedQuery.category, categoryId);
  assert.equal(capturedQuery.supplier, supplierId);
  assert.ok(capturedQuery.$expr);
  assert.equal(capturedAggregate[0].$match.workspaceId.toString(), workspaceId);
  assert.equal(capturedAggregate[0].$match.category.toString(), categoryId);
  assert.equal(capturedAggregate[0].$match.supplier.toString(), supplierId);
});

test('movement report applies workspace, product, movement type and Sri Lankan date filters', async () => {
  let capturedMovementQuery;
  let capturedProjection;
  const references = referenceModels({ products: [{ _id: productId }] });
  const MovementModel = {
    find(filter) {
      capturedMovementQuery = filter;
      return query([], { select: (fields) => { capturedProjection = fields; } });
    },
    countDocuments: async () => 0,
  };
  const result = await getMovementReport({
    workspaceId,
    from: '2026-07-01',
    to: '2026-07-03',
    productId,
    categoryId,
    supplierId,
    type: 'stock_in',
  }, { ...references, MovementModel });

  assert.equal(capturedMovementQuery.workspaceId, workspaceId);
  assert.deepEqual(capturedMovementQuery.product, { $in: [productId] });
  assert.equal(capturedMovementQuery.movementType, 'stock_in');
  assert.equal(capturedMovementQuery.createdAt.$gte.toISOString(), '2026-06-30T18:30:00.000Z');
  assert.equal(capturedMovementQuery.createdAt.$lt.toISOString(), '2026-07-03T18:30:00.000Z');
  assert.equal(capturedProjection, '_id product movementType quantity stockBefore stockAfter reference reason createdAt');
  assert.equal(result.pagination.totalItems, 0);
});

test('sales report filters workspace, product and dates and returns monthly summaries', async () => {
  let capturedSaleQuery;
  let capturedPipeline;
  const references = referenceModels();
  const SaleModel = {
    find(filter) {
      capturedSaleQuery = filter;
      return query([]);
    },
    countDocuments: async () => 0,
    aggregate(pipeline) {
      capturedPipeline = pipeline;
      return Promise.resolve([{
        summary: [{ totalSales: 90, quantitySold: 3, transactions: 2 }],
        byDate: [{ _id: '2026-07-01', totalSales: 90, quantitySold: 3, transactions: 2 }],
        monthlySales: [{ _id: '2026-07', totalSales: 90, quantitySold: 3, transactions: 2 }],
        byProduct: [],
        byCustomer: [{ customerName: 'Sample customer', totalSales: 90, quantitySold: 3, transactions: 2 }],
      }]);
    },
  };
  const result = await getSalesReport({
    workspaceId,
    from: '2026-07-01',
    to: '2026-07-31',
    productId,
  }, { ...references, SaleModel });

  assert.equal(capturedSaleQuery.workspaceId, workspaceId);
  assert.deepEqual(capturedSaleQuery.product, { $in: [productId] });
  assert.equal(capturedSaleQuery.saleDate.$gte.toISOString(), '2026-06-30T18:30:00.000Z');
  assert.equal(capturedSaleQuery.saleDate.$lt.toISOString(), '2026-07-31T18:30:00.000Z');
  assert.equal(capturedPipeline[0].$match.workspaceId.toString(), workspaceId);
  assert.deepEqual(capturedPipeline[1].$facet.summary[0].$group.invoices, {
    $addToSet: { $ifNull: ['$invoiceNumber', '$_id'] },
  });
  assert.deepEqual(capturedPipeline[1].$facet.summary[1].$project.transactions, { $size: '$invoices' });
  assert.equal(result.summary.totalSales, 90);
  assert.equal(result.summary.quantitySold, 3);
  assert.equal(result.monthlySales[0]._id, '2026-07');
  assert.deepEqual(result.byCustomer, [{
    customerName: 'Sample customer',
    totalSales: 90,
    quantitySold: 3,
    transactions: 2,
  }]);
  assert.deepEqual(capturedPipeline[1].$facet.byCustomer[0].$group._id, {
    $ifNull: ['$customer', { $toLower: { $trim: { input: { $ifNull: ['$customerName', ''] } } } }],
  });
});

test('sales reports ignore client-supplied actor identifiers', async () => {
  let capturedSaleQuery;
  const references = referenceModels();
  const SaleModel = {
    find(filter) {
      capturedSaleQuery = filter;
      return query([]);
    },
    countDocuments: async () => 0,
    aggregate: async () => [],
  };
  await getSalesReport({
    workspaceId,
    createdBy: '64b000000000000000000099',
  }, { ...references, SaleModel });

  assert.deepEqual(capturedSaleQuery, { workspaceId });
});

test('monthly summary uses actual aggregation results and Sri Lankan grouping', async () => {
  let pipeline;
  const references = referenceModels();
  const SaleModel = {
    aggregate(value) {
      pipeline = value;
      return Promise.resolve([{ _id: '2026-06', totalSales: 120, quantitySold: 4, transactions: 3 }]);
    },
  };
  const result = await getMonthlySalesSummary({ workspaceId }, { ...references, SaleModel });
  assert.equal(pipeline[0].$match.workspaceId.toString(), workspaceId);
  assert.equal(pipeline[1].$group._id.$dateToString.timezone, 'Asia/Colombo');
  assert.equal(result.monthlySales[0].totalSales, 120);
});

test('date-only reports include the entire Sri Lankan end date', async () => {
  let capturedQuery;
  const references = referenceModels();
  const SaleModel = {
    find(filter) {
      capturedQuery = filter;
      return query([]);
    },
    countDocuments: async () => 0,
    aggregate: async () => [],
  };
  await getSalesReport({
    workspaceId,
    from: '2026-07-01',
    to: '2026-07-01',
  }, { ...references, SaleModel });
  assert.equal(capturedQuery.saleDate.$gte.toISOString(), '2026-06-30T18:30:00.000Z');
  assert.equal(capturedQuery.saleDate.$lt.toISOString(), '2026-07-01T18:30:00.000Z');
});

test('report timestamp filters reject timestamps without an explicit timezone offset', async () => {
  const references = referenceModels();
  await assert.rejects(getSalesReport({
    workspaceId,
    from: '2026-07-01T00:00:00',
  }, references), (error) => error.statusCode === 400 && /timezone offset/.test(error.message));
});

test('sales summaries bound high-cardinality arrays without changing overall totals', async () => {
  const references = referenceModels();
  const makeRows = (prefix) => Array.from({ length: MAX_REPORT_SUMMARY_ROWS + 1 }, (_, index) => ({
    _id: `${prefix}-${index}`,
    totalSales: 3,
    quantitySold: 1,
    transactions: 1,
  }));
  const SaleModel = {
    find: () => query([]),
    countDocuments: async () => MAX_REPORT_SUMMARY_ROWS + 1,
    aggregate: async () => [{
      summary: [{ totalSales: 303, quantitySold: 101, transactions: 101 }],
      byDate: makeRows('2026-01-01'),
      monthlySales: makeRows('2026-01'),
      byProduct: makeRows('product'),
      byCustomer: makeRows('customer'),
    }],
  };
  const result = await getSalesReport({ workspaceId }, { ...references, SaleModel });
  assert.deepEqual(result.summary, { totalSales: 303, quantitySold: 101, transactions: 101 });
  assert.equal(result.byDate.length, MAX_REPORT_SUMMARY_ROWS);
  assert.equal(result.monthlySales.length, MAX_REPORT_SUMMARY_ROWS);
  assert.equal(result.byProduct.length, MAX_REPORT_SUMMARY_ROWS);
  assert.equal(result.byCustomer.length, MAX_REPORT_SUMMARY_ROWS);
  assert.deepEqual(result.summaryTruncation, {
    limit: MAX_REPORT_SUMMARY_ROWS,
    byDate: true,
    monthlySales: true,
    byProduct: true,
    byCustomer: true,
  });
});

test('inventory export rejects a cross-workspace product filter', async () => {
  const references = referenceModels({ productReference: null });
  await assert.rejects(exportInventoryCsv({
    workspaceId,
    productId,
  }, references), (error) => error.statusCode === 404);
});

test('catalog export includes inactive products only when explicitly requested', async () => {
  const references = referenceModels();
  let activeQuery;
  await exportInventoryCsv({ workspaceId }, {
    ...references,
    ProductModel: {
      ...references.ProductModel,
      find(filter) {
        activeQuery = filter;
        return query([]);
      },
    },
  });
  assert.equal(activeQuery.isActive, true);

  let catalogQuery;
  await exportInventoryCsv({ workspaceId, includeInactive: 'true' }, {
    ...references,
    ProductModel: {
      ...references.ProductModel,
      find(filter) {
        catalogQuery = filter;
        return query([]);
      },
    },
  });
  assert.equal(Object.hasOwn(catalogQuery, 'isActive'), false);
  assert.equal(catalogQuery.workspaceId, workspaceId);
});

test('CSV export includes filtered sale values and neutralizes spreadsheet formulas', async () => {
  const references = referenceModels();
  let capturedSaleQuery;
  const SaleModel = {
    find(filter) {
      capturedSaleQuery = filter;
      return query([{
        _id: '64b000000000000000000060',
        saleDate: new Date('2026-07-01T12:00:00.000Z'),
        product: { productName: '=HYPERLINK("https://evil")', sku: '+cmd' },
        quantity: 2,
        unitPrice: 12.5,
        totalAmount: 25,
        paymentStatus: 'Paid',
        phone: 'must-not-export',
      }]);
    },
  };
  const csv = await exportSalesCsv({
    workspaceId,
    from: '2026-07-01',
    productId,
  }, { ...references, SaleModel });

  assert.equal(capturedSaleQuery.workspaceId, workspaceId);
  assert.deepEqual(capturedSaleQuery.product, { $in: [productId] });
  assert.match(csv, /^"Record type","Invoice number","Customer","Date \(Asia\/Colombo\)","Product","SKU","Quantity"/);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/evil""\)","'\+cmd"/);
  assert.doesNotMatch(csv, /must-not-export/);
  assert.equal(csvCell('=2+2'), `"'=2+2"`);
  assert.equal(csvCell(-12), '"-12"');
});

test('customer sales CSV groups customer totals and applies date filters', async () => {
  const references = referenceModels();
  let capturedPipeline;
  const SaleModel = {
    aggregate(pipeline) {
      capturedPipeline = pipeline;
      return Promise.resolve([{
        customerName: '=SUM(1,1)',
        totalSales: 125,
        quantitySold: 5,
        transactions: 2,
      }]);
    },
  };
  const csv = await exportCustomerSalesCsv({
    workspaceId,
    from: '2026-07-01',
    to: '2026-07-31',
  }, { ...references, SaleModel });

  assert.equal(capturedPipeline[0].$match.workspaceId.toString(), workspaceId);
  assert.equal(capturedPipeline[0].$match.saleDate.$gte.toISOString(), '2026-06-30T18:30:00.000Z');
  assert.match(csv, /^"Customer","Sales","Quantity sold","Transactions"/);
  assert.match(csv, /"'=SUM\(1,1\)","125","5","2"/);
});

test('inventory and movement CSV exports include matching report columns and values', async () => {
  const references = referenceModels();
  const inventoryCsv = await exportInventoryCsv({ workspaceId }, {
    ...references,
    ProductModel: {
      ...references.ProductModel,
      find: () => query([{
        productName: 'Oil filter',
        sku: 'OF-4',
        oemPartNumber: 'OEM-OF-4',
        barcode: 'BC-4',
        category: { name: 'Engine' },
        supplier: { name: 'Parts Co' },
        manufacturer: 'Yamaha',
        compatibleModels: 'Verified model',
        currentStock: 4,
        minimumStock: 2,
        maximumStock: 20,
        costPrice: 3.5,
        sellingPrice: 5,
        warehouseLocation: 'A-1',
        description: 'Part description',
        isActive: true,
      }]),
    },
  });
  assert.match(inventoryCsv, /^"Record type","Product name","SKU","Genuine part number \/ OEM number"/);
  assert.match(inventoryCsv, /"ACTUAL","Oil filter","OF-4","OEM-OF-4","BC-4","Engine","Parts Co","Yamaha","Verified model","3\.5","5","4","2","20","A-1","Part description","active"/);

  const movementCsv = await exportMovementCsv({ workspaceId }, {
    ...references,
    MovementModel: {
      find: () => query([{
        createdAt: new Date('2026-07-14T00:00:00.000Z'),
        product: { productName: 'Oil filter', sku: 'OF-4' },
        movementType: 'stock_in',
        quantity: 3,
        stockBefore: 1,
        stockAfter: 4,
        reference: '=SUM(1,1)',
        reason: 'Purchase order',
      }]),
    },
  });
  assert.match(movementCsv, /^"Date \(Asia\/Colombo\)","Product","SKU","Movement type"/);
  assert.match(movementCsv, /"Oil filter","OF-4","stock_in","3","1","4","'=SUM\(1,1\)"/);
});

test('monthly CSV export includes meaningful headers and aggregate values', async () => {
  const references = referenceModels();
  const SaleModel = {
    aggregate: async () => [{
      _id: '2026-07', totalSales: 345, quantitySold: 9, transactions: 4,
    }],
  };
  const csv = await exportMonthlySalesCsv({ workspaceId }, { ...references, SaleModel });
  assert.match(csv, /^"Month \(Asia\/Colombo\)","Total sales","Quantity sold","Transactions"/);
  assert.match(csv, /"2026-07","345","9","4"/);
});

test('CSV formula prefixes after whitespace and control characters are neutralized', () => {
  for (const prefix of ['=', '+', '-', '@']) {
    assert.equal(csvCell(`${prefix}1+1`), `"'${prefix}1+1"`);
    assert.equal(csvCell(`  \t${prefix}1+1`), `"'  \t${prefix}1+1"`);
    assert.equal(csvCell(`\r\n${prefix}1+1`), `"'\r\n${prefix}1+1"`);
    assert.equal(csvCell(`\u0001${prefix}1+1`), `"'\u0001${prefix}1+1"`);
  }
});

test('CSV quoting preserves commas, embedded quotes, newlines and empty values', () => {
  assert.equal(csvCell('Part, "A"\nsecond line'), '"Part, ""A""\nsecond line"');
  assert.equal(csvCell(''), '""');
  assert.equal(csvCell(null), '""');
});

test('monthly CSV export rejects more than the backend row limit', async () => {
  const references = referenceModels();
  const SaleModel = {
    aggregate: async () => Array.from({ length: MAX_EXPORT_ROWS + 1 }, (_, index) => ({
      _id: `2026-${String((index % 12) + 1).padStart(2, '0')}`,
      totalSales: 1,
      quantitySold: 1,
      transactions: 1,
    })),
  };
  await assert.rejects(
    exportMonthlySalesCsv({ workspaceId }, { ...references, SaleModel }),
    (error) => error.statusCode === 413 && error.message.includes(String(MAX_EXPORT_ROWS)),
  );
});
