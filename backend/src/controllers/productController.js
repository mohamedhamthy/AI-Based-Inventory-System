import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Supplier from "../models/Supplier.js";
import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import { hasPermission } from "../constants/permissions.js";
import {
  createProductWithOpeningStock,
  setProductStock,
} from "../services/inventoryService.js";
import { deactivateProduct as deactivateProductService } from "../services/productService.js";
import {
  normalizeProductCreateFields,
  normalizeProductUpdateFields,
} from "../utils/productBarcode.js";
import { withoutTestOwnership } from "../utils/testOwnership.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const buildProductSearchQuery = (search) => {
  const cleanSearch =
    typeof search === "string" ? search.trim().slice(0, 100) : "";
  if (!cleanSearch) return null;
  const expression = escapeRegex(cleanSearch);
  return {
    $or: [
      { productName: { $regex: expression, $options: "i" } },
      { sku: { $regex: expression, $options: "i" } },
      { oemPartNumber: { $regex: expression, $options: "i" } },
      { barcode: { $regex: expression, $options: "i" } },
      { manufacturer: { $regex: expression, $options: "i" } },
      { compatibleModels: { $regex: expression, $options: "i" } },
    ],
  };
};

export const normalizeProductDuplicateError = (error) => {
  if (error?.code !== 11000) return error;
  const fields = { ...error.keyPattern, ...error.keyValue };
  if (Object.hasOwn(fields, "sku")) {
    return new AppError(
      "That part number is already in use in this workspace.",
      409,
      null,
      "PRODUCT_SKU_DUPLICATE",
    );
  }
  if (Object.hasOwn(fields, "barcode")) {
    return new AppError(
      "That barcode is already in use in this workspace.",
      409,
      null,
      "PRODUCT_BARCODE_DUPLICATE",
    );
  }
  if (Object.hasOwn(fields, "oemPartNumber")) {
    return new AppError(
      "That OEM part number is already in use in this workspace.",
      409,
      null,
      "PRODUCT_OEM_PART_NUMBER_DUPLICATE",
    );
  }
  return new AppError(
    "A product identifier is already in use in this workspace.",
    409,
    null,
    "PRODUCT_IDENTIFIER_DUPLICATE",
  );
};

const withProductDuplicateHandling = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    throw normalizeProductDuplicateError(error);
  }
};

const getStockStatus = (product) => {
  if (!product.isActive) return "Inactive";
  if (product.currentStock === 0) return "Out of Stock";
  if (product.currentStock <= product.minimumStock) return "Low Stock";
  return "In Stock";
};

const buildProductResponse = (product) => ({
  ...(typeof product.toObject === "function" ? product.toObject() : product),
  stockStatus: getStockStatus(product),
});

export const getProducts = asyncHandler(async (req, res) => {
  const page = Math.max(
    1,
    Math.min(Number.parseInt(req.query.page, 10) || 1, 100000),
  );
  const limit = Math.max(
    1,
    Math.min(Number.parseInt(req.query.limit, 10) || 10, 100),
  );
  const category =
    typeof req.query.category === "string" ? req.query.category : "";
  const supplier =
    typeof req.query.supplier === "string" ? req.query.supplier : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const requestedSort =
    req.query.sortBy === "stock" ? "currentStock" : req.query.sortBy;
  const sortBy = [
    "createdAt",
    "productName",
    "currentStock",
    "costPrice",
    "sellingPrice",
    "sku",
  ].includes(requestedSort)
    ? requestedSort
    : "createdAt";
  const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;

  const query = {
    workspaceId: req.workspaceId,
    isActive: status === "Inactive" ? false : true,
  };
  const searchQuery = buildProductSearchQuery(req.query.search);
  if (searchQuery) Object.assign(query, searchQuery);
  if (category) query.category = category;
  if (supplier) query.supplier = supplier;
  if (status === "Out of Stock") query.currentStock = 0;
  if (status === "Low Stock") {
    query.$expr = {
      $and: [
        { $gt: ["$currentStock", 0] },
        { $lte: ["$currentStock", "$minimumStock"] },
      ],
    };
  }
  if (status === "In Stock")
    query.$expr = { $gt: ["$currentStock", "$minimumStock"] };

  const sort = { [sortBy]: sortOrder };
  const [products, totalItems, summaryRows, inactiveProducts] =
    await Promise.all([
      Product.find(query)
        .populate("category", "name")
        .populate("supplier", "name")
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
      Product.aggregate([
        { $match: { workspaceId: req.workspaceId, isActive: true } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            inStock: {
              $sum: {
                $cond: [{ $gt: ["$currentStock", "$minimumStock"] }, 1, 0],
              },
            },
            lowStock: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ["$currentStock", 0] },
                      { $lte: ["$currentStock", "$minimumStock"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            outOfStock: {
              $sum: { $cond: [{ $eq: ["$currentStock", 0] }, 1, 0] },
            },
          },
        },
      ]),
      Product.countDocuments({ workspaceId: req.workspaceId, isActive: false }),
    ]);

  const productsWithStatus = products.map(buildProductResponse);
  const counts = summaryRows[0] || {};
  const summary = {
    totalProducts: counts.totalProducts || 0,
    inStock: counts.inStock || 0,
    lowStock: counts.lowStock || 0,
    outOfStock: counts.outOfStock || 0,
    inactive: inactiveProducts,
  };

  res.status(200).json({
    success: true,
    message: "Products retrieved successfully",
    data: {
      products: productsWithStatus,
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
  const product = await Product.findOne({
    _id: req.params.id,
    workspaceId: req.workspaceId,
  })
    .populate("category", "name")
    .populate("supplier", "name");
  if (!product || !product.isActive)
    return next(new AppError("Product not found", 404));
  res
    .status(200)
    .json({ success: true, data: { product: buildProductResponse(product) } });
});

export const createProduct = asyncHandler(async (req, res, next) => {
  const category = await Category.findOne({
    _id: req.body.category,
    workspaceId: req.workspaceId,
  });
  const supplier = await Supplier.findOne({
    _id: req.body.supplier,
    workspaceId: req.workspaceId,
  });
  if (!category || !supplier)
    return next(new AppError("Category or supplier not found", 404));

  const { currentStock, ...requestedProductFields } = withoutTestOwnership(
    req.body,
  );
  const productData = {
    ...normalizeProductCreateFields(requestedProductFields),
    currentStock: currentStock === undefined ? 0 : Number(currentStock),
    workspaceId: req.workspaceId,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  };
  let product;
  if (productData.currentStock > 0) {
    if (!hasPermission(req.user.role, "stock:manage")) {
      return next(
        new AppError(
          "You do not have permission to initialize product stock",
          403,
        ),
      );
    }
    ({ product } = await withProductDuplicateHandling(() =>
      createProductWithOpeningStock(productData),
    ));
  } else {
    product = await withProductDuplicateHandling(() =>
      Product.create(productData),
    );
  }
  res
    .status(201)
    .json({
      success: true,
      message: "Product created successfully",
      data: { product: buildProductResponse(product) },
    });
});

export const updateProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findOne({
    _id: req.params.id,
    workspaceId: req.workspaceId,
  });
  if (!product || !product.isActive)
    return next(new AppError("Product not found", 404));

  const [category, supplier] = await Promise.all([
    Category.findOne({ _id: req.body.category, workspaceId: req.workspaceId }),
    Supplier.findOne({ _id: req.body.supplier, workspaceId: req.workspaceId }),
  ]);
  if (!category || !supplier)
    return next(new AppError("Category or supplier not found", 404));

  const {
    currentStock,
    stockReference,
    stockReason,
    ...requestedProductChanges
  } = withoutTestOwnership(req.body);
  const {
    changes: productChanges,
    clearBarcode,
    clearOemPartNumber,
  } = normalizeProductUpdateFields(requestedProductChanges);
  const stockWasRequested = Object.prototype.hasOwnProperty.call(
    req.body,
    "currentStock",
  );
  let updatedProduct = product;
  if (
    stockWasRequested &&
    Number(currentStock) !== Number(product.currentStock)
  ) {
    if (!hasPermission(req.user.role, "stock:manage")) {
      return next(
        new AppError("You do not have permission to adjust stock", 403),
      );
    }
    ({ product: updatedProduct } = await withProductDuplicateHandling(() =>
      setProductStock({
        workspaceId: req.workspaceId,
        productId: req.params.id,
        stockAfter: currentStock,
        changes: productChanges,
        clearBarcode,
        clearOemPartNumber,
        reference: stockReference,
        reason: stockReason,
        userId: req.user._id,
      }),
    ));
  } else {
    await withProductDuplicateHandling(async () => {
      Object.assign(product, productChanges, { updatedBy: req.user._id });
      if (clearBarcode) product.set("barcode", undefined);
      if (clearOemPartNumber) product.set("oemPartNumber", undefined);
      await product.save();
    });
  }

  res
    .status(200)
    .json({
      success: true,
      message: "Product updated successfully",
      data: { product: buildProductResponse(updatedProduct) },
    });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  await deactivateProductService({
    productId: req.params.id,
    workspaceId: req.workspaceId,
    userId: req.user._id,
  });

  res
    .status(200)
    .json({ success: true, message: "Product deleted successfully" });
});
