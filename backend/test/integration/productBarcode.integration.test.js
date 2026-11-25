import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import Product from '../../src/models/Product.js';
import Category from '../../src/models/Category.js';
import Supplier from '../../src/models/Supplier.js';
import Workspace from '../../src/models/Workspace.js';
import User from '../../src/models/User.js';
import Sale from '../../src/models/Sale.js';
import StockMovement from '../../src/models/StockMovement.js';
import PurchaseOrder from '../../src/models/PurchaseOrder.js';
import { receiveStock, recordSale } from '../../src/services/inventoryService.js';
import { receivePurchaseOrderItems } from '../../src/services/purchaseOrderService.js';
import { deactivateProduct } from '../../src/services/productService.js';
import { assertDedicatedTestMongoUri, assertTransactionTopology } from '../integrationSafety.js';
import { cleanupOwnedRun, createTestOwnershipTracker } from '../testOwnedCleanup.js';

const testUri = process.env.MONGODB_TEST_URI;
let enabled = true;
let setupError = null;
let workspace;
let owner;
let category;
let supplier;
let transactionProduct;
const integrationRunId = randomUUID();
const owned = createTestOwnershipTracker({ suite: 'integration', runId: integrationRunId });
const testOwnership = { testSuite: 'integration', testRunId: integrationRunId };
const ownedModels = [
  { name: 'Category', Model: Category },
  { name: 'Supplier', Model: Supplier },
  { name: 'Product', Model: Product },
  { name: 'Sale', Model: Sale },
  { name: 'StockMovement', Model: StockMovement },
  { name: 'PurchaseOrder', Model: PurchaseOrder },
];

before(async () => {
  if (!testUri) {
    enabled = false;
    return;
  }
  try {
    assertDedicatedTestMongoUri(testUri);
    await mongoose.connect(testUri, { autoIndex: true, serverSelectionTimeoutMS: 5000 });
    await assertTransactionTopology();
    console.log(`Integration test run identifier: ${integrationRunId}`);
  } catch (error) {
    enabled = false;
    setupError = error;
  }
});

after(async () => {
  if (mongoose.connection.readyState !== 0) {
    try {
      await cleanupOwnedRun({
        suite: 'integration',
        runId: integrationRunId,
        Workspace,
        User,
        records: ownedModels,
      });
    } finally {
      await mongoose.disconnect();
    }
  }
});

test('dedicated MongoDB integration suite', { skip: !!setupError }, async (t) => {
  if (!enabled) {
    t.skip('MONGODB_TEST_URI is not configured; no database was accessed.');
    return;
  }

  await t.test('creates one workspace and required records', async () => {
    owner = await User.create({
      name: 'AHS Integration Owner',
      email: `integration-owner-${Date.now()}@ahs-test.invalid`,
      password: 'TestPassword-12!',
      role: 'admin',
      testSuite: 'integration',
      testRunId: integrationRunId,
    });
    owned.registerUser(owner._id);
    workspace = await Workspace.create({
      name: 'AHS INTEGRATION TEST',
      owner: owner._id,
      members: [owner._id],
      systemKey: `ahs:test:integration:${integrationRunId}:primary`,
      testSuite: 'integration',
      testRunId: integrationRunId,
    });
    owned.registerWorkspace(workspace._id);
    await User.updateOne(
      { _id: owner._id },
      { $set: { testWorkspaceId: workspace._id } },
    );
    category = await Category.create({ workspaceId: workspace._id, name: 'Test Category', code: `CAT-${Date.now()}`, createdBy: owner._id, ...testOwnership });
    owned.registerRecord(category._id);
    supplier = await Supplier.create({ workspaceId: workspace._id, name: 'Test Supplier', supplierCode: `SUP-${Date.now()}`, createdBy: owner._id, ...testOwnership });
    owned.registerRecord(supplier._id);
  });

  await t.test('stock receipt, sale, insufficient stock, and idempotency stay consistent', async () => {
    transactionProduct = await Product.create({
      workspaceId: workspace._id,
      productName: 'Test Transaction Part',
      sku: `TEST-TRANSACTION-${Date.now()}`,
      barcode: `TEST-BC-TRANSACTION-${Date.now()}`,
      category: category._id,
      supplier: supplier._id,
      currentStock: 0,
      minimumStock: 2,
      createdBy: owner._id,
      ...testOwnership,
    });
    owned.registerRecord(transactionProduct._id);

    const receipt = await receiveStock({
      workspaceId: workspace._id,
      productId: transactionProduct._id,
      quantity: 5,
      reference: 'INTEGRATION-STOCK-IN',
      userId: owner._id,
      idempotencyKey: `stock-in-${Date.now()}`,
    }, { testOwnership });
    owned.registerRecord(receipt.movement._id);
    assert.equal(receipt.product.currentStock, 5);
    assert.equal(receipt.movement.stockBefore, 0);
    assert.equal(receipt.movement.stockAfter, 5);

    const sale = await recordSale({
      workspaceId: workspace._id,
      productId: transactionProduct._id,
      quantity: 2,
      unitPrice: 1250,
      customerName: 'Synthetic Integration Customer',
      userId: owner._id,
      idempotencyKey: `sale-${Date.now()}`,
    }, { testOwnership });
    owned.registerRecord(sale.sale._id);
    owned.registerRecord(sale.movement._id);
    assert.equal(sale.product.currentStock, 3);
    assert.equal(sale.movement.stockBefore, 5);
    assert.equal(sale.movement.stockAfter, 3);

    await assert.rejects(
      recordSale({
        workspaceId: workspace._id,
        productId: transactionProduct._id,
        quantity: 4,
        unitPrice: 1250,
        customerName: 'Synthetic Insufficient Stock',
        userId: owner._id,
        idempotencyKey: `insufficient-${Date.now()}`,
      }, { testOwnership }),
      /Not enough stock/,
    );

    await assert.rejects(
      recordSale({
        workspaceId: workspace._id,
        productId: transactionProduct._id,
        quantity: 1,
        unitPrice: 1250,
        customerName: 'Synthetic Duplicate Sale',
        userId: owner._id,
        idempotencyKey: sale.sale.idempotencyKey,
      }, { testOwnership }),
      (error) => error?.statusCode === 409,
    );
  });

  await t.test('purchase receipt partial/full status and duplicate receipt prevention', async () => {
    const po = await PurchaseOrder.create({
      workspaceId: workspace._id,
      poNumber: `TEST-PO-INT-${Date.now()}`,
      supplier: supplier._id,
      items: [{ product: transactionProduct._id, orderedQuantity: 5, receivedQuantity: 0, unitCost: 1000, lineTotal: 5000 }],
      subtotal: 5000,
      totalAmount: 5000,
      status: 'ordered',
      createdBy: owner._id,
      updatedBy: owner._id,
      ...testOwnership,
    });
    owned.registerRecord(po._id);

    const partialKey = `receipt-${Date.now()}`;
    const partial = await receivePurchaseOrderItems({
      id: po._id,
      workspaceId: workspace._id,
      items: [{ productId: transactionProduct._id.toString(), quantity: 2 }],
      idempotencyKey: partialKey,
      userId: owner._id,
    }, { testOwnership });
    partial.movements.forEach((movement) => owned.registerRecord(movement._id));
    assert.equal(partial.purchaseOrder.status, 'partially_received');

    await assert.rejects(
      receivePurchaseOrderItems({
        id: po._id,
        workspaceId: workspace._id,
        items: [{ productId: transactionProduct._id.toString(), quantity: 2 }],
        idempotencyKey: partialKey,
        userId: owner._id,
      }, { testOwnership }),
      (error) => error?.statusCode === 409,
    );

    const complete = await receivePurchaseOrderItems({
      id: po._id,
      workspaceId: workspace._id,
      items: [{ productId: transactionProduct._id.toString(), quantity: 3 }],
      idempotencyKey: `receipt-full-${Date.now()}`,
      userId: owner._id,
    }, { testOwnership });
    complete.movements.forEach((movement) => owned.registerRecord(movement._id));
    assert.equal(complete.purchaseOrder.status, 'received');
  });

  await t.test('product deactivation respects outstanding purchase orders', async () => {
    const guardProduct = await Product.create({
      workspaceId: workspace._id,
      productName: 'Test Deactivation Guard',
      sku: `TEST-DEACT-${Date.now()}`,
      category: category._id,
      supplier: supplier._id,
      createdBy: owner._id,
      ...testOwnership,
    });
    owned.registerRecord(guardProduct._id);
    const guardOrder = await PurchaseOrder.create({
      workspaceId: workspace._id,
      poNumber: `TEST-PO-GUARD-${Date.now()}`,
      supplier: supplier._id,
      items: [{ product: guardProduct._id, orderedQuantity: 4, receivedQuantity: 0, unitCost: 500, lineTotal: 2000 }],
      subtotal: 2000,
      totalAmount: 2000,
      status: 'ordered',
      createdBy: owner._id,
      updatedBy: owner._id,
      ...testOwnership,
    });
    owned.registerRecord(guardOrder._id);

    await assert.rejects(
      deactivateProduct({ productId: guardProduct._id, workspaceId: workspace._id, userId: owner._id }),
      (error) => error?.statusCode === 409,
    );

    const plainProduct = await Product.create({
      workspaceId: workspace._id,
      productName: 'Test Deactivation Allowed',
      sku: `TEST-DEACT-OK-${Date.now()}`,
      category: category._id,
      supplier: supplier._id,
      createdBy: owner._id,
      ...testOwnership,
    });
    owned.registerRecord(plainProduct._id);
    const deactivated = await deactivateProduct({ productId: plainProduct._id, workspaceId: workspace._id, userId: owner._id });
    assert.equal(deactivated.isActive, false);
  });

  await t.test('enforces workspace-scoped barcode uniqueness and permits barcode-less products', async () => {
    await Product.init();
    const prefix = `TEST-${Date.now()}`;
    const first = await Product.create({
      workspaceId: workspace._id, productName: 'Test Part One', sku: `${prefix}-1`,
      barcode: ' 987654321  ', category: category._id, supplier: supplier._id, createdBy: owner._id,
      ...testOwnership,
    });
    owned.registerRecord(first._id);
    assert.equal(first.barcode, '987654321');

    const barcodeLessOne = await Product.create({
      workspaceId: workspace._id, productName: 'Test No Barcode One', sku: `${prefix}-2`,
      category: category._id, supplier: supplier._id, createdBy: owner._id, ...testOwnership,
    });
    owned.registerRecord(barcodeLessOne._id);
    const barcodeLessTwo = await Product.create({
      workspaceId: workspace._id, productName: 'Test No Barcode Two', sku: `${prefix}-3`,
      category: category._id, supplier: supplier._id, createdBy: owner._id, ...testOwnership,
    });
    owned.registerRecord(barcodeLessTwo._id);

    await assert.rejects(
      Product.create({ workspaceId: workspace._id, productName: 'Test Duplicate Barcode', sku: `${prefix}-4`, barcode: '987654321', category: category._id, supplier: supplier._id, createdBy: owner._id, ...testOwnership }),
      (error) => error?.code === 11000,
    );
  });

  await t.test('valid barcode uniqueness is workspace scoped', async () => {
    const prefix = `TEST-${Date.now()}`;
    const first = await Product.create({
      workspaceId: workspace._id, productName: 'Test Shared Barcode', sku: `${prefix}-A`,
      barcode: `${prefix}-BARCODE`, category: category._id, supplier: supplier._id, createdBy: owner._id,
      ...testOwnership,
    });
    owned.registerRecord(first._id);

    const secondOwner = await User.create({
      name: 'AHS Integration Second Owner',
      email: `integration-second-${Date.now()}@ahs-test.invalid`,
      password: 'TestPassword-12!',
      role: 'admin',
      testSuite: 'integration',
      testRunId: integrationRunId,
    });
    owned.registerUser(secondOwner._id);
    const secondWorkspace = await Workspace.create({
      name: 'AHS INTEGRATION TEST TWO',
      owner: secondOwner._id,
      members: [secondOwner._id],
      systemKey: `ahs:test:integration:${integrationRunId}:secondary`,
      testSuite: 'integration',
      testRunId: integrationRunId,
    });
    owned.registerWorkspace(secondWorkspace._id);
    await User.updateOne(
      { _id: secondOwner._id },
      { $set: { testWorkspaceId: secondWorkspace._id } },
    );
    const secondCategory = await Category.create({ workspaceId: secondWorkspace._id, name: 'Second Test Category', code: `CAT2-${Date.now()}`, createdBy: secondOwner._id, ...testOwnership });
    owned.registerRecord(secondCategory._id);
    const secondSupplier = await Supplier.create({ workspaceId: secondWorkspace._id, name: 'Second Test Supplier', supplierCode: `SUP2-${Date.now()}`, createdBy: secondOwner._id, ...testOwnership });
    owned.registerRecord(secondSupplier._id);

    const secondProduct = await Product.create({
      workspaceId: secondWorkspace._id, productName: 'Test Shared Barcode Other Workspace', sku: `${prefix}-B`,
      barcode: first.barcode, category: secondCategory._id, supplier: secondSupplier._id, createdBy: secondOwner._id, ...testOwnership,
    });
    owned.registerRecord(secondProduct._id);

  });
});
