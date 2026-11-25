import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { test } from 'node:test';
import Product from '../models/Product.js';
import StockMovement from '../models/StockMovement.js';
import AppError from '../utils/AppError.js';
import { getStockMovementsPage } from './stockMovementService.js';
import {
  adjustStock,
  createProductWithOpeningStock,
  receiveStock,
  recordSale,
  runInventoryTransaction,
  setProductStock,
} from './inventoryService.js';

process.env.PORT = '5000';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/ai_inventory_test';
process.env.JWT_SECRET = 'security-test-secret-that-is-long-enough';
process.env.JWT_EXPIRES_IN = '1d';
process.env.CLIENT_URL = 'http://localhost:5173';

const session = { id: 'test-session' };

const createDatabase = ({
  initialStock = 5,
  secondInitialStock = 5,
  productWorkspaceId = 'workspace-1',
  movementSaveError = null,
} = {}) => {
  const product = {
    _id: 'product-1',
    workspaceId: productWorkspaceId,
    currentStock: initialStock,
    isActive: true,
    save: async () => product,
  };
  const secondProduct = {
    _id: 'product-2',
    workspaceId: productWorkspaceId,
    currentStock: secondInitialStock,
    isActive: true,
    save: async () => secondProduct,
  };
  const products = new Map([[product._id, product], [secondProduct._id, secondProduct]]);
  const movements = [];
  const sales = [];

  const ProductModel = {
    findOne(filter) {
      return {
        session: async (usedSession) => {
          assert.equal(usedSession, session);
          const found = products.get(filter._id);
          return found
            && filter.workspaceId === productWorkspaceId
            && filter.isActive === true
            ? found
            : null;
        },
      };
    },
    async findOneAndUpdate(filter, update, options) {
      assert.equal(options.session, session);
      const found = products.get(filter._id);
      if (!found || filter.workspaceId !== productWorkspaceId
        || filter.currentStock !== found.currentStock) return null;
      found.currentStock += update.$inc.currentStock;
      Object.assign(found, update.$set);
      return found;
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

  class SaleModel {
    constructor(data) {
      Object.assign(this, data, { _id: `sale-${sales.length + 1}` });
    }

    async save(options) {
      assert.equal(options.session, session);
      sales.push(this);
      return this;
    }

    static findOne(filter) {
      return {
        session: async (usedSession) => {
          assert.equal(usedSession, session);
          return sales.find((sale) => (
            sale.workspaceId === filter.workspaceId && sale.idempotencyKey === filter.idempotencyKey
          )) || null;
        },
      };
    }
  }

  const transaction = async (operation) => {
    const stockBeforeTransaction = new Map([...products].map(([id, entry]) => [id, entry.currentStock]));
    const updatedByBeforeTransaction = new Map([...products].map(([id, entry]) => [id, entry.updatedBy]));
    const saleCount = sales.length;
    const movementCount = movements.length;
    try {
      return await operation(session);
    } catch (error) {
      for (const [id, quantity] of stockBeforeTransaction) products.get(id).currentStock = quantity;
      for (const [id, updatedBy] of updatedByBeforeTransaction) {
        if (updatedBy === undefined) delete products.get(id).updatedBy;
        else products.get(id).updatedBy = updatedBy;
      }
      sales.length = saleCount;
      movements.length = movementCount;
      throw error;
    }
  };

  return { product, secondProduct, products, movements, sales, ProductModel, MovementModel, SaleModel, transaction };
};

const userId = 'user-1';
const workspaceId = 'workspace-1';
const idempotencyKey = 'stock-operation-123';

test('stock-in updates workspace product and records before/after movement', async () => {
  const database = createDatabase();
  const result = await receiveStock({
    workspaceId,
    productId: 'product-1',
    quantity: 3,
    reference: 'RCV-42',
    reason: 'Supplier delivery',
    userId,
    idempotencyKey,
  }, database);

  assert.equal(result.product.currentStock, 8);
  assert.equal(result.movement.movementType, 'stock_in');
  assert.equal(result.movement.quantity, 3);
  assert.equal(result.movement.stockBefore, 5);
  assert.equal(result.movement.stockAfter, 8);
  assert.equal(result.movement.reference, 'RCV-42');
  assert.equal(result.movement.workspaceId, workspaceId);
  assert.equal(result.movement.performedBy, userId);
  assert.equal(database.movements.length, 1);
});

test('zero or invalid stock-in quantity is rejected before a transaction starts', async () => {
  const database = createDatabase();
  let transactionCalls = 0;
  const transaction = async (operation) => {
    transactionCalls += 1;
    return database.transaction(operation);
  };

  await assert.rejects(receiveStock({
    workspaceId, productId: 'product-1', quantity: 0, userId, idempotencyKey,
  }, { ...database, transaction }), (error) => error.statusCode === 400);
  await assert.rejects(receiveStock({
    workspaceId, productId: 'product-1', quantity: 'not-a-number', userId, idempotencyKey,
  }, { ...database, transaction }), (error) => error.statusCode === 400);
  assert.equal(transactionCalls, 0);
});

test('stock-in rejects missing and cross-workspace products', async () => {
  const database = createDatabase({ productWorkspaceId: 'another-workspace' });
  await assert.rejects(receiveStock({
    workspaceId,
    productId: 'product-1',
    quantity: 2,
    userId,
    idempotencyKey,
  }, database), (error) => error.statusCode === 404);
  assert.equal(database.movements.length, 0);
});

test('sales create a sale movement atomically with the stock reduction', async () => {
  const database = createDatabase({ initialStock: 7 });
  const result = await recordSale({
    workspaceId,
    productId: 'product-1',
    quantity: 2,
    unitPrice: 20,
    customerName: 'Customer',
    userId,
    idempotencyKey,
  }, database);

  assert.equal(result.product.currentStock, 5);
  assert.equal(result.sale.totalAmount, 40);
  assert.equal(result.movement.movementType, 'sale');
  assert.equal(result.movement.quantity, 2);
  assert.equal(result.movement.stockBefore, 7);
  assert.equal(result.movement.stockAfter, 5);
  assert.equal(result.movement.sale, result.sale._id);
  assert.equal(result.sale.idempotencyKey, idempotencyKey);
  assert.equal(result.movement.idempotencyKey, idempotencyKey);
  assert.equal(database.sales.length, 1);
  assert.equal(database.movements.length, 1);
});

test('multi-line invoices record all sale lines and matching stock movements atomically', async () => {
  const database = createDatabase({ initialStock: 7, secondInitialStock: 4 });
  const result = await recordSale({
    workspaceId,
    items: [
      { productId: 'product-1', quantity: 2, unitPrice: 20 },
      { productId: 'product-2', quantity: 3, unitPrice: 15 },
    ],
    customerName: 'Customer',
    userId,
    idempotencyKey: 'invoice-operation-123',
  }, database);

  assert.equal(result.invoiceTotal, 85);
  assert.equal(result.sales.length, 2);
  assert.equal(result.movements.length, 2);
  assert.equal(result.sales[0].invoiceNumber, result.sales[1].invoiceNumber);
  assert.ok(result.sales.every((sale) => sale.invoiceTotal === 85));
  assert.equal(database.products.get('product-1').currentStock, 5);
  assert.equal(database.products.get('product-2').currentStock, 1);
  assert.equal(database.movements[0].sale, database.sales[0]._id);
  assert.equal(database.movements[1].sale, database.sales[1]._id);
});

test('invoice discounts and tax are allocated to lines and reconcile to the invoice total', async () => {
  const database = createDatabase({ initialStock: 7, secondInitialStock: 4 });
  const result = await recordSale({
    workspaceId,
    items: [
      { productId: 'product-1', quantity: 2, unitPrice: 20 },
      { productId: 'product-2', quantity: 3, unitPrice: 15 },
    ],
    customerName: 'Customer',
    discountAmount: 5,
    taxRate: 18,
    userId,
    idempotencyKey: 'invoice-tax-discount-123',
  }, database);

  assert.equal(result.invoiceTotal, 94.4);
  assert.equal(result.sales.reduce((sum, sale) => sum + sale.subtotal, 0), 85);
  assert.equal(result.sales.reduce((sum, sale) => sum + sale.discountAmount, 0), 5);
  assert.equal(Math.round(result.sales.reduce((sum, sale) => sum + sale.taxAmount, 0) * 100) / 100, 14.4);
  assert.equal(Math.round(result.sales.reduce((sum, sale) => sum + sale.totalAmount, 0) * 100) / 100, 94.4);
  assert.ok(result.sales.every((sale) => sale.invoiceTotal === 94.4));
});

test('invoice discounts cannot exceed subtotal and tax rate cannot exceed 100 percent', async () => {
  const database = createDatabase();
  const saleRequest = {
    workspaceId,
    productId: 'product-1',
    quantity: 1,
    unitPrice: 20,
    customerName: 'Customer',
    userId,
    idempotencyKey,
  };

  await assert.rejects(recordSale({ ...saleRequest, discountAmount: 21 }, database), (error) => error.statusCode === 400);
  await assert.rejects(recordSale({ ...saleRequest, taxRate: 101 }, database), (error) => error.statusCode === 400);
  assert.equal(database.product.currentStock, 5);
  assert.equal(database.sales.length, 0);
  assert.equal(database.movements.length, 0);
});

test('sales reject missing, blank, malformed, too-short, and oversized idempotency keys', async () => {
  const database = createDatabase();
  let transactionCalls = 0;
  const transaction = async (operation) => {
    transactionCalls += 1;
    return database.transaction(operation);
  };
  const invalidKeys = [undefined, '', '       ', 'short', 'bad key', 'x'.repeat(129)];

  for (const invalidKey of invalidKeys) {
    await assert.rejects(recordSale({
      workspaceId,
      productId: 'product-1',
      quantity: 1,
      unitPrice: 20,
      customerName: 'Customer',
      userId,
      idempotencyKey: invalidKey,
    }, { ...database, transaction }), (error) => error.statusCode === 400);
  }

  assert.equal(transactionCalls, 0);
  assert.equal(database.product.currentStock, 5);
  assert.equal(database.sales.length, 0);
  assert.equal(database.movements.length, 0);
});

test('sales cannot reduce stock below zero', async () => {
  const database = createDatabase({ initialStock: 1 });
  await assert.rejects(recordSale({
    workspaceId,
    productId: 'product-1',
    quantity: 2,
    unitPrice: 20,
    customerName: 'Customer',
    userId,
    idempotencyKey,
  }, database), (error) => error.statusCode === 400);
  assert.equal(database.product.currentStock, 1);
  assert.equal(database.sales.length, 0);
  assert.equal(database.movements.length, 0);
});

test('a failed ledger write rolls back the associated sale and stock update', async () => {
  const database = createDatabase({
    initialStock: 7,
    movementSaveError: new Error('Ledger write failed'),
  });
  await assert.rejects(recordSale({
    workspaceId,
    productId: 'product-1',
    quantity: 2,
    unitPrice: 20,
    customerName: 'Customer',
    userId,
    idempotencyKey,
  }, database), /Ledger write failed/);
  assert.equal(database.product.currentStock, 7);
  assert.equal(database.sales.length, 0);
  assert.equal(database.movements.length, 0);
});

test('adjustments record positive quantities and the resulting stock levels', async () => {
  const database = createDatabase({ initialStock: 5 });
  const result = await adjustStock({
    workspaceId,
    productId: 'product-1',
    quantity: 2,
    direction: 'decrease',
    reason: 'Damaged parts',
    userId,
    idempotencyKey,
  }, database);

  assert.equal(result.product.currentStock, 3);
  assert.equal(result.movement.movementType, 'adjustment');
  assert.equal(result.movement.quantity, 2);
  assert.equal(result.movement.stockBefore, 5);
  assert.equal(result.movement.stockAfter, 3);
});

test('stock adjustments cannot reduce inventory below zero', async () => {
  const database = createDatabase({ initialStock: 1 });
  await assert.rejects(adjustStock({
    workspaceId,
    productId: 'product-1',
    quantity: 2,
    direction: 'decrease',
    userId,
    idempotencyKey,
  }, database), (error) => error.statusCode === 400);
  assert.equal(database.product.currentStock, 1);
  assert.equal(database.movements.length, 0);
});

test('product edit stock adjustments are recorded in the same transaction', async () => {
  const database = createDatabase({ initialStock: 5 });
  const result = await setProductStock({
    workspaceId,
    productId: 'product-1',
    stockAfter: 8,
    changes: { productName: 'Updated part' },
    reason: 'Count correction',
    userId,
  }, database);

  assert.equal(result.product.currentStock, 8);
  assert.equal(result.product.productName, 'Updated part');
  assert.equal(result.movement.movementType, 'adjustment');
  assert.equal(result.movement.quantity, 3);
  assert.equal(result.movement.stockBefore, 5);
  assert.equal(result.movement.stockAfter, 8);
});

test('product stock edits unset a cleared barcode in the same transaction', async () => {
  const product = Product.hydrate({
    _id: new mongoose.Types.ObjectId(),
    workspaceId: new mongoose.Types.ObjectId(),
    productName: 'Part with barcode',
    sku: 'PART-CLEAR-BARCODE',
    category: new mongoose.Types.ObjectId(),
    supplier: new mongoose.Types.ObjectId(),
    currentStock: 5,
    minimumStock: 1,
    barcode: '0123-XYZ',
  });
  let savedChanges;
  product.save = async ({ session: usedSession }) => {
    assert.equal(usedSession, session);
    savedChanges = product.getChanges();
    return product;
  };
  const ProductModel = {
    findOne() {
      return { session: async () => product };
    },
  };
  class MovementModel {
    constructor(data) {
      Object.assign(this, data);
    }

    async save({ session: usedSession }) {
      assert.equal(usedSession, session);
      return this;
    }
  }

  await setProductStock({
    workspaceId: product.workspaceId,
    productId: product._id,
    stockAfter: 6,
    changes: { productName: 'Updated part' },
    clearBarcode: true,
    userId: new mongoose.Types.ObjectId(),
  }, {
    ProductModel,
    MovementModel,
    transaction: async (operation) => operation(session),
  });

  assert.equal(product.barcode, undefined);
  assert.deepEqual(savedChanges.$unset, { barcode: 1 });
});

test('product stock edits preserve normalized valid barcodes', async () => {
  const product = Product.hydrate({
    _id: new mongoose.Types.ObjectId(),
    workspaceId: new mongoose.Types.ObjectId(),
    productName: 'Part with barcode',
    sku: 'PART-KEEP-BARCODE',
    category: new mongoose.Types.ObjectId(),
    supplier: new mongoose.Types.ObjectId(),
    currentStock: 5,
    minimumStock: 1,
    barcode: '0123-XYZ',
  });
  let savedChanges;
  product.save = async ({ session: usedSession }) => {
    assert.equal(usedSession, session);
    savedChanges = product.getChanges();
    return product;
  };
  const ProductModel = {
    findOne() {
      return { session: async () => product };
    },
  };
  class MovementModel {
    constructor(data) {
      Object.assign(this, data);
    }

    async save({ session: usedSession }) {
      assert.equal(usedSession, session);
      return this;
    }
  }

  await setProductStock({
    workspaceId: product.workspaceId,
    productId: product._id,
    stockAfter: 6,
    changes: { barcode: '  9876-ABC  ' },
    userId: new mongoose.Types.ObjectId(),
  }, {
    ProductModel,
    MovementModel,
    transaction: async (operation) => operation(session),
  });

  assert.equal(product.barcode, '9876-ABC');
  assert.equal(savedChanges.$set.barcode, '9876-ABC');
});

test('creating a product with opening stock creates its opening movement transactionally', async () => {
  const database = createDatabase();
  class NewProductModel {
    constructor(data) {
      Object.assign(this, data, { _id: 'new-product' });
    }

    async save(options) {
      assert.equal(options.session, session);
      return this;
    }
  }

  const result = await createProductWithOpeningStock({
    workspaceId,
    currentStock: 4,
    createdBy: userId,
  }, {
    ProductModel: NewProductModel,
    MovementModel: database.MovementModel,
    transaction: database.transaction,
  });

  assert.equal(result.movement.movementType, 'stock_in');
  assert.equal(result.movement.quantity, 4);
  assert.equal(result.movement.stockBefore, 0);
  assert.equal(result.movement.stockAfter, 4);
  assert.equal(result.movement.performedBy, userId);
});

test('repeated idempotency keys are rejected and failed writes roll back', async () => {
  const duplicateError = Object.assign(new Error('duplicate key'), { code: 11000 });
  const database = createDatabase({ movementSaveError: duplicateError });
  await assert.rejects(receiveStock({
    workspaceId, productId: 'product-1', quantity: 2, userId, idempotencyKey,
  }, database), (error) => error instanceof AppError && error.statusCode === 409);
  assert.equal(database.product.currentStock, 5);
  assert.equal(database.movements.length, 0);
});

test('a repeated sale idempotency key is rejected before stock changes', async () => {
  const database = createDatabase();
  database.sales.push({ workspaceId, idempotencyKey, _id: 'existing-sale' });
  await assert.rejects(recordSale({
    workspaceId,
    productId: 'product-1',
    quantity: 1,
    unitPrice: 20,
    customerName: 'Customer',
    userId,
    idempotencyKey,
  }, database), (error) => error.statusCode === 409
    && error.errorCode === 'IDEMPOTENCY_KEY_ALREADY_USED');
  assert.equal(database.product.currentStock, 5);
  assert.equal(database.movements.length, 0);
  assert.equal(database.sales.length, 1);
});

test('a duplicate-key race aborts sale, stock, and movement writes with a stable conflict code', async () => {
  const duplicateError = Object.assign(new Error('duplicate key'), { code: 11000 });
  const database = createDatabase({ movementSaveError: duplicateError });
  await assert.rejects(recordSale({
    workspaceId,
    productId: 'product-1',
    quantity: 1,
    unitPrice: 20,
    customerName: 'Customer',
    userId,
    idempotencyKey,
  }, database), (error) => error.statusCode === 409
    && error.errorCode === 'IDEMPOTENCY_KEY_ALREADY_USED');
  assert.equal(database.product.currentStock, 5);
  assert.equal(database.sales.length, 0);
  assert.equal(database.movements.length, 0);
});

test('standalone MongoDB transaction errors fail with an explicit safe message', async () => {
  let operationCalled = false;
  const error = Object.assign(
    new Error('Transaction numbers are only allowed on a replica set member or mongos'),
    { code: 20 },
  );
  const fakeSession = {
    async withTransaction() {
      throw error;
    },
    async endSession() {},
  };

  await assert.rejects(
    runInventoryTransaction(async () => {
      operationCalled = true;
    }, { mongooseInstance: { startSession: async () => fakeSession } }),
    (caught) => caught.statusCode === 503 && /replica sets or sharded clusters/.test(caught.message),
  );
  assert.equal(operationCalled, false);
});

test('movement ledger fields are immutable and the route exposes no update/delete methods', async () => {
  for (const field of ['workspaceId', 'product', 'movementType', 'quantity', 'stockBefore', 'stockAfter', 'performedBy']) {
    assert.equal(StockMovement.schema.path(field).options.immutable, true, `${field} must be immutable`);
  }
  assert.equal(StockMovement.schema.indexes().some(([keys, options]) => keys.idempotencyKey && options.unique), true);
  const { default: router } = await import('../routes/stockMovementRoutes.js');
  const routes = router.stack.filter((layer) => layer.route).map((layer) => layer.route);
  assert.deepEqual(routes.map((route) => Object.keys(route.methods).filter((method) => route.methods[method])).flat().sort(), ['get', 'post', 'post']);

  const stockInRoute = routes.find((route) => route.path === '/stock-in');
  const error = await new Promise((resolve) => {
    stockInRoute.stack[0].handle({ user: { role: 'viewer' } }, {}, resolve);
  });
  assert.equal(error.statusCode, 403);
  assert.equal(await new Promise((resolve) => {
    stockInRoute.stack[0].handle({ user: { role: 'manager' } }, {}, resolve);
  }), undefined);
});

test('movement listing and product search stay scoped to the requested workspace', async () => {
  const workspaceFilter = { workspaceId: 'workspace-1' };
  let movementFilter;
  let countFilter;
  let productFilter;
  let aggregateFilter;
  const MovementModel = {
    find(filter) {
      movementFilter = filter;
      return {
        sort() { return this; },
        skip() { return this; },
        limit() { return this; },
        populate() { return this; },
        async lean() { return []; },
      };
    },
    async countDocuments(filter) {
      countFilter = filter;
      return 0;
    },
    async aggregate(pipeline) {
      aggregateFilter = pipeline[0].$match;
      return [];
    },
  };
  const ProductModel = {
    find(filter) {
      productFilter = filter;
      return {
        select() { return this; },
        async lean() { return [{ _id: 'product-1' }]; },
      };
    },
  };

  await getStockMovementsPage({
    workspaceId: workspaceFilter.workspaceId,
    page: 2,
    limit: 5,
    search: 'filter',
  }, { MovementModel, ProductModel });

  assert.equal(productFilter.workspaceId, workspaceFilter.workspaceId);
  assert.deepEqual(movementFilter, countFilter);
  assert.deepEqual(aggregateFilter, workspaceFilter);
  assert.equal(movementFilter.workspaceId, workspaceFilter.workspaceId);
  assert.deepEqual(movementFilter.$or[2].product.$in, ['product-1']);
});
