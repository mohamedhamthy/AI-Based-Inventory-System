import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Supplier from '../models/Supplier.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';

const getStockStatus = (product) => {
  if (!product.isActive) return 'Inactive';
  if (product.currentStock === 0) return 'Out of Stock';
  if (product.currentStock <= product.minimumStock) return 'Low Stock';
  return 'In Stock';
};

const buildProductResponse = (product) => ({
  ...product.toObject(),
  stockStatus: getStockStatus(product),
});

export const getProducts = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = req.query.search || '';
  const category = req.query.category || '';
  const supplier = req.query.supplier || '';
  const status = req.query.status || '';
  const sortBy = req.query.sortBy || 'createdAt';
  const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

  const query = { isActive: true };
  if (search) {
    query.$or = [
      { productName: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { barcode: { $regex: search, $options: 'i' } },
      { manufacturer: { $regex: search, $options: 'i' } },
    ];
  }
  if (category) query.category = category;
  if (supplier) query.supplier = supplier;

  const sort = { [sortBy]: sortOrder };
  const productsQuery = Product.find(query).populate('category', 'name').populate('supplier', 'name');
  const totalItems = await Product.countDocuments(query);
  const products = await productsQuery.sort(sort).skip((page - 1) * limit).limit(limit);

  const productsWithStatus = products.map(buildProductResponse);
  const filteredProducts = status ? productsWithStatus.filter((product) => product.stockStatus === status) : productsWithStatus;

  const summary = {
    totalProducts: await Product.countDocuments({ isActive: true }),
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    inactive: await Product.countDocuments({ isActive: false }),
  };

  const allProducts = await Product.find({ isActive: true }).lean();
  allProducts.forEach((product) => {
    const productStatus = getStockStatus(product);
    if (productStatus === 'Low Stock') summary.lowStock += 1;
    if (productStatus === 'Out of Stock') summary.outOfStock += 1;
    if (productStatus === 'In Stock') summary.inStock += 1;
  });

  res.status(200).json({
    success: true,
    message: 'Products retrieved successfully',
    data: {
      products: filteredProducts,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: page < Math.ceil(totalItems / limit),
        hasPreviousPage: page > 1,
      },
      summary,
    },
  });
});

export const getProductById = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id).populate('category', 'name').populate('supplier', 'name');
  if (!product || !product.isActive) return next(new AppError('Product not found', 404));
  res.status(200).json({ success: true, data: { product: buildProductResponse(product) } });
});

export const createProduct = asyncHandler(async (req, res, next) => {
  const category = await Category.findById(req.body.category);
  const supplier = await Supplier.findById(req.body.supplier);
  if (!category || !supplier) return next(new AppError('Category or supplier not found', 404));

  const product = await Product.create({ ...req.body, createdBy: req.user._id, updatedBy: req.user._id });
  res.status(201).json({ success: true, message: 'Product created successfully', data: { product: buildProductResponse(product) } });
});

export const updateProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product || !product.isActive) return next(new AppError('Product not found', 404));

  Object.assign(product, req.body, { updatedBy: req.user._id });
  await product.save();

  res.status(200).json({ success: true, message: 'Product updated successfully', data: { product: buildProductResponse(product) } });
});

export const deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) return next(new AppError('Product not found', 404));

  product.isActive = false;
  product.updatedBy = req.user._id;
  await product.save();

  res.status(200).json({ success: true, message: 'Product deleted successfully' });
});
