import mongoose from "mongoose";
import {
  addSampleDataIndex,
  sampleDataFields,
} from "../utils/sampleDataFields.js";

const stockMovementSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      immutable: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      immutable: true,
    },
    movementType: {
      type: String,
      enum: ["stock_in", "sale", "adjustment"],
      required: true,
      immutable: true,
    },
    quantity: {
      type: Number,
      required: true,
      immutable: true,
      validate: {
        validator: (value) => Number.isFinite(value) && value > 0,
        message: "Movement quantity must be greater than zero",
      },
    },
    stockBefore: { type: Number, required: true, min: 0, immutable: true },
    stockAfter: { type: Number, required: true, min: 0, immutable: true },
    reference: { type: String, trim: true, maxlength: 120, immutable: true },
    reason: { type: String, trim: true, maxlength: 500, immutable: true },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      immutable: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 128,
      immutable: true,
    },
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

stockMovementSchema.pre("validate", function validateStockChange() {
  const expectedStock =
    this.movementType === "stock_in"
      ? this.stockBefore + this.quantity
      : this.movementType === "sale"
        ? this.stockBefore - this.quantity
        : null;

  if (
    expectedStock !== null &&
    Math.abs(this.stockAfter - expectedStock) > 1e-8
  ) {
    this.invalidate(
      "stockAfter",
      "Stock after the movement does not match the movement quantity",
    );
  }
  if (this.movementType === "sale" && this.stockAfter < 0) {
    this.invalidate("stockAfter", "A sale cannot reduce stock below zero");
  }
  if (
    this.movementType === "adjustment" &&
    Math.abs(Math.abs(this.stockAfter - this.stockBefore) - this.quantity) >
      1e-8
  ) {
    this.invalidate(
      "quantity",
      "Adjustment quantity must match the stock difference",
    );
  }
});

stockMovementSchema.index({ workspaceId: 1, createdAt: -1, _id: -1 });
stockMovementSchema.index({ workspaceId: 1, product: 1, createdAt: -1 });
stockMovementSchema.index(
  { workspaceId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
);
stockMovementSchema.index(
  { workspaceId: 1, sale: 1 },
  { unique: true, partialFilterExpression: { sale: { $type: "objectId" } } },
);
addSampleDataIndex(stockMovementSchema);

const StockMovement = mongoose.model("StockMovement", stockMovementSchema);
export default StockMovement;
