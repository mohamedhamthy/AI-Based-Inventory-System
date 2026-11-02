import Category from '../models/Category.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';

export const getCategories = asyncHandler(async (req, res) => {
  const query = { workspaceId: req.workspaceId };
  if (req.query.active !== 'false') query.isActive = true;
  const categories = await Category.find(query).sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: { categories } });
});

export const getCategoryById = asyncHandler(async (req, res, next) => {
  const category = await Category.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
  if (!category) return next(new AppError('Category not found', 404));
  res.status(200).json({ success: true, data: { category } });
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create({ ...req.body, workspaceId: req.workspaceId, createdBy: req.user._id });
  res.status(201).json({ success: true, message: 'Category created successfully', data: { category } });
});

export const updateCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
  if (!category) return next(new AppError('Category not found', 404));
  Object.assign(category, req.body);
  await category.save();
  res.status(200).json({ success: true, message: 'Category updated successfully', data: { category } });
});

export const deleteCategory = asyncHandler(async (req, res, next) => {
  const category = await Category.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
  if (!category) return next(new AppError('Category not found', 404));
  category.isActive = false;
  await category.save();
  res.status(200).json({ success: true, message: 'Category deleted successfully' });
});
