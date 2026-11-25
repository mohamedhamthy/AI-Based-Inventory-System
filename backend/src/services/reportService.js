import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Supplier from '../models/Supplier.js';
import Sale from '../models/Sale.js';
import StockMovement from '../models/StockMovement.js';
import AppError from '../utils/AppError.js';
import {
  addBusinessCalendarDays,
  businessMidnightUtc,
  BUSINESS_TIME_ZONE,
  formatBusinessDateTime,
} from '../utils/businessTime.js';

export const MAX_EXPORT_ROWS = 20000;
export const MAX_REPORT_SUMMARY_ROWS = 100;
const SUMMARY_ROWS_WITH_TRUNCATION_SENTINEL = MAX_REPORT_SUMMARY_ROWS + 1;

const parseDateBound = (value, label, inclusiveEnd = false) => {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new AppError(`${label} must be a valid ISO date or timestamp`, 400);

  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, yearText, monthText, dayText] = dateOnly;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const normalizedDate = new Date(Date.UTC(year, month - 1, day));
    if (normalizedDate.toISOString().slice(0, 10) !== value) {
      throw new AppError(`${label} must be a valid ISO date`, 400);
    }
    const boundary = inclusiveEnd
      ? addBusinessCalendarDays({ year, month, day }, 1)
      : { year, month, day };
    return businessMidnightUtc(boundary.year, boundary.month, boundary.day);
  }

  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new AppError(`${label} timestamp must include a timezone offset (Z or ±HH:MM)`, 400);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new AppError(`${label} must be a valid ISO date or timestamp`, 400);
  return date;
};

const dateRange = ({ from, to }) => {
  const start = parseDateBound(from, 'From date');
  const end = parseDateBound(to, 'To date', true);
  if (start && end && start >= end) throw new AppError('From date must be before to date', 400);
  return start || end ? { ...(start ? { $gte: start } : {}), ...(end ? { $lt: end } : {}) } : null;
};

const optionalId = (value, label) => {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) {
    throw new AppError(`${label} must be a valid id`, 400);
  }
  return value;
};

const assertWorkspaceReference = async (Model, id, workspaceId, label) => {
  if (!id) return;
  const reference = await Model.findOne({ _id: id, workspaceId }).select('_id').lean();
  if (!reference) throw new AppError(`${label} was not found in the current workspace`, 404);
};

const resolveProductFilters = async ({
  workspaceId,
  productId: rawProductId,
  categoryId: rawCategoryId,
  supplierId: rawSupplierId,
}, {
  ProductModel,
  CategoryModel,
  SupplierModel,
}) => {
  const productId = optionalId(rawProductId, 'Product');
  const categoryId = optionalId(rawCategoryId, 'Category');
  const supplierId = optionalId(rawSupplierId, 'Supplier');
  await Promise.all([
    assertWorkspaceReference(ProductModel, productId, workspaceId, 'Product'),
    assertWorkspaceReference(CategoryModel, categoryId, workspaceId, 'Category'),
    assertWorkspaceReference(SupplierModel, supplierId, workspaceId, 'Supplier'),
  ]);

  const hasProductFilters = Boolean(productId || categoryId || supplierId);
  if (!hasProductFilters) return { productId: null, categoryId: null, supplierId: null, productIds: null };
  if (productId && !categoryId && !supplierId) {
    return { productId, categoryId, supplierId, productIds: [productId] };
  }

  const productQuery = { workspaceId };
  if (productId) productQuery._id = productId;
  if (categoryId) productQuery.category = categoryId;
  if (supplierId) productQuery.supplier = supplierId;
  const products = await ProductModel.find(productQuery).select('_id').lean();
  return {
    productId,
    categoryId,
    supplierId,
    productIds: products.map((product) => product._id),
  };
};

const normalizedPage = (page, limit) => ({
  page: Math.max(1, Math.min(Number.parseInt(page, 10) || 1, 100000)),
  limit: Math.max(1, Math.min(Number.parseInt(limit, 10) || 25, 100)),
});

const pageResult = (page, limit, totalItems) => {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};

const createInventoryQuery = async (filters, models) => {
  const references = await resolveProductFilters(filters, models);
  const includeInactive = filters.includeInactive === true || filters.includeInactive === 'true';
  const query = {
    workspaceId: filters.workspaceId,
    ...(includeInactive ? {} : { isActive: true }),
  };
  if (references.productId) query._id = references.productId;
  if (references.categoryId) query.category = references.categoryId;
  if (references.supplierId) query.supplier = references.supplierId;
  if (filters.status === 'low_stock') {
    query.$expr = {
      $and: [
        { $gt: ['$currentStock', 0] },
        { $lte: ['$currentStock', '$minimumStock'] },
      ],
    };
  } else if (filters.status === 'out_of_stock') {
    query.currentStock = 0;
  } else if (filters.status === 'in_stock') {
    query.$expr = { $gt: ['$currentStock', '$minimumStock'] };
  } else if (filters.status && filters.status !== 'all') {
    throw new AppError('Status must be low_stock, out_of_stock, in_stock, or all', 400);
  }
  return query;
};

const summaryForProducts = (rows = []) => {
  const summary = rows[0] || {};
  return {
    totalProducts: summary.totalProducts || 0,
    totalStockQuantity: summary.totalStockQuantity || 0,
    inventoryValue: summary.inventoryValue || 0,
    lowStockProducts: summary.lowStockProducts || 0,
    outOfStockProducts: summary.outOfStockProducts || 0,
  };
};

const aggregationObjectId = (value) => (
  typeof value === 'string' && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : value
);

const aggregationMatch = (query) => {
  const match = { ...query };
  for (const key of ['workspaceId', '_id', 'category', 'supplier']) {
    if (match[key]) match[key] = aggregationObjectId(match[key]);
  }
  if (match.product?.$in) {
    match.product = { ...match.product, $in: match.product.$in.map(aggregationObjectId) };
  } else if (match.product) {
    match.product = aggregationObjectId(match.product);
  }
  return match;
};

export const getInventoryReport = async (filters, {
  ProductModel = Product,
  CategoryModel = Category,
  SupplierModel = Supplier,
} = {}) => {
  const models = { ProductModel, CategoryModel, SupplierModel };
  const query = await createInventoryQuery(filters, models);
  const { page, limit } = normalizedPage(filters.page, filters.limit);
  const [products, totalItems, summaryRows] = await Promise.all([
    ProductModel.find(query)
      .sort({ productName: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'category', select: 'name', match: { workspaceId: filters.workspaceId } })
      .populate({ path: 'supplier', select: 'name supplierCode', match: { workspaceId: filters.workspaceId } })
      .lean(),
    ProductModel.countDocuments(query),
    ProductModel.aggregate([
      { $match: aggregationMatch(query) },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalStockQuantity: { $sum: '$currentStock' },
          inventoryValue: { $sum: { $multiply: ['$currentStock', '$costPrice'] } },
          lowStockProducts: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ['$currentStock', 0] }, { $lte: ['$currentStock', '$minimumStock'] }] },
                1,
                0,
              ],
            },
          },
          outOfStockProducts: { $sum: { $cond: [{ $eq: ['$currentStock', 0] }, 1, 0] } },
        },
      },
    ]),
  ]);
  return {
    products,
    summary: summaryForProducts(summaryRows),
    pagination: pageResult(page, limit, totalItems),
  };
};

const createMovementQuery = async (filters, models) => {
  const references = await resolveProductFilters(filters, models);
  const query = { workspaceId: filters.workspaceId };
  const range = dateRange(filters);
  if (range) query.createdAt = range;
  if (filters.type) {
    if (!['stock_in', 'sale', 'adjustment'].includes(filters.type)) {
      throw new AppError('Movement type is invalid', 400);
    }
    query.movementType = filters.type;
  }
  if (references.productIds) query.product = { $in: references.productIds };
  return query;
};

export const getMovementReport = async (filters, {
  MovementModel = StockMovement,
  ProductModel = Product,
  CategoryModel = Category,
  SupplierModel = Supplier,
} = {}) => {
  const models = { ProductModel, CategoryModel, SupplierModel };
  const query = await createMovementQuery(filters, models);
  const { page, limit } = normalizedPage(filters.page, filters.limit);
  const [movements, totalItems] = await Promise.all([
    MovementModel.find(query)
      .select('_id product movementType quantity stockBefore stockAfter reference reason createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'product', select: 'productName sku oemPartNumber', match: { workspaceId: filters.workspaceId } })
      .lean(),
    MovementModel.countDocuments(query),
  ]);
  return { movements, pagination: pageResult(page, limit, totalItems) };
};

const createSalesQuery = async (filters, models) => {
  const references = await resolveProductFilters(filters, models);
  const query = { workspaceId: filters.workspaceId };
  const range = dateRange(filters);
  if (range) query.saleDate = range;
  if (references.productIds) query.product = { $in: references.productIds };
  return query;
};

const salesAggregatePipeline = (query, workspaceId, productCollectionName) => [
  { $match: query },
  {
    $facet: {
      summary: [
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$totalAmount' },
            quantitySold: { $sum: '$quantity' },
            invoices: { $addToSet: { $ifNull: ['$invoiceNumber', '$_id'] } },
          },
        },
        { $project: { totalSales: 1, quantitySold: 1, transactions: { $size: '$invoices' } } },
      ],
      byDate: [
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate', timezone: BUSINESS_TIME_ZONE } },
            totalSales: { $sum: '$totalAmount' },
            quantitySold: { $sum: '$quantity' },
            invoices: { $addToSet: { $ifNull: ['$invoiceNumber', '$_id'] } },
          },
        },
        { $project: { totalSales: 1, quantitySold: 1, transactions: { $size: '$invoices' } } },
        { $sort: { _id: 1 } },
        { $limit: SUMMARY_ROWS_WITH_TRUNCATION_SENTINEL },
      ],
      monthlySales: [
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$saleDate', timezone: BUSINESS_TIME_ZONE } },
            totalSales: { $sum: '$totalAmount' },
            quantitySold: { $sum: '$quantity' },
            invoices: { $addToSet: { $ifNull: ['$invoiceNumber', '$_id'] } },
          },
        },
        { $project: { totalSales: 1, quantitySold: 1, transactions: { $size: '$invoices' } } },
        { $sort: { _id: 1 } },
        { $limit: SUMMARY_ROWS_WITH_TRUNCATION_SENTINEL },
      ],
      byProduct: [
        {
          $group: {
            _id: '$product',
            totalSales: { $sum: '$totalAmount' },
            quantitySold: { $sum: '$quantity' },
            invoices: { $addToSet: { $ifNull: ['$invoiceNumber', '$_id'] } },
          },
        },
        { $project: { totalSales: 1, quantitySold: 1, transactions: { $size: '$invoices' } } },
        { $sort: { totalSales: -1, _id: 1 } },
        { $limit: SUMMARY_ROWS_WITH_TRUNCATION_SENTINEL },
        {
          $lookup: {
            from: productCollectionName,
            let: { productId: '$_id' },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$productId'] },
                    { $eq: ['$workspaceId', workspaceId] },
                  ],
                },
              },
            }, { $project: { productName: 1, sku: 1 } }],
            as: 'product',
          },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            productId: '$_id',
            productName: { $ifNull: ['$product.productName', 'Unavailable product'] },
            sku: { $ifNull: ['$product.sku', ''] },
            totalSales: 1,
            quantitySold: 1,
            transactions: 1,
          },
        },
        { $sort: { totalSales: -1, productName: 1 } },
      ],
      byCustomer: customerSalesPipelineStages(),
    },
  },
];

const customerSalesPipelineStages = (limit = SUMMARY_ROWS_WITH_TRUNCATION_SENTINEL) => {
  const normalizedName = { $trim: { input: { $ifNull: ['$customerName', ''] } } };
  return [
    {
      $group: {
        _id: { $ifNull: ['$customer', { $toLower: normalizedName }] },
        customerName: {
          $first: { $cond: [{ $eq: [normalizedName, ''] }, 'Walk-in customer', normalizedName] },
        },
        totalSales: { $sum: '$totalAmount' },
        quantitySold: { $sum: '$quantity' },
        invoices: { $addToSet: { $ifNull: ['$invoiceNumber', '$_id'] } },
      },
    },
    { $project: { _id: 0, customerName: 1, totalSales: 1, quantitySold: 1, transactions: { $size: '$invoices' } } },
    { $sort: { totalSales: -1, customerName: 1 } },
    { $limit: limit },
  ];
};

const customerSalesPipeline = (query, limit = SUMMARY_ROWS_WITH_TRUNCATION_SENTINEL) => [
  { $match: query },
  ...customerSalesPipelineStages(limit),
];

const emptySalesAggregate = {
  summary: [],
  byDate: [],
  monthlySales: [],
  byProduct: [],
  byCustomer: [],
};

const monthlySalesPipeline = (query, limit = SUMMARY_ROWS_WITH_TRUNCATION_SENTINEL) => [
  { $match: query },
  {
    $group: {
      _id: { $dateToString: { format: '%Y-%m', date: '$saleDate', timezone: BUSINESS_TIME_ZONE } },
      totalSales: { $sum: '$totalAmount' },
      quantitySold: { $sum: '$quantity' },
      invoices: { $addToSet: { $ifNull: ['$invoiceNumber', '$_id'] } },
    },
  },
  { $project: { totalSales: 1, quantitySold: 1, transactions: { $size: '$invoices' } } },
  { $sort: { _id: 1 } },
  { $limit: limit },
];

const aggregateWithDiskUse = (Model, pipeline) => {
  const aggregate = Model.aggregate(pipeline);
  return typeof aggregate.allowDiskUse === 'function' ? aggregate.allowDiskUse(true) : aggregate;
};

const boundedRows = (rows = []) => ({
  rows: rows.slice(0, MAX_REPORT_SUMMARY_ROWS),
  truncated: rows.length > MAX_REPORT_SUMMARY_ROWS,
});

export const getSalesReport = async (filters, {
  SaleModel = Sale,
  ProductModel = Product,
  CategoryModel = Category,
  SupplierModel = Supplier,
} = {}) => {
  const models = { ProductModel, CategoryModel, SupplierModel };
  const query = await createSalesQuery(filters, models);
  const { page, limit } = normalizedPage(filters.page, filters.limit);
  const [sales, totalItems, aggregateRows] = await Promise.all([
    SaleModel.find(query)
      .select('_id invoiceNumber invoiceTotal customer customerName saleDate product quantity unitPrice totalAmount paymentStatus dataOrigin testSuite testRunId')
      .sort({ saleDate: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: 'product', select: 'productName sku oemPartNumber', match: { workspaceId: filters.workspaceId } })
      .populate({ path: 'customer', select: 'name phone', match: { workspaceId: filters.workspaceId } })
      .lean(),
    SaleModel.countDocuments(query),
    aggregateWithDiskUse(SaleModel, salesAggregatePipeline(
      aggregationMatch(query),
      aggregationObjectId(filters.workspaceId),
      ProductModel.collection.name,
    )),
  ]);
  const aggregates = aggregateRows[0] || emptySalesAggregate;
  const summary = aggregates.summary?.[0] || {};
  const byDate = boundedRows(aggregates.byDate);
  const monthlySales = boundedRows(aggregates.monthlySales);
  const byProduct = boundedRows(aggregates.byProduct);
  const byCustomer = boundedRows(aggregates.byCustomer);
  return {
    sales,
    summary: {
      totalSales: summary.totalSales || 0,
      quantitySold: summary.quantitySold || 0,
      transactions: summary.transactions || 0,
    },
    byDate: byDate.rows,
    monthlySales: monthlySales.rows,
    byProduct: byProduct.rows,
    byCustomer: byCustomer.rows,
    summaryTruncation: {
      limit: MAX_REPORT_SUMMARY_ROWS,
      byDate: byDate.truncated,
      monthlySales: monthlySales.truncated,
      byProduct: byProduct.truncated,
      byCustomer: byCustomer.truncated,
    },
    pagination: pageResult(page, limit, totalItems),
  };
};

export const getMonthlySalesSummary = async (filters, {
  SaleModel = Sale,
  ProductModel = Product,
  CategoryModel = Category,
  SupplierModel = Supplier,
} = {}) => {
  const models = { ProductModel, CategoryModel, SupplierModel };
  const query = await createSalesQuery(filters, models);
  const rows = await aggregateWithDiskUse(SaleModel, monthlySalesPipeline(aggregationMatch(query)));
  const monthlySales = boundedRows(rows);
  return {
    monthlySales: monthlySales.rows,
    summaryTruncation: { limit: MAX_REPORT_SUMMARY_ROWS, truncated: monthlySales.truncated },
  };
};

export const csvCell = (value) => {
  let text = value instanceof Date ? formatBusinessDateTime(value) : value === null || value === undefined ? '' : String(value);
  if (typeof value !== 'number') {
    let prefixIndex = 0;
    while (prefixIndex < text.length) {
      const character = text[prefixIndex];
      const codePoint = text.charCodeAt(prefixIndex);
      if (/\s/.test(character) || codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) {
        prefixIndex += 1;
      } else {
        break;
      }
    }
    if (prefixIndex < text.length && '=+-@'.includes(text[prefixIndex])) text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
};

const createCsv = (headers, rows) => [
  headers.map(csvCell).join(','),
  ...rows.map((row) => row.map(csvCell).join(',')),
].join('\r\n');

const ensureExportSize = (rows) => {
  if (rows.length > MAX_EXPORT_ROWS) {
    throw new AppError(`Export exceeds ${MAX_EXPORT_ROWS} rows; narrow the selected filters`, 413);
  }
  return rows;
};

const loadExportRows = async (query, Model, { populate = [], workspaceId, select } = {}) => {
  let result = Model.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(MAX_EXPORT_ROWS + 1);
  if (select) result = result.select(select);
  for (const path of populate) {
    result = result.populate({
      path,
      select: path === 'product' ? 'productName sku oemPartNumber' : 'name supplierCode',
      match: { workspaceId },
    });
  }
  const rows = await result.lean();
  return ensureExportSize(rows);
};

const productName = (product) => product?.productName || '';
const productSku = (product) => product?.sku || '';

export const exportInventoryCsv = async (filters, models = {}) => {
  const ProductModel = models.ProductModel || Product;
  const query = await createInventoryQuery(filters, {
    ProductModel,
    CategoryModel: models.CategoryModel || Category,
    SupplierModel: models.SupplierModel || Supplier,
  });
  let result = ProductModel.find(query)
    .sort({ productName: 1, _id: 1 })
    .limit(MAX_EXPORT_ROWS + 1)
    .populate({ path: 'category', select: 'name', match: { workspaceId: filters.workspaceId } })
    .populate({ path: 'supplier', select: 'name supplierCode', match: { workspaceId: filters.workspaceId } });
  const products = ensureExportSize(await result.lean());
  return createCsv(
    [
      'Record type',
      'Product name',
      'SKU',
      'Genuine part number / OEM number',
      'Barcode',
      'Category name',
      'Supplier name',
      'Manufacturer',
      'Compatible Yamaha models',
      'Purchase price (LKR)',
      'Selling price (LKR)',
      'Available stock quantity',
      'Minimum stock level',
      'Maximum stock level',
      'Rack / shelf location',
      'Description',
      'Product status',
    ],
    products.map((product) => [
      product.dataOrigin === 'sample'
        ? 'SAMPLE DATA'
        : product.testSuite || product.testRunId ? 'TEST DATA' : 'ACTUAL',
      product.productName,
      product.sku,
      product.oemPartNumber || '',
      product.barcode || '',
      product.category?.name || '',
      product.supplier?.name || '',
      product.manufacturer || '',
      product.compatibleModels || '',
      product.costPrice,
      product.sellingPrice,
      product.currentStock,
      product.minimumStock,
      product.maximumStock,
      product.warehouseLocation || '',
      product.description || '',
      product.isActive ? 'active' : 'inactive',
    ]),
  );
};

export const exportMovementCsv = async (filters, models = {}) => {
  const MovementModel = models.MovementModel || StockMovement;
  const query = await createMovementQuery(filters, {
    ProductModel: models.ProductModel || Product,
    CategoryModel: models.CategoryModel || Category,
    SupplierModel: models.SupplierModel || Supplier,
  });
  const movements = await loadExportRows(query, MovementModel, {
    populate: ['product'],
    workspaceId: filters.workspaceId,
    select: '_id product movementType quantity stockBefore stockAfter reference reason createdAt',
  });
  return createCsv(
    [`Date (${BUSINESS_TIME_ZONE})`, 'Product', 'SKU', 'Movement type', 'Quantity', 'Stock before', 'Stock after', 'Reference', 'Reason'],
    movements.map((movement) => [
      movement.createdAt,
      productName(movement.product),
      productSku(movement.product),
      movement.movementType,
      movement.quantity,
      movement.stockBefore,
      movement.stockAfter,
      movement.reference,
      movement.reason,
    ]),
  );
};

export const exportSalesCsv = async (filters, models = {}) => {
  const SaleModel = models.SaleModel || Sale;
  const query = await createSalesQuery(filters, {
    ProductModel: models.ProductModel || Product,
    CategoryModel: models.CategoryModel || Category,
    SupplierModel: models.SupplierModel || Supplier,
  });
  let result = SaleModel.find(query)
    .select('_id invoiceNumber invoiceTotal customer customerName saleDate product quantity unitPrice totalAmount paymentStatus dataOrigin testSuite testRunId')
    .sort({ saleDate: -1, _id: -1 })
    .limit(MAX_EXPORT_ROWS + 1)
    .populate({ path: 'product', select: 'productName sku oemPartNumber', match: { workspaceId: filters.workspaceId } })
    .populate({ path: 'customer', select: 'name', match: { workspaceId: filters.workspaceId } });
  const sales = ensureExportSize(await result.lean());
  return createCsv(
    ['Record type', 'Invoice number', 'Customer', `Date (${BUSINESS_TIME_ZONE})`, 'Product', 'SKU', 'Quantity', 'Unit price', 'Line total', 'Invoice total', 'Payment status'],
    sales.map((sale) => [
      sale.dataOrigin === 'sample'
        ? 'SAMPLE DATA'
        : sale.testSuite || sale.testRunId ? 'TEST DATA' : 'ACTUAL',
      sale.invoiceNumber || sale._id,
      sale.customer?.name || sale.customerName,
      sale.saleDate,
      productName(sale.product),
      productSku(sale.product),
      sale.quantity,
      sale.unitPrice,
      sale.totalAmount,
      sale.invoiceTotal || sale.totalAmount,
      sale.paymentStatus,
    ]),
  );
};

export const exportCustomerSalesCsv = async (filters, models = {}) => {
  const SaleModel = models.SaleModel || Sale;
  const query = await createSalesQuery(filters, {
    ProductModel: models.ProductModel || Product,
    CategoryModel: models.CategoryModel || Category,
    SupplierModel: models.SupplierModel || Supplier,
  });
  const customerSales = await aggregateWithDiskUse(
    SaleModel,
    customerSalesPipeline(aggregationMatch(query), MAX_EXPORT_ROWS + 1),
  );
  ensureExportSize(customerSales);
  return createCsv(
    ['Customer', 'Sales', 'Quantity sold', 'Transactions'],
    customerSales.map((row) => [row.customerName, row.totalSales, row.quantitySold, row.transactions]),
  );
};

export const exportMonthlySalesCsv = async (filters, models = {}) => {
  const SaleModel = models.SaleModel || Sale;
  const query = await createSalesQuery(filters, {
    ProductModel: models.ProductModel || Product,
    CategoryModel: models.CategoryModel || Category,
    SupplierModel: models.SupplierModel || Supplier,
  });
  const monthlySales = await aggregateWithDiskUse(
    SaleModel,
    monthlySalesPipeline(aggregationMatch(query), MAX_EXPORT_ROWS + 1),
  );
  ensureExportSize(monthlySales);
  return createCsv(
    [`Month (${BUSINESS_TIME_ZONE})`, 'Total sales', 'Quantity sold', 'Transactions'],
    monthlySales.map((row) => [row._id, row.totalSales, row.quantitySold, row.transactions]),
  );
};
