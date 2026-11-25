const FIELD_ALIASES = {
  recordtype: 'recordType',
  classification: 'recordType',
  productname: 'productName',
  partname: 'productName',
  sku: 'sku',
  partnumber: 'sku',
  partnumbersku: 'sku',
  oempartnumber: 'oemPartNumber',
  oemnumber: 'oemPartNumber',
  genuinepartnumber: 'oemPartNumber',
  genuinepartnumberoemnumber: 'oemPartNumber',
  barcode: 'barcode',
  category: 'category',
  categoryname: 'category',
  supplier: 'supplier',
  suppliername: 'supplier',
  manufacturer: 'manufacturer',
  compatiblemodels: 'compatibleModels',
  compatibleyamahamodels: 'compatibleModels',
  costprice: 'costPrice',
  purchaseprice: 'costPrice',
  sellingprice: 'sellingPrice',
  availablestockquantity: 'currentStock',
  currentstock: 'currentStock',
  stockquantity: 'currentStock',
  minimumstock: 'minimumStock',
  minimumstocklevel: 'minimumStock',
  reorderlevel: 'minimumStock',
  maximumstock: 'maximumStock',
  maximumstocklevel: 'maximumStock',
  warehouselocation: 'warehouseLocation',
  racklocation: 'warehouseLocation',
  rackshelflocation: 'warehouseLocation',
  description: 'description',
  isactive: 'isActive',
  status: 'isActive',
  productstatus: 'isActive',
};

const normalizeIdentifier = (value) => String(value ?? '').trim().toLocaleLowerCase();
const normalizeHeader = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')
  .replace(/lkr$/, '');

const getCatalogName = (value) => (
  typeof value === 'string' ? value : value?.name || ''
);

const getId = (value) => (
  typeof value === 'string' ? value : value?.id || value?._id || ''
);

const addError = (errors, message) => {
  if (!errors.includes(message)) errors.push(message);
};

const parseNumber = (row, field, label, errors, { required = true } = {}) => {
  const raw = row[field];
  if (raw === undefined || raw === '') {
    if (required) addError(errors, `${label} is required.`);
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    addError(errors, `${label} must be a number zero or greater.`);
    return undefined;
  }
  return value;
};

const parseActive = (value, errors) => {
  if (value === undefined || value === '') return true;
  const normalized = value.trim().toLowerCase();
  if (['active', 'true', '1'].includes(normalized)) return true;
  if (['inactive', 'false', '0'].includes(normalized)) return false;
  addError(errors, 'Status must be active or inactive.');
  return true;
};

export const validateProductCsvRows = (
  inputRows,
  { categories = [], suppliers = [], existingProducts = [] } = {},
) => {
  const mappedRows = inputRows.map((input, index) => {
    const row = {};
    for (const [header, value] of Object.entries(input)) {
      const field = FIELD_ALIASES[normalizeHeader(header)];
      if (field) row[field] = String(value ?? '').trim();
    }

    const errors = [];
    if (row.recordType?.toUpperCase() !== 'ACTUAL') {
      addError(errors, 'Record type must be ACTUAL. Demo, test, and unclassified data cannot be imported.');
    }
    if (!row.productName) addError(errors, 'Part name is required.');
    if (!row.sku) addError(errors, 'SKU is required.');

    const category = categories.find((item) => normalizeIdentifier(getCatalogName(item)) === normalizeIdentifier(row.category));
    const supplier = suppliers.find((item) => normalizeIdentifier(getCatalogName(item)) === normalizeIdentifier(row.supplier));
    if (!row.category) addError(errors, 'Category is required.');
    else if (!category) addError(errors, `Category "${row.category}" was not found in this workspace.`);
    if (!row.supplier) addError(errors, 'Supplier is required.');
    else if (!supplier) addError(errors, `Supplier "${row.supplier}" was not found in this workspace.`);

    const costPrice = parseNumber(row, 'costPrice', 'Purchase price', errors);
    const sellingPrice = parseNumber(row, 'sellingPrice', 'Selling price', errors);
    const currentStock = parseNumber(row, 'currentStock', 'Available stock', errors);
    const minimumStock = parseNumber(row, 'minimumStock', 'Minimum stock', errors);
    const maximumStock = parseNumber(row, 'maximumStock', 'Maximum stock', errors, { required: false });
    if (sellingPrice > 0 && costPrice !== undefined && sellingPrice <= costPrice) {
      addError(errors, 'Selling price must be greater than purchase price.');
    }
    if (maximumStock > 0 && minimumStock !== undefined && maximumStock <= minimumStock) {
      addError(errors, 'Maximum stock must be greater than minimum stock.');
    }

    const product = {
      productName: row.productName,
      sku: row.sku,
      oemPartNumber: row.oemPartNumber || undefined,
      barcode: row.barcode || undefined,
      category: getId(category),
      supplier: getId(supplier),
      manufacturer: row.manufacturer || undefined,
      compatibleModels: row.compatibleModels || undefined,
      costPrice,
      sellingPrice,
      currentStock,
      minimumStock,
      maximumStock: maximumStock ?? 0,
      warehouseLocation: row.warehouseLocation || undefined,
      description: row.description || undefined,
      isActive: parseActive(row.isActive, errors),
    };

    return { rowNumber: index + 2, product, errors };
  });

  const existingByField = {
    sku: new Set(existingProducts.map((product) => normalizeIdentifier(product.sku)).filter(Boolean)),
    oemPartNumber: new Set(existingProducts.map((product) => normalizeIdentifier(product.oemPartNumber)).filter(Boolean)),
    barcode: new Set(existingProducts.map((product) => normalizeIdentifier(product.barcode)).filter(Boolean)),
  };
  const fields = ['sku', 'oemPartNumber', 'barcode'];
  for (const field of fields) {
    const counts = new Map();
    for (const row of mappedRows) {
      const key = normalizeIdentifier(row.product[field]);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const row of mappedRows) {
      const key = normalizeIdentifier(row.product[field]);
      if (!key) continue;
      const label = field === 'oemPartNumber'
        ? 'OEM part number'
        : field === 'barcode'
          ? 'Barcode'
          : 'SKU';
      if (existingByField[field].has(key)) {
        addError(row.errors, `${label} "${row.product[field]}" already exists in this workspace.`);
      }
      if (counts.get(key) > 1) {
        addError(row.errors, `${label} "${row.product[field]}" is duplicated in this file.`);
      }
    }
  }

  return mappedRows;
};
