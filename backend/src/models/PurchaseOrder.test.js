import assert from 'node:assert/strict';
import { test } from 'node:test';
import PurchaseOrder from './PurchaseOrder.js';

const workspaceId = '64b000000000000000000010';
const supplierId = '64b000000000000000000020';
const productId = '64b000000000000000000030';
const userId = '64b000000000000000000050';

const makePurchaseOrder = (overrides = {}) => new PurchaseOrder({
  workspaceId,
  poNumber: 'PO-TEST-001',
  supplier: supplierId,
  orderDate: new Date('2026-01-01T00:00:00.000Z'),
  items: [{
    product: productId,
    orderedQuantity: 4,
    receivedQuantity: 0,
    unitCost: 2.5,
    lineTotal: 10,
  }],
  subtotal: 10,
  totalAmount: 10,
  status: 'draft',
  createdBy: userId,
  updatedBy: userId,
  ...overrides,
});

test('purchase order schema accepts valid totals and quantities without a database connection', async () => {
  await assert.doesNotReject(makePurchaseOrder().validate());
});

test('purchase order schema rejects over-received quantities and inconsistent status totals', async () => {
  await assert.rejects(makePurchaseOrder({
    items: [{
      product: productId,
      orderedQuantity: 4,
      receivedQuantity: 5,
      unitCost: 2.5,
      lineTotal: 10,
    }],
    status: 'partially_received',
  }).validate());

  await assert.rejects(makePurchaseOrder({
    status: 'partially_received',
  }).validate());
});

test('purchase order schema rejects duplicate products and inconsistent line totals', async () => {
  await assert.rejects(makePurchaseOrder({
    items: [
      { product: productId, orderedQuantity: 1, receivedQuantity: 0, unitCost: 2, lineTotal: 2 },
      { product: productId, orderedQuantity: 1, receivedQuantity: 0, unitCost: 2, lineTotal: 2 },
    ],
    subtotal: 4,
    totalAmount: 4,
  }).validate());

  await assert.rejects(makePurchaseOrder({
    items: [{
      product: productId,
      orderedQuantity: 4,
      receivedQuantity: 0,
      unitCost: 2.5,
      lineTotal: 9,
    }],
  }).validate());
});
