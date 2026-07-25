import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Supplier from '../models/Supplier.js';
import asyncHandler from '../utils/asyncHandler.js';

const getStockStatus = (product) => {
  if (!product.isActive) return 'Inactive';
  if (product.currentStock === 0) return 'Out of Stock';
  if (product.currentStock <= product.minimumStock) return 'Low Stock';
  return 'In Stock';
};

export const getDashboardOverview = asyncHandler(async (req, res) => {
  const [products, categories, suppliers] = await Promise.all([
    Product.find({ isActive: true }).populate('category', 'name').populate('supplier', 'name').lean(),
    Category.find({ isActive: true }).lean(),
    Supplier.find({ isActive: true }).lean(),
  ]);

  const totalStockQuantity = products.reduce((sum, item) => sum + Number(item.currentStock || 0), 0);
  const inventoryValue = products.reduce((sum, item) => sum + Number(item.currentStock || 0) * Number(item.sellingPrice || 0), 0);
  const lowStockProducts = products.filter((item) => getStockStatus(item) === 'Low Stock').length;
  const outOfStockProducts = products.filter((item) => getStockStatus(item) === 'Out of Stock').length;

  const stockByCategory = categories
    .map((category) => {
      const categoryProducts = products.filter((product) => String(product.category?._id || product.category) === String(category._id));
      const totalUnits = categoryProducts.reduce((sum, item) => sum + Number(item.currentStock || 0), 0);
      const totalValue = categoryProducts.reduce((sum, item) => sum + Number(item.currentStock || 0) * Number(item.sellingPrice || 0), 0);
      return {
        name: category.name,
        units: totalUnits,
        value: totalValue,
      };
    })
    .filter((item) => item.units > 0);

  const statusDistribution = [
    { name: 'In Stock', value: products.filter((item) => getStockStatus(item) === 'In Stock').length },
    { name: 'Low Stock', value: lowStockProducts },
    { name: 'Out of Stock', value: outOfStockProducts },
  ];

  const trend = [
    { month: 'Jan', inStock: 18, outStock: 4 },
    { month: 'Feb', inStock: 24, outStock: 3 },
    { month: 'Mar', inStock: 20, outStock: 2 },
    { month: 'Apr', inStock: 29, outStock: 5 },
    { month: 'May', inStock: 26, outStock: 4 },
    { month: 'Jun', inStock: 33, outStock: 3 },
  ];

  const recentProducts = products
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 6)
    .map((product) => ({
      id: product._id,
      name: product.productName,
      sku: product.sku,
      stock: product.currentStock,
      status: getStockStatus(product),
      price: product.sellingPrice,
    }));

  res.status(200).json({
    success: true,
    message: 'Dashboard overview retrieved successfully',
    data: {
      overview: {
        totalProducts: products.length,
        totalStockQuantity,
        inventoryValue,
        lowStockProducts,
        outOfStockProducts,
        totalCategories: categories.length,
        totalSuppliers: suppliers.length,
        pendingOrders: 8,
      },
      stockByCategory,
      trend,
      statusDistribution,
      recentProducts,
    },
  });
});
