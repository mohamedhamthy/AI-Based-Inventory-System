import Supplier from "../models/Supplier.js";
import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import { withoutTestOwnership } from "../utils/testOwnership.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getSuppliers = asyncHandler(async (req, res) => {
  const page = Math.max(
    1,
    Math.min(Number.parseInt(req.query.page, 10) || 1, 100000),
  );
  const limit = Math.max(
    1,
    Math.min(Number.parseInt(req.query.limit, 10) || 10, 100),
  );
  const search =
    typeof req.query.search === "string"
      ? escapeRegex(req.query.search.slice(0, 100))
      : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const query = { workspaceId: req.workspaceId };
  if (req.query.active !== "false") query.isActive = true;
  if (search)
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { supplierCode: { $regex: search, $options: "i" } },
    ];
  if (status) query.status = status;

  const totalItems = await Supplier.countDocuments(query);
  const suppliers = await Supplier.find(query)
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 });
  res
    .status(200)
    .json({
      success: true,
      data: {
        suppliers,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
        },
      },
    });
});

export const getSupplierById = asyncHandler(async (req, res, next) => {
  const supplier = await Supplier.findOne({
    _id: req.params.id,
    workspaceId: req.workspaceId,
  });
  if (!supplier) return next(new AppError("Supplier not found", 404));
  res.status(200).json({ success: true, data: { supplier } });
});

export const createSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.create({
    ...withoutTestOwnership(req.body),
    workspaceId: req.workspaceId,
    createdBy: req.user._id,
  });
  res
    .status(201)
    .json({
      success: true,
      message: "Supplier created successfully",
      data: { supplier },
    });
});

export const updateSupplier = asyncHandler(async (req, res, next) => {
  const supplier = await Supplier.findOne({
    _id: req.params.id,
    workspaceId: req.workspaceId,
  });
  if (!supplier) return next(new AppError("Supplier not found", 404));
  Object.assign(supplier, withoutTestOwnership(req.body));
  await supplier.save();
  res
    .status(200)
    .json({
      success: true,
      message: "Supplier updated successfully",
      data: { supplier },
    });
});

export const deleteSupplier = asyncHandler(async (req, res, next) => {
  const supplier = await Supplier.findOne({
    _id: req.params.id,
    workspaceId: req.workspaceId,
  });
  if (!supplier) return next(new AppError("Supplier not found", 404));
  supplier.isActive = false;
  await supplier.save();
  res
    .status(200)
    .json({ success: true, message: "Supplier deleted successfully" });
});
