import mongoose from "mongoose";
import {
  addSampleDataIndex,
  sampleDataFields,
} from "../utils/sampleDataFields.js";

const purchaseOrderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    orderedQuantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Ordered quantity must be a positive integer",
      },
    },
    receivedQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Received quantity must be a non-negative integer",
      },
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isFinite,
        message: "Unit cost must be finite",
      },
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isFinite,
        message: "Line total must be finite",
      },
    },
  },
  { _id: true },
);

const receiptRequestSchema = new mongoose.Schema(
  {
    idempotencyKey: {
      type: String,
      required: true,
      immutable: true,
      maxlength: 128,
    },
    payloadFingerprint: {
      type: String,
      required: true,
      immutable: true,
      match: /^[a-f0-9]{64}$/,
    },
    receivedAt: {
      type: Date,
      required: true,
      default: Date.now,
      immutable: true,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
  },
  { _id: false },
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      immutable: true,
    },
    poNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
      immutable: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    orderDate: { type: Date, required: true, default: Date.now },
    expectedDeliveryDate: { type: Date },
    items: {
      type: [purchaseOrderItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "A purchase order must contain at least one item",
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isFinite,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isFinite,
    },
    status: {
      type: String,
      enum: ["draft", "ordered", "partially_received", "received", "cancelled"],
      required: true,
      default: "draft",
    },
    notes: { type: String, trim: true, maxlength: 1000 },
    receiptRequests: { type: [receiptRequestSchema], default: [] },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

purchaseOrderSchema.pre("validate", function validatePurchaseOrder() {
  const seenProducts = new Set();
  let calculatedSubtotal = 0;
  let hasReceivedItems = false;
  let allItemsReceived = true;

  for (const item of this.items) {
    const productId = item.product?.toString();
    if (productId && seenProducts.has(productId)) {
      this.invalidate(
        "items",
        "A product may only appear once in a purchase order",
      );
    }
    if (productId) seenProducts.add(productId);

    if (
      !Number.isInteger(item.orderedQuantity) ||
      item.orderedQuantity <= 0 ||
      !Number.isInteger(item.receivedQuantity) ||
      item.receivedQuantity < 0 ||
      item.receivedQuantity > item.orderedQuantity
    ) {
      this.invalidate("items", "Purchase order quantities are invalid");
    }
    if (
      !Number.isFinite(item.unitCost) ||
      item.unitCost < 0 ||
      !Number.isFinite(item.lineTotal) ||
      item.lineTotal < 0
    ) {
      this.invalidate(
        "items",
        "Purchase order costs must be valid non-negative amounts",
      );
    }

    const expectedLineTotal =
      Math.round(
        (item.orderedQuantity * item.unitCost + Number.EPSILON) * 100,
      ) / 100;
    if (Math.abs(item.lineTotal - expectedLineTotal) > 1e-8) {
      this.invalidate(
        "items",
        "Line totals must match ordered quantities and unit costs",
      );
    }
    calculatedSubtotal += item.lineTotal;
    hasReceivedItems ||= item.receivedQuantity > 0;
    allItemsReceived &&= item.receivedQuantity === item.orderedQuantity;
  }

  calculatedSubtotal =
    Math.round((calculatedSubtotal + Number.EPSILON) * 100) / 100;
  if (
    !Number.isFinite(this.subtotal) ||
    !Number.isFinite(this.totalAmount) ||
    Math.abs(this.subtotal - calculatedSubtotal) > 1e-8 ||
    Math.abs(this.totalAmount - calculatedSubtotal) > 1e-8
  ) {
    this.invalidate(
      "totalAmount",
      "Purchase order totals must match the line totals",
    );
  }

  if (this.expectedDeliveryDate && this.expectedDeliveryDate < this.orderDate) {
    this.invalidate(
      "expectedDeliveryDate",
      "Expected delivery date cannot be before the purchase order date",
    );
  }

  if (
    ["draft", "ordered", "cancelled"].includes(this.status) &&
    hasReceivedItems
  ) {
    this.invalidate(
      "status",
      "This status cannot be used after items have been received",
    );
  }
  if (
    this.status === "partially_received" &&
    (!hasReceivedItems || allItemsReceived)
  ) {
    this.invalidate(
      "status",
      "Partially received status requires both received and outstanding quantities",
    );
  }
  if (this.status === "received" && !allItemsReceived) {
    this.invalidate(
      "status",
      "Received status requires all ordered quantities to be received",
    );
  }
});

purchaseOrderSchema.index({ workspaceId: 1, poNumber: 1 }, { unique: true });
purchaseOrderSchema.index({
  workspaceId: 1,
  status: 1,
  createdAt: -1,
  _id: -1,
});
purchaseOrderSchema.index({ workspaceId: 1, supplier: 1, createdAt: -1 });
addSampleDataIndex(purchaseOrderSchema);

const PurchaseOrder = mongoose.model("PurchaseOrder", purchaseOrderSchema);
export default PurchaseOrder;
