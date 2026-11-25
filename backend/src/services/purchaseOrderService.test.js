import assert from 'node:assert/strict';
import { test } from 'node:test';
import AppError from '../utils/AppError.js';
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  listPurchaseOrders,
  markPurchaseOrderOrdered,
  receivePurchaseOrderItems,
  updateDraftPurchaseOrder,
} from './purchaseOrderService.js';

const session = { id: 'purchase-order-session' };
const workspaceId = '64b000000000000000000010';
const supplierId = '64b000000000000000000020';
const productId = '64b000000000000000000030';
const secondProductId = '64b000000000000000000031';
const purchaseOrderId = '64b000000000000000000040';
const userId = '64b000000000000000000050';
const receiptKey = 'receipt-operation-123';
const orderItems = [
  { product: productId, orderedQuantity: 5, receivedQuantity: 0, unitCost: 2.5, lineTotal: 12.5 },
  { product: secondProductId, orderedQuantity: 3, receivedQuantity: 0, unitCost: 4, lineTotal: 12 },
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const createDatabase = ({
  status = 'ordered',
  items = orderItems,
  productWorkspace = workspaceId,
  supplierWorkspace = workspaceId,
  movementSaveError = null,
  purchaseOrderSaveError = null,
  includeOrder = true,
} = {}) => {
  const products = new Map([
    [productId, { _id: productId, workspaceId: productWorkspace, isActive: true, currentStock: 10, purchaseOrderGuardVersion: 0 }],
    [secondProductId, { _id: secondProductId, workspaceId, isActive: true, currentStock: 2, purchaseOrderGuardVersion: 0 }],
  ]);
  const supplier = supplierWorkspace === workspaceId
    ? { _id: supplierId, workspaceId, isActive: true, status: 'active' }
    : null;
  const movements = [];
  const orders = new Map();
  const order = includeOrder ? {
    _id: purchaseOrderId,
    workspaceId,
    poNumber: 'PO-TEST-001',
    supplier: supplierId,
    orderDate: new Date('2026-01-01T00:00:00.000Z'),
    expectedDeliveryDate: null,
    items: clone(items),
    subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
    totalAmount: items.reduce((sum, item) => sum + item.lineTotal, 0),
    status,
    notes: '',
    receiptRequests: [],
    createdBy: userId,
    updatedBy: userId,
    async save(options = {}) {
      if (options.session) assert.equal(options.session, session);
      if (purchaseOrderSaveError) throw purchaseOrderSaveError;
      orders.set(this._id, this);
      return this;
    },
  } : null;
  if (order) orders.set(order._id, order);

  const query = (value) => ({
    session: async (usedSession) => {
      assert.equal(usedSession, session);
      return value;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  });

  class PurchaseOrderModel {
    constructor(data) {
      Object.assign(this, data, { _id: purchaseOrderId, receiptRequests: data.receiptRequests || [] });
    }

    async save(options = {}) {
      if (options.session) assert.equal(options.session, session);
      if (purchaseOrderSaveError) throw purchaseOrderSaveError;
      orders.set(this._id, this);
      return this;
    }

    static findOne(filter) {
      const found = orders.get(String(filter._id)) || null;
      return query(found && found.workspaceId === filter.workspaceId ? found : null);
    }

    static async findOneAndUpdate(filter, update, options = {}) {
      if (options.session) assert.equal(options.session, session);
      const found = orders.get(String(filter._id));
      if (!found || found.workspaceId !== filter.workspaceId || found.status !== filter.status) return null;
      Object.assign(found, clone(update.$set));
      return found;
    }
  }

  const SupplierModel = {
    findOne(filter) {
      return supplier
        && supplier._id === String(filter._id)
        && supplier.workspaceId === filter.workspaceId
        && filter.isActive === true
        && filter.status === 'active'
        ? query(supplier)
        : query(null);
    },
  };

  const ProductModel = {
    findOne(filter) {
      const product = products.get(String(filter._id));
      return query(product
        && product.workspaceId === filter.workspaceId
        && product.isActive === true
        ? product
        : null);
    },
    async findOneAndUpdate(filter, update, options) {
      assert.equal(options.session, session);
      const product = products.get(String(filter._id));
      if (!product || product.workspaceId !== filter.workspaceId || !product.isActive) return null;
      if (Object.hasOwn(update.$inc || {}, 'purchaseOrderGuardVersion')) {
        product.purchaseOrderGuardVersion += update.$inc.purchaseOrderGuardVersion;
        return product;
      }
      if (product.currentStock !== filter.currentStock) return null;
      product.currentStock += update.$inc.currentStock;
      product.updatedBy = update.$set.updatedBy;
      return product;
    },
  };

  class MovementModel {
    constructor(data) {
      Object.assign(this, data, { _id: `movement-${movements.length + 1}` });
    }

    async save(options) {
      assert.equal(options.session, session);
      if (movementSaveError) throw movementSaveError;
      movements.push(this);
      return this;
    }
  }

  const transaction = async (operation) => {
    const stockBefore = new Map([...products].map(([id, product]) => [id, product.currentStock]));
    const guardVersionsBefore = new Map([...products].map(([id, product]) => [id, product.purchaseOrderGuardVersion]));
    const orderBefore = order ? {
      status: order.status,
      updatedBy: order.updatedBy,
      items: clone(order.items),
      receiptRequests: clone(order.receiptRequests),
    } : null;
    const movementCount = movements.length;
    try {
      return await operation(session);
    } catch (error) {
      for (const [id, quantity] of stockBefore) products.get(id).currentStock = quantity;
      for (const [id, version] of guardVersionsBefore) products.get(id).purchaseOrderGuardVersion = version;
      if (order && orderBefore) Object.assign(order, orderBefore);
      movements.length = movementCount;
      throw error;
    }
  };

  return {
    order,
    orders,
    products,
    movements,
    PurchaseOrderModel,
    SupplierModel,
    ProductModel,
    MovementModel,
    transaction,
  };
};

const createDraft = (database, overrides = {}) => createPurchaseOrder({
  workspaceId,
  supplierId,
  orderDate: '2026-01-01',
  expectedDeliveryDate: '',
  items: [
    { productId, orderedQuantity: 4, unitCost: 2.5 },
    { productId: secondProductId, orderedQuantity: 2, unitCost: 4 },
  ],
  notes: 'Initial draft',
  userId,
  ...overrides,
}, {
  PurchaseOrderModel: database.PurchaseOrderModel,
  SupplierModel: database.SupplierModel,
  ProductModel: database.ProductModel,
  makePurchaseOrderNumber: () => 'PO-TEST-NEW',
  transaction: database.transaction,
});

test('purchase order creation validates workspace references and computes line and order totals', async () => {
  const database = createDatabase({ includeOrder: false });
  const purchaseOrder = await createDraft(database);

  assert.equal(purchaseOrder.status, 'draft');
  assert.equal(purchaseOrder.poNumber, 'PO-TEST-NEW');
  assert.equal(purchaseOrder.items.length, 2);
  assert.equal(purchaseOrder.items[0].lineTotal, 10);
  assert.equal(purchaseOrder.subtotal, 18);
  assert.equal(purchaseOrder.totalAmount, 18);
  assert.equal(purchaseOrder.createdBy, userId);
  assert.equal(database.products.get(productId).purchaseOrderGuardVersion, 1);
  assert.equal(database.products.get(secondProductId).purchaseOrderGuardVersion, 1);
});

test('purchase order creation rejects invalid and cross-workspace suppliers and products', async () => {
  const invalidSupplierDatabase = createDatabase({ includeOrder: false, supplierWorkspace: '64b000000000000000000099' });
  await assert.rejects(createDraft(invalidSupplierDatabase), (error) => error.statusCode === 404);

  const crossWorkspaceProductDatabase = createDatabase({ includeOrder: false, productWorkspace: '64b000000000000000000099' });
  await assert.rejects(createDraft(crossWorkspaceProductDatabase), (error) => error.statusCode === 404);

  const database = createDatabase({ includeOrder: false });
  await assert.rejects(createDraft(database, { supplierId: 'not-an-object-id' }), (error) => error.statusCode === 400);
});

test('purchase order creation rejects empty items, fractional quantities, and invalid costs', async () => {
  const database = createDatabase({ includeOrder: false });
  await assert.rejects(createDraft(database, { items: [] }), (error) => error.statusCode === 400);
  await assert.rejects(createDraft(database, {
    items: [{ productId, orderedQuantity: 1.5, unitCost: 2 }],
  }), (error) => error.statusCode === 400);
  await assert.rejects(createDraft(database, {
    items: [{ productId, orderedQuantity: 1, unitCost: -1 }],
  }), (error) => error.statusCode === 400);
});

test('only draft purchase orders can be edited and received quantities are not editable', async () => {
  const database = createDatabase({ status: 'ordered' });
  await assert.rejects(updateDraftPurchaseOrder({
    id: purchaseOrderId,
    workspaceId,
    notes: 'Attempted change',
    userId,
  }, {
    PurchaseOrderModel: database.PurchaseOrderModel,
    transaction: database.transaction,
  }), (error) => error.statusCode === 409);

  const draftDatabase = createDatabase({ status: 'draft' });
  await assert.rejects(updateDraftPurchaseOrder({
    id: purchaseOrderId,
    workspaceId,
    items: [{ productId, orderedQuantity: 2, receivedQuantity: 2, unitCost: 1 }],
    userId,
  }, {
    PurchaseOrderModel: draftDatabase.PurchaseOrderModel,
    SupplierModel: draftDatabase.SupplierModel,
    ProductModel: draftDatabase.ProductModel,
    transaction: draftDatabase.transaction,
  }), (error) => error.statusCode === 400);
});

test('draft edits recalculate totals without changing ordered or received data', async () => {
  const database = createDatabase({ status: 'draft' });
  const updated = await updateDraftPurchaseOrder({
    id: purchaseOrderId,
    workspaceId,
    items: [{ productId, orderedQuantity: 3, unitCost: 4 }],
    notes: 'Updated draft',
    userId,
  }, {
    PurchaseOrderModel: database.PurchaseOrderModel,
    SupplierModel: database.SupplierModel,
    ProductModel: database.ProductModel,
    transaction: database.transaction,
  });
  assert.equal(updated.items.length, 1);
  assert.equal(updated.items[0].orderedQuantity, 3);
  assert.equal(updated.items[0].receivedQuantity, 0);
  assert.equal(updated.subtotal, 12);
  assert.equal(updated.totalAmount, 12);
  assert.equal(database.products.get(productId).purchaseOrderGuardVersion, 1);
  assert.equal(database.products.get(secondProductId).purchaseOrderGuardVersion, 1);
});

test('draft purchase orders can be ordered once and invalid transitions conflict', async () => {
  const database = createDatabase({ status: 'draft' });
  const ordered = await markPurchaseOrderOrdered({
    id: purchaseOrderId,
    workspaceId,
    userId,
  }, { PurchaseOrderModel: database.PurchaseOrderModel, transaction: database.transaction });
  assert.equal(ordered.status, 'ordered');

  await assert.rejects(markPurchaseOrderOrdered({
    id: purchaseOrderId,
    workspaceId,
    userId,
  }, { PurchaseOrderModel: database.PurchaseOrderModel, transaction: database.transaction }), (error) => error.statusCode === 409);
});

test('eligible draft and ordered purchase orders can be cancelled', async () => {
  for (const status of ['draft', 'ordered']) {
    const database = createDatabase({ status });
    const cancelled = await cancelPurchaseOrder({
      id: purchaseOrderId,
      workspaceId,
      userId,
    }, { PurchaseOrderModel: database.PurchaseOrderModel, transaction: database.transaction });
    assert.equal(cancelled.status, 'cancelled');
  }
});

test('purchase order listing filters status, search, pagination, and supplier lookup by workspace', async () => {
  let purchaseOrderFilter;
  let supplierFilter;
  const purchaseQuery = {
    sort(sort) { this.sortValue = sort; return this; },
    skip(skip) { this.skipValue = skip; return this; },
    limit(limit) { this.limitValue = limit; return this; },
    populate() { return this; },
    async lean() { return [{ _id: purchaseOrderId }]; },
  };
  const supplierQuery = {
    select() { return this; },
    async lean() { return [{ _id: supplierId }]; },
  };
  const result = await listPurchaseOrders({
    workspaceId,
    page: 2,
    limit: 5,
    status: 'ordered',
    search: 'PO.*',
  }, {
    PurchaseOrderModel: {
      find(filter) { purchaseOrderFilter = filter; return purchaseQuery; },
      async countDocuments(filter) {
        assert.deepEqual(filter, purchaseOrderFilter);
        return 6;
      },
    },
    SupplierModel: {
      find(filter) { supplierFilter = filter; return supplierQuery; },
    },
  });
  assert.equal(supplierFilter.workspaceId, workspaceId);
  assert.equal(purchaseOrderFilter.workspaceId, workspaceId);
  assert.equal(purchaseOrderFilter.status, 'ordered');
  assert.equal(purchaseOrderFilter.$or[0].poNumber.test('PO.*'), true);
  assert.deepEqual(purchaseOrderFilter.$or[1].supplier.$in, [supplierId]);
  assert.equal(purchaseQuery.skipValue, 5);
  assert.equal(purchaseQuery.limitValue, 5);
  assert.deepEqual(result.pagination, { page: 2, limit: 5, totalItems: 6, totalPages: 2 });
});

test('partial and full receipts update stock, order quantities, status, and ledger references', async () => {
  const database = createDatabase();
  const partial = await receivePurchaseOrderItems({
    id: purchaseOrderId,
    workspaceId,
    items: [{ productId, quantity: 2 }],
    idempotencyKey: receiptKey,
    userId,
  }, database);

  assert.equal(partial.purchaseOrder.status, 'partially_received');
  assert.equal(partial.purchaseOrder.items[0].receivedQuantity, 2);
  assert.equal(database.products.get(productId).currentStock, 12);
  assert.equal(partial.movements.length, 1);
  assert.equal(partial.movements[0].movementType, 'stock_in');
  assert.equal(partial.movements[0].reference, 'PO-TEST-001');
  assert.equal(partial.movements[0].quantity, 2);
  assert.equal(partial.movements[0].stockBefore, 10);
  assert.equal(partial.movements[0].stockAfter, 12);

  const full = await receivePurchaseOrderItems({
    id: purchaseOrderId,
    workspaceId,
    items: [
      { productId, quantity: 3 },
      { productId: secondProductId, quantity: 3 },
    ],
    idempotencyKey: 'receipt-operation-456',
    userId,
  }, database);
  assert.equal(full.purchaseOrder.status, 'received');
  assert.equal(full.purchaseOrder.items[0].receivedQuantity, 5);
  assert.equal(full.purchaseOrder.items[1].receivedQuantity, 3);
  assert.equal(database.products.get(productId).currentStock, 15);
  assert.equal(database.products.get(secondProductId).currentStock, 5);
  assert.equal(database.movements.length, 3);
});

test('consecutive partial receipts accumulate quantities before the final receipt', async () => {
  const database = createDatabase({
    items: [{ ...orderItems[0] }],
  });
  const firstPartial = await receivePurchaseOrderItems({
    id: purchaseOrderId,
    workspaceId,
    items: [{ productId, quantity: 2 }],
    idempotencyKey: 'receipt-partial-first',
    userId,
  }, database);
  assert.equal(firstPartial.purchaseOrder.status, 'partially_received');
  assert.equal(firstPartial.purchaseOrder.items[0].receivedQuantity, 2);
  assert.equal(firstPartial.purchaseOrder.items[0].orderedQuantity
    - firstPartial.purchaseOrder.items[0].receivedQuantity, 3);

  const secondPartial = await receivePurchaseOrderItems({
    id: purchaseOrderId,
    workspaceId,
    items: [{ productId, quantity: 1 }],
    idempotencyKey: 'receipt-partial-second',
    userId,
  }, database);
  assert.equal(secondPartial.purchaseOrder.status, 'partially_received');
  assert.equal(secondPartial.purchaseOrder.items[0].receivedQuantity, 3);
  assert.equal(secondPartial.purchaseOrder.items[0].orderedQuantity
    - secondPartial.purchaseOrder.items[0].receivedQuantity, 2);
  assert.equal(database.products.get(productId).currentStock, 13);

  const finalReceipt = await receivePurchaseOrderItems({
    id: purchaseOrderId,
    workspaceId,
    items: [{ productId, quantity: 2 }],
    idempotencyKey: 'receipt-partial-final',
    userId,
  }, database);
  assert.equal(finalReceipt.purchaseOrder.status, 'received');
  assert.equal(finalReceipt.purchaseOrder.items[0].receivedQuantity, 5);
  assert.equal(finalReceipt.purchaseOrder.items[0].orderedQuantity
    - finalReceipt.purchaseOrder.items[0].receivedQuantity, 0);
  assert.equal(database.products.get(productId).currentStock, 15);
  assert.equal(database.movements.length, 3);
});

test('receipts reject over-receiving, invalid states, and cross-workspace products', async () => {
  const database = createDatabase();
  await assert.rejects(receivePurchaseOrderItems({
    id: purchaseOrderId,
    workspaceId,
    items: [{ productId, quantity: 6 }],
    idempotencyKey: receiptKey,
    userId,
  }, database), (error) => error.statusCode === 400);
  assert.equal(database.products.get(productId).currentStock, 10);
  assert.equal(database.movements.length, 0);

  const cancelledDatabase = createDatabase({ status: 'cancelled' });
  await assert.rejects(receivePurchaseOrderItems({
    id: purchaseOrderId,
    workspaceId,
    items: [{ productId, quantity: 1 }],
    idempotencyKey: receiptKey,
    userId,
  }, cancelledDatabase), (error) => error.statusCode === 409);

  const crossWorkspaceDatabase = createDatabase({ productWorkspace: '64b000000000000000000099' });
  await assert.rejects(receivePurchaseOrderItems({
    id: purchaseOrderId,
    workspaceId,
    items: [{ productId, quantity: 1 }],
    idempotencyKey: receiptKey,
    userId,
  }, crossWorkspaceDatabase), (error) => error.statusCode === 404);
  assert.equal(crossWorkspaceDatabase.movements.length, 0);
});

test('receipt rollback leaves stock, ledger, and purchase-order quantities unchanged', async () => {
  for (const database of [
    createDatabase({ movementSaveError: new Error('Ledger write failed') }),
    createDatabase({ purchaseOrderSaveError: new Error('Purchase order write failed') }),
  ]) {
    await assert.rejects(receivePurchaseOrderItems({
      id: purchaseOrderId,
      workspaceId,
      items: [{ productId, quantity: 2 }],
      idempotencyKey: receiptKey,
      userId,
    }, database), /write failed/);
    assert.equal(database.products.get(productId).currentStock, 10);
    assert.equal(database.order.items[0].receivedQuantity, 0);
    assert.equal(database.order.receiptRequests.length, 0);
    assert.equal(database.movements.length, 0);
  }
});

test('receipt idempotency rejects repeated and changed-payload keys without duplicate writes', async () => {
  const database = createDatabase();
  await receivePurchaseOrderItems({
    id: purchaseOrderId,
    workspaceId,
    items: [{ productId, quantity: 2 }],
    idempotencyKey: receiptKey,
    userId,
  }, database);

  for (const receiptItems of [
    [{ productId, quantity: 2 }],
    [{ productId, quantity: 1 }],
  ]) {
    await assert.rejects(receivePurchaseOrderItems({
      id: purchaseOrderId,
      workspaceId,
      items: receiptItems,
      idempotencyKey: receiptKey,
      userId,
    }, database), (error) => error instanceof AppError
      && error.statusCode === 409
      && error.errorCode === 'PURCHASE_ORDER_RECEIPT_KEY_ALREADY_USED');
  }
  assert.equal(database.products.get(productId).currentStock, 12);
  assert.equal(database.order.items[0].receivedQuantity, 2);
  assert.equal(database.movements.length, 1);
});

test('concurrent duplicate receipt attempts process the key only once with serialized transaction mocks', async () => {
  const database = createDatabase();
  let transactionQueue = Promise.resolve();
  const serializedTransaction = (operation) => {
    const result = transactionQueue.then(() => database.transaction(operation));
    transactionQueue = result.then(() => undefined, () => undefined);
    return result;
  };
  const request = {
    id: purchaseOrderId,
    workspaceId,
    items: [{ productId, quantity: 2 }],
    idempotencyKey: receiptKey,
    userId,
  };
  const results = await Promise.allSettled([
    receivePurchaseOrderItems(request, { ...database, transaction: serializedTransaction }),
    receivePurchaseOrderItems(request, { ...database, transaction: serializedTransaction }),
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejection = results.find((result) => result.status === 'rejected');
  assert.equal(rejection.reason.statusCode, 409);
  assert.equal(rejection.reason.errorCode, 'PURCHASE_ORDER_RECEIPT_KEY_ALREADY_USED');
  assert.equal(database.products.get(productId).currentStock, 12);
  assert.equal(database.order.items[0].receivedQuantity, 2);
  assert.equal(database.movements.length, 1);
});

test('purchase orders cannot be cancelled after receipts begin', async () => {
  const database = createDatabase({
    status: 'partially_received',
    items: [{ ...orderItems[0], receivedQuantity: 1 }],
  });
  await assert.rejects(cancelPurchaseOrder({
    id: purchaseOrderId,
    workspaceId,
    userId,
  }, { PurchaseOrderModel: database.PurchaseOrderModel, transaction: database.transaction }), (error) => error.statusCode === 409);
});
