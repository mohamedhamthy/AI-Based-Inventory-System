import Supplier from '../models/Supplier.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';

export const getSuppliers = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = req.query.search || '';
  const status = req.query.status || '';
  const query = req.query.active === 'false' ? {} : { isActive: true };
  if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { supplierCode: { $regex: search, $options: 'i' } }];
  if (status) query.status = status;

  const totalItems = await Supplier.countDocuments(query);
  const suppliers = await Supplier.find(query).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: { suppliers, pagination: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) } } });
});

export const getSupplierById = asyncHandler(async (req, res, next) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) return next(new AppError('Supplier not found', 404));
  res.status(200).json({ success: true, data: { supplier } });
});

export const createSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, message: 'Supplier created successfully', data: { supplier } });
});

export const updateSupplier = asyncHandler(async (req, res, next) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) return next(new AppError('Supplier not found', 404));
  Object.assign(supplier, req.body);
  await supplier.save();
  res.status(200).json({ success: true, message: 'Supplier updated successfully', data: { supplier } });
});

export const deleteSupplier = asyncHandler(async (req, res, next) => {
  const supplier = await Supplier.findById(req.params.id);
  if (!supplier) return next(new AppError('Supplier not found', 404));
  supplier.isActive = false;
  await supplier.save();
  res.status(200).json({ success: true, message: 'Supplier deleted successfully' });
});
