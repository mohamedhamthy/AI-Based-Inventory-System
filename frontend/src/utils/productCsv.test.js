import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCsv } from './parseCsv.js';
import { validateProductCsvRows } from './productCsv.js';

const categories = [{ id: 'category-1', name: 'Engine' }];
const suppliers = [{ id: 'supplier-1', name: 'Parts Co' }];
const validRow = {
  'Record type': 'ACTUAL',
  'Product name': 'Oil filter',
  SKU: 'OF-4',
  'Genuine part number / OEM number': 'OEM-OF-4',
  Barcode: '',
  'Category name': 'Engine',
  'Supplier name': 'Parts Co',
  Manufacturer: 'Yamaha',
  'Compatible Yamaha models': 'verified model list',
  'Purchase price (LKR)': '125',
  'Selling price (LKR)': '180',
  'Available stock quantity': '4',
  'Minimum stock level': '2',
  'Maximum stock level': '20',
  'Rack / shelf location': 'A-1',
  Description: 'Verified supplier record',
  'Product status': 'active',
};

test('CSV preview maps the import template and resolves category and supplier in the workspace', () => {
  const [preview] = validateProductCsvRows([validRow], { categories, suppliers });
  assert.deepEqual(preview.errors, []);
  assert.deepEqual(preview.product, {
    productName: 'Oil filter',
    sku: 'OF-4',
    oemPartNumber: 'OEM-OF-4',
    barcode: undefined,
    category: 'category-1',
    supplier: 'supplier-1',
    manufacturer: 'Yamaha',
    compatibleModels: 'verified model list',
    costPrice: 125,
    sellingPrice: 180,
    currentStock: 4,
    minimumStock: 2,
    maximumStock: 20,
    warehouseLocation: 'A-1',
    description: 'Verified supplier record',
    isActive: true,
  });
  assert.equal(Object.hasOwn(preview.product, 'recordType'), false);
});

test('demo and unclassified records cannot pass actual-data import validation', () => {
  for (const recordType of ['DEMO DATA - NOT FOR IMPORT', 'TEST DATA', '']) {
    const [preview] = validateProductCsvRows([{ ...validRow, 'Record type': recordType }], { categories, suppliers });
    assert.ok(preview.errors.some((error) => error.includes('Record type must be ACTUAL')));
  }
});

test('duplicate SKU, OEM number, and barcode conflicts are reported before import', () => {
  const duplicateRow = { ...validRow, Barcode: 'B-1' };
  const [first, second] = validateProductCsvRows(
    [duplicateRow, { ...duplicateRow, 'Product name': 'Another part' }],
    { categories, suppliers },
  );
  assert.ok(first.errors.some((error) => error.includes('SKU "OF-4" is duplicated')));
  assert.ok(second.errors.some((error) => error.includes('OEM part number "OEM-OF-4" is duplicated')));
  assert.ok(first.errors.some((error) => error.includes('Barcode "B-1" is duplicated')));
  assert.ok(second.errors.some((error) => error.includes('Barcode "B-1" is duplicated')));
});

test('existing workspace identifiers, missing references, and invalid prices are row errors', () => {
  const [preview] = validateProductCsvRows([{
    ...validRow,
    'Purchase price (LKR)': '200',
    'Selling price (LKR)': '150',
  }], {
    categories,
    suppliers,
    existingProducts: [{ sku: 'of-4', oemPartNumber: 'OEM-OF-4' }],
  });
  assert.ok(preview.errors.some((error) => error.includes('SKU "OF-4" already exists')));
  assert.ok(preview.errors.some((error) => error.includes('OEM part number "OEM-OF-4" already exists')));
  assert.ok(preview.errors.some((error) => error.includes('Selling price must be greater')));
});

test('CSV parser output maps the exported catalog headings', () => {
  const rows = parseCsv([
    'Record type,Product name,SKU,Genuine part number / OEM number,Barcode,Category name,Supplier name,Purchase price (LKR),Selling price (LKR),Available stock quantity,Minimum stock level,Maximum stock level',
    'ACTUAL,Oil filter,OF-4,OEM-OF-4,,Engine,Parts Co,125,180,4,2,20',
  ].join('\r\n'));
  const [preview] = validateProductCsvRows(rows, { categories, suppliers });
  assert.deepEqual(preview.errors, []);
  assert.equal(preview.product.oemPartNumber, 'OEM-OF-4');
  assert.equal(preview.product.currentStock, 4);
});
