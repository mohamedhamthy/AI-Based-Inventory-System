import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildProductSearchQuery,
  normalizeProductDuplicateError,
} from './productController.js';
import {
  normalizeProductCreateFields,
  normalizeProductUpdateFields,
} from '../utils/productBarcode.js';

test('product search matches partial part numbers and names case-insensitively', () => {
  const search = buildProductSearchQuery('  yx-1  ');

  assert.deepEqual(search.$or, [
    { productName: { $regex: 'yx-1', $options: 'i' } },
    { sku: { $regex: 'yx-1', $options: 'i' } },
    { oemPartNumber: { $regex: 'yx-1', $options: 'i' } },
    { barcode: { $regex: 'yx-1', $options: 'i' } },
    { manufacturer: { $regex: 'yx-1', $options: 'i' } },
    { compatibleModels: { $regex: 'yx-1', $options: 'i' } },
  ]);
});

test('product search escapes regex input and ignores whitespace-only queries', () => {
  assert.equal(buildProductSearchQuery('.*').$or[1].sku.$regex, '\\.\\*');
  assert.equal(buildProductSearchQuery('   '), null);
});

test('duplicate part numbers, OEM numbers, and barcodes return stable workspace-scoped conflicts', () => {
  const skuError = normalizeProductDuplicateError({
    code: 11000,
    keyPattern: { workspaceId: 1, sku: 1 },
  });
  const barcodeError = normalizeProductDuplicateError({
    code: 11000,
    keyPattern: { workspaceId: 1, barcode: 1 },
  });
  const oemError = normalizeProductDuplicateError({
    code: 11000,
    keyPattern: { workspaceId: 1, oemPartNumber: 1 },
  });

  assert.equal(skuError.statusCode, 409);
  assert.equal(skuError.errorCode, 'PRODUCT_SKU_DUPLICATE');
  assert.match(skuError.message, /part number is already in use in this workspace/);
  assert.equal(barcodeError.statusCode, 409);
  assert.equal(barcodeError.errorCode, 'PRODUCT_BARCODE_DUPLICATE');
  assert.equal(oemError.statusCode, 409);
  assert.equal(oemError.errorCode, 'PRODUCT_OEM_PART_NUMBER_DUPLICATE');
});

test('product duplicate error normalization leaves non-duplicate errors unchanged', () => {
  const error = new Error('validation failed');
  assert.equal(normalizeProductDuplicateError(error), error);
});

test('product creation omits an absent barcode', () => {
  const fields = normalizeProductCreateFields({ productName: 'Part', sku: 'PART-001' });
  assert.deepEqual(fields, { productName: 'Part', sku: 'PART-001' });
  assert.equal(Object.hasOwn(fields, 'barcode'), false);
});

test('product creation omits an empty barcode', () => {
  const fields = normalizeProductCreateFields({ productName: 'Part', barcode: '' });
  assert.equal(Object.hasOwn(fields, 'barcode'), false);
});

test('product creation omits a null barcode', () => {
  const fields = normalizeProductCreateFields({ productName: 'Part', barcode: null });
  assert.equal(Object.hasOwn(fields, 'barcode'), false);
});

test('product creation omits a whitespace-only barcode', () => {
  const fields = normalizeProductCreateFields({ productName: 'Part', barcode: ' \t ' });
  assert.equal(Object.hasOwn(fields, 'barcode'), false);
});

test('product creation trims a valid barcode before persistence', () => {
  const fields = normalizeProductCreateFields({ productName: 'Part', barcode: '  0123-XYZ  ' });
  assert.equal(fields.barcode, '0123-XYZ');
});

test('product updates distinguish an omitted barcode from a request to clear it', () => {
  assert.deepEqual(normalizeProductUpdateFields({ productName: 'Updated' }), {
    changes: { productName: 'Updated' },
    clearBarcode: false,
    clearOemPartNumber: false,
  });
  assert.deepEqual(normalizeProductUpdateFields({ barcode: ' \t ' }), {
    changes: {},
    clearBarcode: true,
    clearOemPartNumber: false,
  });
  assert.deepEqual(normalizeProductUpdateFields({ barcode: null }), {
    changes: {},
    clearBarcode: true,
    clearOemPartNumber: false,
  });
});

test('product updates trim and retain a valid barcode', () => {
  assert.deepEqual(normalizeProductUpdateFields({ barcode: '  0123-XYZ  ' }), {
    changes: { barcode: '0123-XYZ' },
    clearBarcode: false,
    clearOemPartNumber: false,
  });
});

test('OEM part numbers are trimmed, optional, and can be explicitly cleared', () => {
  assert.deepEqual(normalizeProductCreateFields({ oemPartNumber: '  OEM-123  ' }), {
    oemPartNumber: 'OEM-123',
  });
  assert.equal(Object.hasOwn(normalizeProductCreateFields({ oemPartNumber: '  ' }), 'oemPartNumber'), false);
  assert.deepEqual(normalizeProductUpdateFields({ oemPartNumber: ' OEM-456 ' }), {
    changes: { oemPartNumber: 'OEM-456' },
    clearBarcode: false,
    clearOemPartNumber: false,
  });
  assert.deepEqual(normalizeProductUpdateFields({ oemPartNumber: ' ' }), {
    changes: {},
    clearBarcode: false,
    clearOemPartNumber: true,
  });
});
