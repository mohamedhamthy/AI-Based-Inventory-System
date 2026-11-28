import PurchaseOrder from "../models/PurchaseOrder.js";
import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import {
  cancelPurchaseOrder as cancelOrder,
  createPurchaseOrder as createOrder,
  listPurchaseOrders,
  markPurchaseOrderOrdered,
  receivePurchaseOrderItems,
  updateDraftPurchaseOrder,
} from "../services/purchaseOrderService.js";

const populateOrder = (query) =>
  query
    .populate("supplier", "name supplierCode")
    .populate("items.product", "productName sku oemPartNumber");

const loadOrder = async (id, workspaceId) => {
  const purchaseOrder = await populateOrder(
    PurchaseOrder.findOne({ _id: id, workspaceId }),
  ).lean();
  if (!purchaseOrder) throw new AppError("Purchase order not found", 404);
  return purchaseOrder;
};

export const getPurchaseOrders = asyncHandler(async (req, res) => {
  const page = Math.max(
    1,
    Math.min(Number.parseInt(req.query.page, 10) || 1, 100000),
  );
  const limit = Math.max(
    1,
    Math.min(Number.parseInt(req.query.limit, 10) || 10, 100),
  );
  const { purchaseOrders, pagination } = await listPurchaseOrders({
    workspaceId: req.workspaceId,
    page,
    limit,
    status: req.query.status || undefined,
    search: req.query.search || "",
  });
  res.status(200).json({
    success: true,
    data: { purchaseOrders, pagination },
  });
});

export const getPurchaseOrder = asyncHandler(async (req, res) => {
  const purchaseOrder = await loadOrder(req.params.id, req.workspaceId);
  res.status(200).json({ success: true, data: { purchaseOrder } });
});

export const createPurchaseOrder = asyncHandler(async (req, res) => {
  const purchaseOrder = await createOrder({
    supplierId: req.body.supplierId,
    orderDate: req.body.orderDate,
    expectedDeliveryDate: req.body.expectedDeliveryDate,
    items: req.body.items,
    notes: req.body.notes,
    workspaceId: req.workspaceId,
    userId: req.user._id,
  });
  res.status(201).json({
    success: true,
    message: "Purchase order created as a draft",
    data: {
      purchaseOrder: await loadOrder(purchaseOrder._id, req.workspaceId),
    },
  });
});

export const updatePurchaseOrder = asyncHandler(async (req, res) => {
  const { supplierId, orderDate, expectedDeliveryDate, items, notes } =
    req.body;
  const purchaseOrder = await updateDraftPurchaseOrder({
    id: req.params.id,
    workspaceId: req.workspaceId,
    supplierId,
    orderDate,
    expectedDeliveryDate,
    items,
    notes,
    userId: req.user._id,
  });
  res.status(200).json({
    success: true,
    message: "Draft purchase order updated",
    data: {
      purchaseOrder: await loadOrder(purchaseOrder._id, req.workspaceId),
    },
  });
});

export const orderPurchaseOrder = asyncHandler(async (req, res) => {
  const purchaseOrder = await markPurchaseOrderOrdered({
    id: req.params.id,
    workspaceId: req.workspaceId,
    userId: req.user._id,
  });
  res.status(200).json({
    success: true,
    message: "Purchase order marked as ordered",
    data: {
      purchaseOrder: await loadOrder(purchaseOrder._id, req.workspaceId),
    },
  });
});

export const cancelPurchaseOrder = asyncHandler(async (req, res) => {
  const purchaseOrder = await cancelOrder({
    id: req.params.id,
    workspaceId: req.workspaceId,
    userId: req.user._id,
  });
  res.status(200).json({
    success: true,
    message: "Purchase order cancelled",
    data: {
      purchaseOrder: await loadOrder(purchaseOrder._id, req.workspaceId),
    },
  });
});

export const receivePurchaseOrder = asyncHandler(async (req, res) => {
  const result = await receivePurchaseOrderItems({
    id: req.params.id,
    workspaceId: req.workspaceId,
    items: req.body.items,
    idempotencyKey: req.get("Idempotency-Key"),
    userId: req.user._id,
  });
  res.status(200).json({
    success: true,
    message: "Purchase order receipt recorded",
    data: {
      purchaseOrder: await loadOrder(result.purchaseOrder._id, req.workspaceId),
      movements: result.movements,
    },
  });
});
