import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Supplier from '../models/Supplier.js';
import Sale from '../models/Sale.js';
import StockMovement from '../models/StockMovement.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import { hasPermission } from '../constants/permissions.js';
import {
  addBusinessCalendarDays,
  businessMidnightUtc,
  businessMonthParts,
  BUSINESS_TIME_ZONE,
  getBusinessDateParts,
} from '../utils/businessTime.js';

const pendingPurchaseOrderStatuses = ['ordered', 'partially_received'];
const dashboardSaleFields = '_id saleDate product quantity unitPrice totalAmount paymentStatus';

const businessDateWindow = (now) => {
  const today = getBusinessDateParts(now);
  const tomorrow = addBusinessCalendarDays(today, 1);
  const firstMonth = businessMonthParts(today.year, today.month, -5);
  return {
    today,
    todayStart: businessMidnightUtc(today.year, today.month, today.day),
    tomorrow: businessMidnightUtc(tomorrow.year, tomorrow.month, tomorrow.day),
    monthStart: businessMidnightUtc(firstMonth.year, firstMonth.month, 1),
  };
};

const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
const monthLabel = (year, month) => new Date(Date.UTC(year, month - 1, 15))
  .toLocaleString('en', { month: 'short', timeZone: 'UTC' }) + ` ${year}`;

const buildMonthlyTrend = (rows, currentMonth) => {
  const values = new Map(rows.map((row) => [row._id, row]));
  return Array.from({ length: 6 }, (_, index) => {
    const date = businessMonthParts(currentMonth.year, currentMonth.month, index - 5);
    const key = monthKey(date.year, date.month);
    const row = values.get(key) || {};
    return {
      monthKey: key,
      month: monthLabel(date.year, date.month),
      sales: row.sales || 0,
      quantitySold: row.quantitySold || 0,
      transactions: row.transactions || 0,
    };
  });
};

const normalizeByStatus = (rows) => {
  const values = new Map(rows.map((row) => [row.name, row.value]));
  return ['In Stock', 'Low Stock', 'Out of Stock'].map((name) => ({
    name,
    value: values.get(name) || 0,
  }));
};

export const getDashboardOverviewData = async (workspaceId, {
  role,
  userId,
  now = new Date(),
  ProductModel = Product,
  CategoryModel = Category,
  SupplierModel = Supplier,
  SaleModel = Sale,
  MovementModel = StockMovement,
  PurchaseOrderModel = PurchaseOrder,
} = {}) => {
  const { today: businessDay, todayStart, tomorrow, monthStart } = businessDateWindow(now);
  const saleScope = role === 'employee' ? { createdBy: userId } : {};
  const canReadPurchaseOrders = hasPermission(role, 'purchaseOrders:read');
  const [inventoryRows, salesRows, recentSales, recentMovements, pendingOrders, recentOrders, totalCategories, totalSuppliers] = await Promise.all([
    ProductModel.aggregate([
      { $match: { workspaceId, isActive: true } },
      {
        $facet: {
          summary: [{
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
              inStockProducts: { $sum: { $cond: [{ $gt: ['$currentStock', '$minimumStock'] }, 1, 0] } },
            },
          }],
          statusDistribution: [
            {
              $group: {
                _id: {
                  $switch: {
                    branches: [
                      { case: { $eq: ['$currentStock', 0] }, then: 'Out of Stock' },
                      { case: { $lte: ['$currentStock', '$minimumStock'] }, then: 'Low Stock' },
                    ],
                    default: 'In Stock',
                  },
                },
                value: { $sum: 1 },
              },
            },
            { $project: { _id: 0, name: '$_id', value: 1 } },
          ],
          stockByCategory: [
            {
              $group: {
                _id: '$category',
                units: { $sum: '$currentStock' },
                value: { $sum: { $multiply: ['$currentStock', '$costPrice'] } },
              },
            },
            {
              $lookup: {
                from: Category.collection.name,
                let: { categoryId: '$_id' },
                pipeline: [{
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$_id', '$$categoryId'] },
                        { $eq: ['$workspaceId', workspaceId] },
                        { $eq: ['$isActive', true] },
                      ],
                    },
                  },
                }],
                as: 'category',
              },
            },
            { $unwind: '$category' },
            { $project: { _id: 0, name: '$category.name', units: 1, value: 1 } },
            { $sort: { units: -1, name: 1 } },
          ],
          recentProducts: [
            { $sort: { updatedAt: -1, _id: -1 } },
            { $limit: 6 },
            {
              $project: {
                _id: 0,
                id: '$_id',
                name: '$productName',
                sku: 1,
                stock: '$currentStock',
                status: {
                  $cond: [
                    { $eq: ['$currentStock', 0] },
                    'Out of Stock',
                    {
                      $cond: [
                        { $lte: ['$currentStock', '$minimumStock'] },
                        'Low Stock',
                        'In Stock',
                      ],
                    },
                  ],
                },
                price: '$sellingPrice',
              },
            },
          ],
        },
      },
    ]),
    SaleModel.aggregate([
      {
        $match: {
          workspaceId,
          ...saleScope,
          saleDate: { $gte: monthStart, $lt: tomorrow },
        },
      },
      {
        $facet: {
          today: [
            { $match: { saleDate: { $gte: todayStart, $lt: tomorrow } } },
            {
              $group: {
                _id: null,
                total: { $sum: '$totalAmount' },
                transactions: { $sum: 1 },
              },
            },
          ],
          monthly: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$saleDate', timezone: BUSINESS_TIME_ZONE } },
                sales: { $sum: '$totalAmount' },
                quantitySold: { $sum: '$quantity' },
                transactions: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]),
    SaleModel.find({ workspaceId, ...saleScope })
      .select(dashboardSaleFields)
      .sort({ saleDate: -1, _id: -1 })
      .limit(5)
      .populate({ path: 'product', select: 'productName sku oemPartNumber', match: { workspaceId } })
      .lean(),
    MovementModel.find({ workspaceId })
      .select('product movementType quantity stockBefore stockAfter reference createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .limit(5)
      .populate({ path: 'product', select: 'productName sku oemPartNumber', match: { workspaceId } })
      .lean(),
    canReadPurchaseOrders ? PurchaseOrderModel.countDocuments({
      workspaceId,
      status: { $in: pendingPurchaseOrderStatuses },
    }) : 0,
    canReadPurchaseOrders ? PurchaseOrderModel.find({ workspaceId })
      .select('poNumber supplier status updatedAt')
      .sort({ updatedAt: -1, _id: -1 })
      .limit(5)
      .populate({ path: 'supplier', select: 'name supplierCode', match: { workspaceId } })
      .lean() : [],
    CategoryModel.countDocuments({ workspaceId, isActive: true }),
    SupplierModel.countDocuments({ workspaceId, isActive: true }),
  ]);

  const inventory = inventoryRows[0] || {};
  const counts = inventory.summary?.[0] || {};
  const sales = salesRows[0] || {};
  const today = sales.today?.[0] || {};

  return {
    overview: {
      totalProducts: counts.totalProducts || 0,
      totalStockQuantity: counts.totalStockQuantity || 0,
      inventoryValue: counts.inventoryValue || 0,
      lowStockProducts: counts.lowStockProducts || 0,
      outOfStockProducts: counts.outOfStockProducts || 0,
      totalCategories,
      totalSuppliers,
      todaySales: today.total || 0,
      todayTransactions: today.transactions || 0,
      pendingOrders,
    },
    stockByCategory: inventory.stockByCategory || [],
    statusDistribution: normalizeByStatus(inventory.statusDistribution || []),
    monthlySales: buildMonthlyTrend(sales.monthly || [], businessDay),
    recentProducts: inventory.recentProducts || [],
    recentSales,
    recentMovements,
    recentPurchaseOrders: recentOrders,
    timezone: BUSINESS_TIME_ZONE,
  };
};

export const getLowStockAlerts = async (workspaceId, {
  limit = 100,
  ProductModel = Product,
} = {}) => {
  const query = {
    workspaceId,
    isActive: true,
    $or: [
      { currentStock: 0 },
      {
        $expr: {
          $and: [
            { $gt: ['$currentStock', 0] },
            { $lte: ['$currentStock', '$minimumStock'] },
          ],
        },
      },
    ],
  };
  const [products, count] = await Promise.all([
    ProductModel.find(query)
      .select('productName sku oemPartNumber currentStock minimumStock category')
      .sort({ currentStock: 1, productName: 1 })
      .limit(limit)
      .populate({ path: 'category', select: 'name', match: { workspaceId } })
      .lean(),
    ProductModel.countDocuments(query),
  ]);

  return {
    count,
    alerts: products.map((product) => ({
      id: String(product._id),
      productName: product.productName,
      sku: product.sku,
      currentStock: product.currentStock,
      threshold: product.minimumStock,
      status: product.currentStock === 0 ? 'out_of_stock' : 'low_stock',
      category: product.category ? {
        id: String(product.category._id || product.category),
        name: product.category.name || '',
      } : null,
    })),
    truncated: count > products.length,
  };
};
