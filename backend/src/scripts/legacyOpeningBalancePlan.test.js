import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLegacyOpeningBalancePlan } from './legacyOpeningBalancePlan.js';

test('legacy opening plan fills missing initial stock and preserves later adjustments', () => {
  const products = [
    { _id: 'product-a', sku: 'YAM-A', productName: 'Part A', currentStock: 12, createdAt: new Date('2026-08-01T00:00:00Z') },
    { _id: 'product-b', sku: 'YAM-B', productName: 'Part B', currentStock: 23, createdAt: new Date('2026-08-01T00:00:00Z') },
    { _id: 'product-c', sku: 'YAM-C', productName: 'Part C', currentStock: 5, createdAt: new Date('2026-08-01T00:00:00Z') },
  ];
  const movementsByProduct = new Map([
    ['product-a', []],
    ['product-b', [{
      movementType: 'adjustment',
      quantity: 1,
      stockBefore: 22,
      stockAfter: 23,
      createdAt: new Date('2026-11-18T00:00:00Z'),
    }]],
    ['product-c', [{
      movementType: 'stock_in',
      quantity: 5,
      stockBefore: 0,
      stockAfter: 5,
      createdAt: new Date('2026-08-02T00:00:00Z'),
    }]],
  ]);

  const plan = buildLegacyOpeningBalancePlan({ products, movementsByProduct });

  assert.equal(plan.errors.length, 0);
  assert.deepEqual(plan.openingMovements.map(({ sku, quantity }) => ({ sku, quantity })), [
    { sku: 'YAM-A', quantity: 12 },
    { sku: 'YAM-B', quantity: 22 },
  ]);
  assert.ok(plan.openingMovements[1].occurredAt < movementsByProduct.get('product-b')[0].createdAt);
});

test('legacy opening plan refuses inconsistent movement chains', () => {
  const plan = buildLegacyOpeningBalancePlan({
    products: [{
      _id: 'product-a',
      sku: 'YAM-A',
      productName: 'Part A',
      currentStock: 3,
      createdAt: new Date('2026-08-01T00:00:00Z'),
    }],
    movementsByProduct: new Map([['product-a', [{
      movementType: 'sale',
      quantity: 4,
      stockBefore: 3,
      stockAfter: 0,
      createdAt: new Date('2026-08-02T00:00:00Z'),
    }]]]),
  });

  assert.ok(plan.errors.some((error) => error.includes('invalid sale movement')));
});
