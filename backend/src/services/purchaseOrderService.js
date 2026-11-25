import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import StockMovement from '../models/StockMovement.js';
import Supplier from '../models/Supplier.js';
import AppError from '../utils/AppError.js';
import { receiveStockWithinTransaction, runInventoryTransaction } from './inventoryService.js';

const money = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeDate = (value, label, { optional = false } = {}) => {
  if ((value === undefined || value === null || value === '') && optional) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new AppError(`${label} must be a valid date`, 400);
  return date;
};

const normalizeNotes = (value) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.trim().length > 1000) {
    throw new AppError('Notes must be a string of at most 1000 characters', 400);
  }
  return value.trim();
};

const normalizeSupplierId = (value) => {
  if (!mongoose.isValidObjectId(value)) throw new AppError('A valid supplier is required', 400);
  return String(value).toLowerCase();
};

const normalizeNumericInput = (value) => (
  (typeof value === 'number' || typeof value === 'string') && !(typeof value === 'string' && !value.trim())
    ? Number(value)
    : Number.NaN
);

const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    throw new AppError('A purchase order must contain between 1 and 100 items', 400);
  }

  const seenProducts = new Set();
  return items.map((item) => {
    if (!item || Object.prototype.hasOwnProperty.call(item, 'receivedQuantity')) {
      throw new AppError('Received quantities cannot be changed through purchase order edits', 400);
    }
    if (!mongoose.isValidObjectId(item.productId)) throw new AppError('A valid product is required for every item', 400);
    const productId = String(item.productId).toLowerCase();
    if (seenProducts.has(productId)) throw new AppError('A product may only appear once in a purchase order', 400);
    seenProducts.add(productId);

    const orderedQuantity = normalizeNumericInput(item.orderedQuantity);
    const unitCost = normalizeNumericInput(item.unitCost);
    if (!Number.isInteger(orderedQuantity) || orderedQuantity <= 0) {
      throw new AppError('Ordered quantities must be positive integers', 400);
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw new AppError('Unit costs must be valid non-negative amounts', 400);
    }
    const lineTotal = money(orderedQuantity * unitCost);
    if (!Number.isFinite(lineTotal)) throw new AppError('A purchase order line total is too large', 400);

    return {
      product: productId,
      orderedQuantity,
      receivedQuantity: 0,
      unitCost,
      lineTotal,
    };
  });
};

const normalizeReceiptItems = (items) => {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    throw new AppError('A receipt must contain between 1 and 100 items', 400);
  }

  const seenProducts = new Set();
  return items.map((item) => {
    if (!item || !mongoose.isValidObjectId(item.productId)) {
      throw new AppError('A valid product is required for every receipt item', 400);
    }
    const productId = String(item.productId).toLowerCase();
    const quantity = normalizeNumericInput(item.quantity);
    if (seenProducts.has(productId)) throw new AppError('A product may only appear once per receipt', 400);
    seenProducts.add(productId);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError('Received quantities must be positive integers', 400);
    }
    return { productId, quantity };
  });
};

const normalizeReceiptKey = (value) => {
  const key = typeof value === 'string' ? value.trim() : '';
  if (key.length < 8 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new AppError('A valid Idempotency-Key between 8 and 128 characters is required', 400);
  }
  return key;
};

const generatePurchaseOrderNumber = () => (
  `PO-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString('hex').toUpperCase()}`
);

const validateSupplier = async (SupplierModel, supplierId, workspaceId, session) => {
  let query = SupplierModel.findOne({
    _id: supplierId,
    workspaceId,
    isActive: true,
    status: 'active',
  });
  if (session && typeof query.session === 'function') query = query.session(session);
  const supplier = await query;
  if (!supplier) throw new AppError('Active supplier not found in the current workspace', 404);
};

const lockPurchaseOrderProducts = async (ProductModel, productIds, workspaceId, session) => {
  const uniqueProductIds = [...new Set(productIds.map((id) => String(id).toLowerCase()))].sort();
  for (const productId of uniqueProductIds) {
    const product = await ProductModel.findOneAndUpdate({
      _id: productId,
      workspaceId,
      isActive: true,
    }, {
      $inc: { purchaseOrderGuardVersion: 1 },
    }, {
      new: true,
      runValidators: true,
      session,
      timestamps: false,
    });
    if (!product) throw new AppError('Active product not found in the current workspace', 404);
  }
};

const calculateTotals = (items) => {
  const subtotal = money(items.reduce((sum, item) => sum + item.lineTotal, 0));
  if (!Number.isFinite(subtotal)) throw new AppError('Purchase order total is too large', 400);
  return { subtotal, totalAmount: subtotal };
};

const toEditableItems = (items) => items.map((item) => ({
  product: item.product?._id || item.product,
  orderedQuantity: item.orderedQuantity,
  receivedQuantity: item.receivedQuantity || 0,
  unitCost: item.unitCost,
  lineTotal: item.lineTotal,
}));

const requirePurchaseOrder = async (PurchaseOrderModel, id, workspaceId, session) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError('Purchase order not found', 404);
  let query = PurchaseOrderModel.findOne({ _id: id, workspaceId });
  if (session && typeof query.session === 'function') query = query.session(session);
  const purchaseOrder = await query;
  if (!purchaseOrder) throw new AppError('Purchase order not found', 404);
  return purchaseOrder;
};

const statusConflict = (message) => new AppError(message, 409);

export const createPurchaseOrder = async ({
  workspaceId,
  supplierId,
  poNumber: requestedPoNumber,
  orderDate,
  expectedDeliveryDate,
  items: requestedItems,
  notes,
  userId,
  sampleData = {},
}, {
  PurchaseOrderModel = PurchaseOrder,
  SupplierModel = Supplier,
  ProductModel = Product,
  makePurchaseOrderNumber = generatePurchaseOrderNumber,
  transaction = runInventoryTransaction,
} = {}) => {
  const normalizedSupplierId = normalizeSupplierId(supplierId);
  const items = normalizeItems(requestedItems);
  const normalizedOrderDate = normalizeDate(orderDate || new Date(), 'Purchase order date');
  const normalizedExpectedDate = normalizeDate(expectedDeliveryDate, 'Expected delivery date', { optional: true });
  if (normalizedExpectedDate && normalizedExpectedDate < normalizedOrderDate) {
    throw new AppError('Expected delivery date cannot be before the purchase order date', 400);
  }
  const poNumber = typeof requestedPoNumber === 'string' && requestedPoNumber.trim()
    ? requestedPoNumber.trim()
    : makePurchaseOrderNumber();

  return transaction(async (session) => {
    await validateSupplier(SupplierModel, normalizedSupplierId, workspaceId, session);
    await lockPurchaseOrderProducts(
      ProductModel,
      items.map((item) => item.product),
      workspaceId,
      session,
    );

    return new PurchaseOrderModel({
      workspaceId,
      poNumber,
      supplier: normalizedSupplierId,
      orderDate: normalizedOrderDate,
      expectedDeliveryDate: normalizedExpectedDate,
      items,
      ...calculateTotals(items),
      status: 'draft',
      notes: normalizeNotes(notes),
      createdBy: userId,
      updatedBy: userId,
      ...sampleData,
    }).save({ session });
  });
};

export const listPurchaseOrders = async ({
  workspaceId,
  page = 1,
  limit = 10,
  status,
  search = '',
}, {
  PurchaseOrderModel = PurchaseOrder,
  SupplierModel = Supplier,
} = {}) => {
  const query = { workspaceId };
  if (status) query.status = status;
  const cleanSearch = typeof search === 'string' ? search.trim().slice(0, 100) : '';
  if (cleanSearch) {
    const expression = new RegExp(escapeRegex(cleanSearch), 'i');
    const suppliers = await SupplierModel.find({
      workspaceId,
      $or: [{ name: expression }, { supplierCode: expression }],
    }).select('_id').lean();
    query.$or = [
      { poNumber: expression },
      { supplier: { $in: suppliers.map((supplier) => supplier._id) } },
    ];
  }

  const [purchaseOrders, totalItems] = await Promise.all([
    PurchaseOrderModel.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('supplier', 'name supplierCode')
      .lean(),
    PurchaseOrderModel.countDocuments(query),
  ]);
  return {
    purchaseOrders,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

export const updateDraftPurchaseOrder = async ({
  id,
  workspaceId,
  supplierId,
  orderDate,
  expectedDeliveryDate,
  items: requestedItems,
  notes,
  userId,
}, {
  PurchaseOrderModel = PurchaseOrder,
  SupplierModel = Supplier,
  ProductModel = Product,
  transaction = runInventoryTransaction,
} = {}) => {
  return transaction(async (session) => {
    const purchaseOrder = await requirePurchaseOrder(PurchaseOrderModel, id, workspaceId, session);
    if (purchaseOrder.status !== 'draft') throw statusConflict('Only draft purchase orders can be edited');

    const normalizedSupplierId = supplierId === undefined
      ? String(purchaseOrder.supplier?._id || purchaseOrder.supplier)
      : normalizeSupplierId(supplierId);
    const items = requestedItems === undefined
      ? toEditableItems(purchaseOrder.items)
      : normalizeItems(requestedItems);
    const normalizedItems = requestedItems === undefined
      ? items.map((item) => ({ ...item, receivedQuantity: 0 }))
      : items;
    const normalizedOrderDate = orderDate === undefined
      ? purchaseOrder.orderDate
      : normalizeDate(orderDate, 'Purchase order date');
    const normalizedExpectedDate = expectedDeliveryDate === undefined
      ? purchaseOrder.expectedDeliveryDate || null
      : normalizeDate(expectedDeliveryDate, 'Expected delivery date', { optional: true });
    if (normalizedExpectedDate && normalizedExpectedDate < normalizedOrderDate) {
      throw new AppError('Expected delivery date cannot be before the purchase order date', 400);
    }

    await validateSupplier(SupplierModel, normalizedSupplierId, workspaceId, session);
    await lockPurchaseOrderProducts(
      ProductModel,
      [
        ...purchaseOrder.items.map((item) => item.product?._id || item.product),
        ...normalizedItems.map((item) => item.product),
      ],
      workspaceId,
      session,
    );

    const updated = await PurchaseOrderModel.findOneAndUpdate(
      { _id: purchaseOrder._id, workspaceId, status: 'draft' },
      {
        $set: {
          supplier: normalizedSupplierId,
          orderDate: normalizedOrderDate,
          expectedDeliveryDate: normalizedExpectedDate,
          items: normalizedItems,
          ...calculateTotals(normalizedItems),
          notes: notes === undefined ? purchaseOrder.notes : normalizeNotes(notes),
          updatedBy: userId,
        },
      },
      { new: true, runValidators: true, session },
    );
    if (!updated) throw statusConflict('Purchase order status changed; reload before editing');
    return updated;
  });
};

export const markPurchaseOrderOrdered = async ({
  id,
  workspaceId,
  userId,
}, {
  PurchaseOrderModel = PurchaseOrder,
  transaction = runInventoryTransaction,
} = {}) => {
  return transaction(async (session) => {
    const purchaseOrder = await requirePurchaseOrder(PurchaseOrderModel, id, workspaceId, session);
    if (purchaseOrder.status !== 'draft') throw statusConflict('Only draft purchase orders can be ordered');
    const updated = await PurchaseOrderModel.findOneAndUpdate(
      { _id: purchaseOrder._id, workspaceId, status: 'draft' },
      { $set: { status: 'ordered', updatedBy: userId } },
      { new: true, runValidators: true, session },
    );
    if (!updated) throw statusConflict('Purchase order status changed; reload before ordering');
    return updated;
  });
};

export const cancelPurchaseOrder = async ({
  id,
  workspaceId,
  userId,
}, {
  PurchaseOrderModel = PurchaseOrder,
  transaction = runInventoryTransaction,
} = {}) => {
  return transaction(async (session) => {
    const purchaseOrder = await requirePurchaseOrder(PurchaseOrderModel, id, workspaceId, session);
    if (!['draft', 'ordered'].includes(purchaseOrder.status)
      || purchaseOrder.items.some((item) => item.receivedQuantity > 0)) {
      throw statusConflict('Purchase orders cannot be cancelled after receiving starts');
    }
    const updated = await PurchaseOrderModel.findOneAndUpdate(
      { _id: purchaseOrder._id, workspaceId, status: purchaseOrder.status },
      { $set: { status: 'cancelled', updatedBy: userId } },
      { new: true, runValidators: true, session },
    );
    if (!updated) throw statusConflict('Purchase order status changed; reload before cancelling');
    return updated;
  });
};

const receiptFingerprint = (items) => createHash('sha256')
  .update(JSON.stringify([...items].sort((left, right) => left.productId.localeCompare(right.productId))))
  .digest('hex');

const movementIdempotencyKey = ({ workspaceId, purchaseOrderId, requestKey, productId }) => createHash('sha256')
  .update(`${workspaceId}:${purchaseOrderId}:${requestKey}:${productId}`)
  .digest('hex');

const receiptConflictError = (message) => new AppError(
  message,
  409,
  null,
  'PURCHASE_ORDER_RECEIPT_KEY_ALREADY_USED',
);

export const receivePurchaseOrderItems = async ({
  id,
  workspaceId,
  items: requestedItems,
  idempotencyKey,
  userId,
  receivedAt,
  sampleData = {},
}, {
  PurchaseOrderModel = PurchaseOrder,
  ProductModel = Product,
  MovementModel = StockMovement,
  transaction = runInventoryTransaction,
  testOwnership = {},
} = {}) => {
  const key = normalizeReceiptKey(idempotencyKey);
  const items = normalizeReceiptItems(requestedItems);
  const fingerprint = receiptFingerprint(items);
  const receiptDate = receivedAt === undefined ? new Date() : normalizeDate(receivedAt, 'Receipt date');
  const movementResults = [];

  try {
    const purchaseOrder = await transaction(async (session) => {
      const currentOrder = await PurchaseOrderModel.findOne({ _id: id, workspaceId }).session(session);
      if (!currentOrder) throw new AppError('Purchase order not found', 404);
      if (!['ordered', 'partially_received'].includes(currentOrder.status)) {
        throw statusConflict('Only ordered purchase orders can receive items');
      }

      const previousRequest = currentOrder.receiptRequests.find((request) => request.idempotencyKey === key);
      if (previousRequest) {
        throw receiptConflictError(previousRequest.payloadFingerprint === fingerprint
          ? 'This purchase order receipt request was already processed'
          : 'This Idempotency-Key was already used with different receipt details');
      }

      const linesByProduct = new Map(currentOrder.items.map((item) => [
        String(item.product?._id || item.product).toLowerCase(),
        item,
      ]));
      movementResults.length = 0;
      for (const [receiptIndex, receiptItem] of items.entries()) {
        const orderLine = linesByProduct.get(receiptItem.productId);
        if (!orderLine) throw new AppError('Receipt product is not part of this purchase order', 400);
        const remaining = orderLine.orderedQuantity - orderLine.receivedQuantity;
        if (receiptItem.quantity > remaining) {
          throw new AppError('Received quantity cannot exceed the remaining ordered quantity', 400);
        }

        const result = await receiveStockWithinTransaction({
          workspaceId,
          productId: receiptItem.productId,
          quantity: receiptItem.quantity,
          reference: currentOrder.poNumber,
          reason: `Purchase order ${currentOrder.poNumber} receipt`,
          userId,
          idempotencyKey: movementIdempotencyKey({
            workspaceId,
            purchaseOrderId: currentOrder._id,
            requestKey: key,
            productId: receiptItem.productId,
          }),
          occurredAt: receiptDate,
          sampleData: sampleData.sampleDatasetId
            ? {
              ...sampleData,
              sampleRecordKey: `${sampleData.sampleRecordKey || id}:line:${receiptIndex + 1}`,
            }
            : {},
          session,
        }, { ProductModel, MovementModel, testOwnership });
        movementResults.push(result.movement);
        orderLine.receivedQuantity += receiptItem.quantity;
      }

      const allReceived = currentOrder.items.every((item) => item.receivedQuantity === item.orderedQuantity);
      currentOrder.status = allReceived ? 'received' : 'partially_received';
      currentOrder.updatedBy = userId;
      currentOrder.receiptRequests.push({
        idempotencyKey: key,
        payloadFingerprint: fingerprint,
        receivedAt: receiptDate,
        receivedBy: userId,
      });
      await currentOrder.save({ session });
      return currentOrder;
    });
    return { purchaseOrder, movements: movementResults };
  } catch (error) {
    if (error?.code === 11000) {
      throw receiptConflictError('This purchase order receipt request was already processed');
    }
    throw error;
  }
};
