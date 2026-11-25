import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { test } from 'node:test';
import Product from './Product.js';
import { normalizeProductUpdateFields } from '../utils/productBarcode.js';

test('existing products can omit optional Yamaha fitment and barcode details', () => {
  const product = new Product({
    workspaceId: new mongoose.Types.ObjectId(),
    productName: 'Existing part',
    sku: 'PART-001',
    category: new mongoose.Types.ObjectId(),
    supplier: new mongoose.Types.ObjectId(),
  });

  assert.equal(product.validateSync(), undefined);
  assert.equal(product.manufacturer, undefined);
  assert.equal(product.compatibleModels, undefined);
  assert.equal(product.barcode, undefined);
  assert.equal(product.oemPartNumber, undefined);
});

test('OEM part numbers are trimmed and blank values do not become indexed identifiers', async () => {
  const workspaceId = new mongoose.Types.ObjectId();
  const create = (sku, oemPartNumber) => new Product({
    workspaceId,
    productName: 'Part',
    sku,
    category: new mongoose.Types.ObjectId(),
    supplier: new mongoose.Types.ObjectId(),
    oemPartNumber,
  });
  const first = create('OEM-OPTIONAL-1', ' OEM-123 ');
  const second = create('OEM-OPTIONAL-2', ' ');

  await Promise.all([first.validate(), second.validate()]);
  assert.equal(first.oemPartNumber, 'OEM-123');
  assert.equal(second.oemPartNumber, undefined);

  const existing = Product.hydrate({
    _id: new mongoose.Types.ObjectId(),
    workspaceId,
    productName: 'Existing part',
    sku: 'OEM-CLEAR',
    category: new mongoose.Types.ObjectId(),
    supplier: new mongoose.Types.ObjectId(),
    oemPartNumber: 'OEM-OLD',
  });
  const clearUpdate = normalizeProductUpdateFields({ oemPartNumber: ' ' });
  Object.assign(existing, clearUpdate.changes);
  if (clearUpdate.clearOemPartNumber) existing.set('oemPartNumber', undefined);
  assert.deepEqual(existing.getChanges().$unset, { oemPartNumber: 1 });
});

test('empty and whitespace-only barcodes are absent after Mongoose normalization', async () => {
  for (const [index, barcode] of ['', ' \t ', null].entries()) {
    const product = new Product({
      workspaceId: new mongoose.Types.ObjectId(),
      productName: 'Part without barcode',
      sku: `PART-BLANK-${index}`,
      category: new mongoose.Types.ObjectId(),
      supplier: new mongoose.Types.ObjectId(),
      barcode,
    });

    await product.validate();
    assert.equal(product.barcode, undefined);
  }
});

test('Mongoose trims valid barcodes and plans an unset when an existing barcode is cleared', () => {
  const workspaceId = new mongoose.Types.ObjectId();
  const productData = {
    workspaceId,
    productName: 'Part with barcode',
    sku: 'PART-BARCODE',
    category: new mongoose.Types.ObjectId(),
    supplier: new mongoose.Types.ObjectId(),
  };
  const product = new Product({
    ...productData,
    barcode: '  0123-XYZ  ',
  });
  assert.equal(product.barcode, '0123-XYZ');

  const existing = Product.hydrate({
    _id: new mongoose.Types.ObjectId(),
    ...productData,
    barcode: '0123-XYZ',
  });
  const clearUpdate = normalizeProductUpdateFields({ barcode: ' \t ' });
  Object.assign(existing, clearUpdate.changes);
  if (clearUpdate.clearBarcode) existing.set('barcode', undefined);
  assert.deepEqual(existing.getChanges().$unset, { barcode: 1 });

  const retainUpdate = normalizeProductUpdateFields({ barcode: '  9876-ABC  ' });
  Object.assign(existing, retainUpdate.changes);
  assert.equal(existing.barcode, '9876-ABC');
});

test('two products without barcodes validate independently in the same workspace', async () => {
  const workspaceId = new mongoose.Types.ObjectId();
  const createProduct = (sku) => new Product({
    workspaceId,
    productName: sku,
    sku,
    category: new mongoose.Types.ObjectId(),
    supplier: new mongoose.Types.ObjectId(),
    barcode: '   ',
  });
  const first = createProduct('PART-NO-BARCODE-1');
  const second = createProduct('PART-NO-BARCODE-2');

  await Promise.all([first.validate(), second.validate()]);
  assert.equal(first.barcode, undefined);
  assert.equal(second.barcode, undefined);
});

test('verified compatible-model text remains optional product metadata', () => {
  const product = new Product({
    workspaceId: new mongoose.Types.ObjectId(),
    productName: 'Existing part',
    sku: 'PART-002',
    category: new mongoose.Types.ObjectId(),
    supplier: new mongoose.Types.ObjectId(),
    compatibleModels: ' Yamaha model name ',
  });

  assert.equal(product.validateSync(), undefined);
  assert.equal(product.compatibleModels, 'Yamaha model name');
});

test('part-number and barcode uniqueness remains scoped to workspace', () => {
  const indexes = Product.schema.indexes();
  const partNumberIndex = indexes.find(([fields]) => (
    fields.workspaceId === 1 && fields.sku === 1
  ));
  const barcodeIndex = indexes.find(([fields]) => (
    fields.workspaceId === 1 && fields.barcode === 1
  ));
  const oemPartNumberIndex = indexes.find(([fields]) => (
    fields.workspaceId === 1 && fields.oemPartNumber === 1
  ));

  assert.equal(partNumberIndex?.[1].unique, true);
  assert.equal(barcodeIndex?.[1].unique, true);
  assert.deepEqual(barcodeIndex?.[1].partialFilterExpression, { barcode: { $type: 'string' } });
  assert.equal(oemPartNumberIndex?.[1].unique, true);
  assert.deepEqual(oemPartNumberIndex?.[1].partialFilterExpression, { oemPartNumber: { $type: 'string' } });
});
