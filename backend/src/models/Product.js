import mongoose from "mongoose";
import {
  normalizeOptionalPartNumber,
  normalizeProductBarcode,
} from "../utils/productBarcode.js";
import {
  addSampleDataIndex,
  sampleDataFields,
} from "../utils/sampleDataFields.js";

const productSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      immutable: true,
    },
    productName: { type: String, required: true, trim: true, index: true },
    sku: { type: String, required: true, trim: true },
    oemPartNumber: {
      type: String,
      trim: true,
      set: normalizeOptionalPartNumber,
    },
    barcode: { type: String, trim: true, set: normalizeProductBarcode },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    description: { type: String, trim: true },
    unit: { type: String, default: "Unit" },
    costPrice: { type: Number, min: 0, default: 0 },
    sellingPrice: { type: Number, min: 0, default: 0 },
    currentStock: { type: Number, min: 0, default: 0 },
    purchaseOrderGuardVersion: {
      type: Number,
      min: 0,
      default: 0,
      select: false,
    },
    minimumStock: { type: Number, min: 0, default: 0 },
    maximumStock: { type: Number, min: 0, default: 0 },
    warehouseLocation: { type: String, trim: true },
    manufacturer: { type: String, trim: true },
    compatibleModels: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    warrantyPeriod: { type: String, trim: true },
    image: { type: String },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    testSuite: {
      type: String,
      enum: ["synthetic", "integration"],
      immutable: true,
    },
    testRunId: { type: String, trim: true, immutable: true },
    ...sampleDataFields(),
  },
  { timestamps: true },
);

productSchema.pre("validate", function normalizeOptionalBarcode() {
  this.set("barcode", normalizeProductBarcode(this.barcode));
});

productSchema.virtual("stockStatus").get(function () {
  if (!this.isActive) return "Inactive";
  if (this.currentStock === 0) return "Out of Stock";
  if (this.currentStock <= this.minimumStock) return "Low Stock";
  return "In Stock";
});

productSchema.index({ productName: 1, createdAt: -1 });
productSchema.index({ category: 1, supplier: 1, createdAt: -1 });
productSchema.index({ workspaceId: 1, isActive: 1, productName: 1 });
productSchema.index({ workspaceId: 1, isActive: 1, createdAt: -1 });
productSchema.index({
  workspaceId: 1,
  isActive: 1,
  category: 1,
  productName: 1,
});
productSchema.index({
  workspaceId: 1,
  isActive: 1,
  supplier: 1,
  productName: 1,
});
productSchema.index({ workspaceId: 1, sku: 1 }, { unique: true });
productSchema.index(
  { workspaceId: 1, barcode: 1 },
  { unique: true, partialFilterExpression: { barcode: { $type: "string" } } },
);
productSchema.index(
  { workspaceId: 1, oemPartNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { oemPartNumber: { $type: "string" } },
  },
);
addSampleDataIndex(productSchema);

const Product = mongoose.model("Product", productSchema);
export default Product;
