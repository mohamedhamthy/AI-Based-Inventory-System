import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';

const buildSaleResponse = (sale) => ({
  ...sale.toObject(),
  id: sale._id.toString(),
  product: sale.product && typeof sale.product === 'object' ? {
    ...sale.product.toObject(),
    id: sale.product._id.toString(),
  } : sale.product,
});

export const createSale = asyncHandler(async (req, res, next) => {
  const { product: productId, quantity, unitPrice, customerName, phone, paymentStatus, notes } = req.body;

  if (!productId || !customerName || !quantity || !unitPrice) {
    return next(new AppError('Product, customer name, quantity, and unit price are required', 400));
  }

  const product = await Product.findOne({ _id: productId, workspaceId: req.workspaceId });
  if (!product || !product.isActive) {
    return next(new AppError('Part not found', 404));
  }

  const parsedQty = Number(quantity);
  const parsedUnitPrice = Number(unitPrice);
  if (parsedQty < 1) return next(new AppError('Quantity must be at least 1', 400));
  if (parsedUnitPrice < 0) return next(new AppError('Unit price must be zero or greater', 400));
  if (product.currentStock < parsedQty) {
    return next(new AppError('Not enough stock for this sale', 400));
  }

  const totalAmount = parsedQty * parsedUnitPrice;
  product.currentStock = product.currentStock - parsedQty;
  product.updatedBy = req.user._id;
  await product.save();

  const sale = await Sale.create({
    customerName,
    phone,
    workspaceId: req.workspaceId,
    product: product._id,
    quantity: parsedQty,
    unitPrice: parsedUnitPrice,
    totalAmount,
    paymentStatus: paymentStatus || 'Paid',
    notes,
    createdBy: req.user._id,
  });

  const populatedSale = await Sale.findById(sale._id).populate('product');
  res.status(201).json({ success: true, message: 'Sale recorded successfully', data: { sale: buildSaleResponse(populatedSale) } });
});

export const getSales = asyncHandler(async (req, res) => {
  const sales = await Sale.find({ workspaceId: req.workspaceId }).sort({ saleDate: -1 }).populate('product');
  res.status(200).json({ success: true, message: 'Sales retrieved successfully', data: { sales: sales.map(buildSaleResponse) } });
});
