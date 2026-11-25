// Synthetic data simulating realistic shop operations; no record represents a verified transaction.
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Customer from '../models/Customer.js';
import MarketPrice from '../models/MarketPrice.js';
import Product from '../models/Product.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Sale from '../models/Sale.js';
import StockMovement from '../models/StockMovement.js';
import Supplier from '../models/Supplier.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import { recordSale, createProductWithOpeningStock } from '../services/inventoryService.js';
import {
  createPurchaseOrder,
  cancelPurchaseOrder,
  markPurchaseOrderOrdered,
  receivePurchaseOrderItems,
} from '../services/purchaseOrderService.js';
import {
  buildBusinessSamplePlan,
  getBusinessSampleRecordKeys,
  INITIAL_BUSINESS_SAMPLE_PRODUCT_COUNT,
  summarizeBusinessSamplePlan,
} from './businessSamplePlan.js';

const DATA_MODELS = {
  Category,
  Supplier,
  Customer,
  Product,
  PurchaseOrder,
  Sale,
  StockMovement,
  MarketPrice,
};

const COLLECTION_NAMES = Object.keys(DATA_MODELS);
const SAMPLE_INDEX_OPTIONS = {
  unique: true,
  partialFilterExpression: {
    sampleDatasetId: { $type: 'string' },
    sampleRecordKey: { $type: 'string' },
  },
};

const showHelp = () => {
  console.log([
    'Usage:',
    '  npm run sample-data -- --database <local-db> --workspace-id <id> --member-id <id> [--dataset-id <id>] [--as-of YYYY-MM-DD]',
    '  npm run sample-data -- --database <local-db> --workspace-id <id> --member-id <id> [--dataset-id <id>] [--as-of YYYY-MM-DD] --apply --confirm-plan <token>',
    '',
    'The first command performs a read-only preflight. The second applies only the exact reviewed plan.',
    'MONGODB_URI must point to a local MongoDB instance; remote hosts are refused.',
    'No existing records, user accounts, or workspaces are updated or deleted.',
  ].join('\n'));
};

const parseArgs = (args) => {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') {
      parsed.help = true;
      continue;
    }
    if (argument === '--apply') {
      parsed.apply = true;
      continue;
    }
    if (!['--database', '--workspace-id', '--member-id', '--dataset-id', '--as-of', '--confirm-plan'].includes(argument)) {
      throw new Error(`Unknown option: ${argument}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`A value is required after ${argument}`);
    parsed[argument.slice(2)] = value;
    index += 1;
  }
  if (!parsed.help) {
    for (const required of ['database', 'workspace-id', 'member-id']) {
      if (!parsed[required]) throw new Error(`--${required} is required`);
    }
    if (Boolean(parsed.apply) !== Boolean(parsed['confirm-plan'])) {
      throw new Error('--apply and --confirm-plan must be provided together');
    }
  }
  return parsed;
};

const isValidObjectId = (value) => mongoose.isValidObjectId(value);

const assertLocalDatabaseTarget = (databaseName) => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set. No database connection was attempted.');
  let parsedUri;
  try {
    parsedUri = new URL(uri);
  } catch {
    throw new Error('MONGODB_URI is invalid; its value is not displayed.');
  }
  if (!['mongodb:', 'mongodb+srv:'].includes(parsedUri.protocol)) {
    throw new Error('MONGODB_URI must use the MongoDB protocol.');
  }
  if (parsedUri.protocol === 'mongodb+srv:') {
    throw new Error('SRV/remote MongoDB targets are refused; use an explicitly local MongoDB URI.');
  }
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  const hosts = parsedUri.hostname.split(',').map((host) => host.trim().replace(/^\[|\]$/g, ''));
  if (!hosts.length || hosts.some((host) => !localHosts.has(host))) {
    throw new Error('Only localhost, 127.0.0.1, or ::1 MongoDB targets are allowed.');
  }
  const connectedDatabase = decodeURIComponent(parsedUri.pathname.replace(/^\/+/, ''));
  if (!connectedDatabase || connectedDatabase !== databaseName) {
    throw new Error(`The --database value must exactly match the database name in MONGODB_URI (expected ${connectedDatabase || 'an explicit database name'}).`);
  }
};

const stableHash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20).toUpperCase();

const loadTarget = async ({ workspaceId, memberId }) => {
  if (!isValidObjectId(workspaceId) || !isValidObjectId(memberId)) {
    throw new Error('Workspace and member identifiers must be valid MongoDB ObjectIds.');
  }
  const [workspace, member] = await Promise.all([
    Workspace.findOne({ _id: workspaceId, members: memberId }).select('_id name members').lean(),
    User.findOne({ _id: memberId, isActive: true }).select('_id').lean(),
  ]);
  if (!workspace || !member) {
    throw new Error('The active member must already belong to the specified workspace. No workspace or user will be created.');
  }
  return workspace;
};

const loadCreatorIds = async (workspace) => {
  const creatorRoles = ['admin', 'manager', 'store_keeper'];
  const users = await User.find({
    _id: { $in: workspace.members },
    isActive: true,
    role: { $in: creatorRoles },
  }).select('_id role').lean();
  const idsByRole = new Map(users.map((user) => [user.role, String(user._id)]));
  const missingRoles = creatorRoles.filter((role) => !idsByRole.has(role));
  if (missingRoles.length) {
    throw new Error(`Synthetic records require active Main workspace members for these creator roles: ${missingRoles.join(', ')}.`);
  }
  return creatorRoles.map((role) => idsByRole.get(role));
};

const readDatabaseState = async ({ workspaceId, datasetId, plan }) => {
  const expectedKeys = getBusinessSampleRecordKeys(plan);
  const state = {};
  for (const name of COLLECTION_NAMES) {
    const Model = DATA_MODELS[name];
    const [existingCount, marked] = await Promise.all([
      Model.countDocuments({ workspaceId }),
      Model.find({ workspaceId, sampleDatasetId: datasetId }).select('_id sampleRecordKey').lean(),
    ]);
    const actualKeys = marked.map((record) => record.sampleRecordKey);
    const actualKeySet = new Set(actualKeys);
    const expectedKeySet = new Set(expectedKeys[name]);
    const unexpectedKeys = actualKeys.filter((key) => !expectedKeySet.has(key));
    const missingKeys = expectedKeys[name].filter((key) => !actualKeySet.has(key));
    state[name] = {
      existingCount,
      datasetCount: marked.length,
      actualKeys,
      duplicateKeys: actualKeys.length !== actualKeySet.size,
      unexpectedKeys,
      missingKeys,
    };
  }
  return state;
};

const findBusinessKeyCollisions = async ({ workspaceId, datasetId, plan }) => {
  const suffix = datasetId.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
  const conflicts = [];
  const check = async (label, Model, filter) => {
    const found = await Model.findOne({
      workspaceId,
      ...filter,
      sampleDatasetId: { $ne: datasetId },
    }).select('_id').lean();
    if (found) conflicts.push(label);
  };
  await Promise.all([
    check('category names or codes', Category, {
      $or: [
        { name: { $in: plan.categories.map((name) => `${name} (Sample Data)`) } },
        { code: { $in: plan.categories.map((_, index) => `SMP-${suffix}-${String(index + 1).padStart(2, '0')}`) } },
      ],
    }),
    check('supplier codes', Supplier, {
      supplierCode: { $in: plan.suppliers.map((_, index) => `SMP-${datasetId.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase()}-${String(index + 1).padStart(2, '0')}`) },
    }),
    check('product SKUs', Product, { sku: { $in: plan.products.map((product) => product.sku) } }),
    check('product barcodes', Product, { barcode: { $in: plan.products.map((product) => product.barcode) } }),
    check('purchase order numbers', PurchaseOrder, { poNumber: { $in: plan.purchaseOrders.map((order) => order.poNumber) } }),
  ]);
  return conflicts;
};

const createPlanSnapshot = async ({ database, workspace, workspaceId, memberId, creatorIds, plan }) => {
  const existing = await readDatabaseState({ workspaceId, datasetId: plan.datasetId, plan });
  const collisions = await findBusinessKeyCollisions({ workspaceId, datasetId: plan.datasetId, plan });
  const expectedKeys = getBusinessSampleRecordKeys(plan);
  const complete = COLLECTION_NAMES.every((name) => (
    existing[name].datasetCount === expectedKeys[name].length
    && existing[name].missingKeys.length === 0
    && existing[name].unexpectedKeys.length === 0
    && !existing[name].duplicateKeys
  ));
  const initialKeys = getBusinessSampleRecordKeys(plan, INITIAL_BUSINESS_SAMPLE_PRODUCT_COUNT);
  const appendOnlyCollections = new Set(['Product', 'StockMovement', 'MarketPrice']);
  const appendOnly = !complete && COLLECTION_NAMES.every((name) => {
    const expected = appendOnlyCollections.has(name) ? initialKeys[name] : expectedKeys[name];
    const actual = existing[name].actualKeys;
    const expectedSet = new Set(expected);
    return actual.length === expected.length
      && new Set(actual).size === actual.length
      && actual.every((key) => expectedSet.has(key));
  });
  const empty = COLLECTION_NAMES.every((name) => existing[name].datasetCount === 0);
  const stateSafe = empty || complete || appendOnly;
  const summary = summarizeBusinessSamplePlan(plan);
  const recordsToCreate = Object.fromEntries(COLLECTION_NAMES.map((name) => [
    name,
    complete ? 0 : appendOnly ? existing[name].missingKeys.length : expectedKeys[name].length,
  ]));
  const serializable = {
    database,
    workspaceId: String(workspaceId),
    memberId: String(memberId),
    workspaceName: workspace.name,
    creatorIds,
    asOf: plan.asOf,
    datasetId: plan.datasetId,
    summary,
    recordsToCreate,
    existing: Object.fromEntries(COLLECTION_NAMES.map((name) => [name, existing[name].existingCount])),
    datasetCounts: Object.fromEntries(COLLECTION_NAMES.map((name) => [name, existing[name].datasetCount])),
    collisions,
    stateSafe,
    complete,
    appendOnly,
  };
  return {
    ...serializable,
    confirmation: stableHash(serializable),
  };
};

const printPlan = (snapshot) => {
  console.log('\nBUSINESS SAMPLE DATA PREFLIGHT');
  console.log(`Database: ${snapshot.database}`);
  console.log(`Workspace: ${snapshot.workspaceName} (${snapshot.workspaceId})`);
  console.log(`Existing member ID: ${snapshot.memberId} (verified active workspace member)`);
  console.log(`Synthetic record creators: ${snapshot.creatorIds.length} verified active admin/manager/store-keeper members`);
  console.log(`Dataset ID: ${snapshot.datasetId}`);
  console.log(`Asia/Colombo as-of date: ${snapshot.asOf}`);
  console.log(`Transaction support: ${snapshot.transactionSupport ? 'replica set / sharded cluster detected' : 'NOT DETECTED; apply is refused'}`);
  console.log('\nRecords planned (all additions; no existing records are changed):');
  console.log(`Categories: ${snapshot.recordsToCreate.Category}`);
  console.log(`Suppliers: ${snapshot.recordsToCreate.Supplier}`);
  console.log(`Customers: ${snapshot.recordsToCreate.Customer}`);
  console.log(`Products: ${snapshot.recordsToCreate.Product}`);
  console.log(`Purchase orders: ${snapshot.recordsToCreate.PurchaseOrder}`);
  const salesInvoicesToCreate = snapshot.complete || snapshot.appendOnly ? 0 : snapshot.summary.salesInvoices;
  const totalRecordsToCreate = Object.values(snapshot.recordsToCreate).reduce((total, count) => total + count, 0);
  console.log(`Sales invoices: ${salesInvoicesToCreate} new (${snapshot.recordsToCreate.Sale} line records)`);
  console.log(`Stock movements: ${snapshot.recordsToCreate.StockMovement}`);
  console.log(`Market-price observations: ${snapshot.recordsToCreate.MarketPrice}`);
  console.log(`Total documents to create: ${totalRecordsToCreate}`);
  console.log('\nExisting workspace record counts (preserved):');
  for (const name of COLLECTION_NAMES) console.log(`${name}: ${snapshot.existing[name]}`);
  console.log(`Collision check: ${snapshot.collisions.length ? `FAILED (${snapshot.collisions.join(', ')})` : 'clear'}`);
  if (!snapshot.stateSafe) console.log('Dataset state: partial or unexpected records found; refusing to continue to avoid duplicate/partial writes.');
  else if (snapshot.complete) console.log('Dataset state: this exact dataset is already complete; re-running is a no-op.');
  else if (snapshot.appendOnly) console.log(`Dataset state: original sample records are intact; appending ${snapshot.recordsToCreate.Product} products with opening-stock and price-history records.`);
  else console.log('Dataset state: no records for this dataset ID exist; generated data will be additive.');
  console.log('\nNo records were written during this preflight.');
  console.log(`Plan confirmation token: ${snapshot.confirmation}`);
};

const addSampleIndexes = async () => {
  for (const Model of Object.values(DATA_MODELS)) {
    await Model.collection.createIndex(
      { workspaceId: 1, sampleDatasetId: 1, sampleRecordKey: 1 },
      SAMPLE_INDEX_OPTIONS,
    );
  }
};

const marker = (datasetId, sampleRecordKey) => ({
  dataOrigin: 'sample',
  sampleDatasetId: datasetId,
  sampleRecordKey,
});

const makeIdempotencyKey = (datasetId, key) => `sample:${stableHash(datasetId)}:${key}`;

const inExistingTransaction = (session) => async (operation) => operation(session);

const applyBusinessSamplePlan = async ({ workspaceId, creatorIds, plan, appendOnly = false }) => {
  const session = await mongoose.startSession();
  const transaction = inExistingTransaction(session);
  const categoriesByName = new Map();
  const suppliersByCode = new Map();
  const productsByIndex = new Map();
  const customersByIndex = new Map();
  const ordersByIndex = new Map();
  const creatorFor = (index) => creatorIds[index % creatorIds.length];

  try {
    await session.withTransaction(async () => {
      if (appendOnly) {
        const [categoryRecords, supplierRecords, productRecords] = await Promise.all([
          Category.find({ workspaceId, sampleDatasetId: plan.datasetId }).session(session).lean(),
          Supplier.find({ workspaceId, sampleDatasetId: plan.datasetId }).session(session).lean(),
          Product.find({ workspaceId, sampleDatasetId: plan.datasetId })
            .select('_id productName sampleRecordKey')
            .session(session)
            .lean(),
        ]);
        const categoriesByName = new Map(categoryRecords.map((category) => {
          const index = Number(category.sampleRecordKey.slice('category-'.length)) - 1;
          return [plan.categories[index], category];
        }));
        const suppliersByCode = new Map(supplierRecords.map((supplier) => [supplier.supplierCode, supplier]));
        const productsByKey = new Map(productRecords.map((product) => [product.sampleRecordKey, product]));

        for (let index = INITIAL_BUSINESS_SAMPLE_PRODUCT_COUNT; index < plan.products.length; index += 1) {
          const productData = plan.products[index];
          const createdBy = creatorFor(index + 2);
          const category = categoriesByName.get(productData.categoryName);
          const supplier = suppliersByCode.get(productData.supplierCode);
          if (!category || !supplier) throw new Error(`Internal dataset relationship is incomplete for ${productData.key}.`);
          const { product } = await createProductWithOpeningStock({
            workspaceId,
            productName: productData.name,
            sku: productData.sku,
            category: category._id,
            supplier: supplier._id,
            description: 'Synthetic catalog entry. Fitment is illustrative and must be verified before sale.',
            barcode: productData.barcode,
            unit: productData.unit,
            costPrice: productData.cost,
            sellingPrice: productData.price,
            currentStock: productData.openingQuantity,
            minimumStock: productData.minimum,
            maximumStock: productData.maximum,
            warehouseLocation: `Main Store - Rack ${String.fromCharCode(65 + (index % 6))}-${String(index + 1).padStart(2, '0')}`,
            manufacturer: 'Yamaha-compatible (synthetic record)',
            compatibleModels: `${productData.compatibleModels} (synthetic fitment; verify before use)`,
            isActive: true,
            createdBy,
            updatedBy: createdBy,
            createdAt: productData.createdAt,
            ...marker(plan.datasetId, productData.key),
          }, {
            transaction,
            occurredAt: productData.openingDate,
            sampleData: marker(plan.datasetId, `${productData.key}:opening`),
          });
          productsByKey.set(productData.key, product);
        }

        for (const record of plan.marketPrices) {
          if (record.productIndex < INITIAL_BUSINESS_SAMPLE_PRODUCT_COUNT) continue;
          const product = productsByKey.get(plan.products[record.productIndex].key);
          if (!product) throw new Error(`Market-price product is missing for ${record.key}.`);
          const marketPrice = new MarketPrice({
            workspaceId,
            product: product._id,
            productName: product.productName,
            price: record.price,
            source: `Synthetic sample source ${String.fromCharCode(65 + record.sourceIndex)} (illustrative only)`,
            priceType: record.priceType,
            currency: 'LKR',
            recordedAt: record.recordedAt,
            recordedBy: creatorFor(record.productIndex),
            ...marker(plan.datasetId, record.key),
          });
          await marketPrice.save({ session });
        }
        return;
      }

      for (const [index, name] of plan.categories.entries()) {
        const createdBy = creatorFor(index);
        const category = new Category({
          workspaceId,
          name: `${name} (Sample Data)`,
          code: `SMP-${plan.datasetId.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase()}-${String(index + 1).padStart(2, '0')}`,
          description: 'Synthetic demonstration category; not a verified business record.',
          createdBy,
          ...marker(plan.datasetId, `category-${String(index + 1).padStart(2, '0')}`),
        });
        await category.save({ session });
        categoriesByName.set(name, category);
      }

      for (const [index, supplierData] of plan.suppliers.entries()) {
        const createdBy = creatorFor(index + 1);
        const supplierCode = `SMP-${plan.datasetId.replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase()}-${String(index + 1).padStart(2, '0')}`;
        const supplier = new Supplier({
          workspaceId,
          ...supplierData,
          supplierCode,
          country: 'Sri Lanka',
          status: 'active',
          isActive: true,
          createdBy,
          ...marker(plan.datasetId, `supplier-${String(index + 1).padStart(2, '0')}`),
        });
        await supplier.save({ session });
        suppliersByCode.set(supplierCode, supplier);
      }

      for (const customerData of plan.customers) {
        const createdBy = creatorFor(Number(customerData.key.slice(-2)));
        const customer = new Customer({
          workspaceId,
          ...customerData,
          createdBy,
          ...marker(plan.datasetId, customerData.key),
        });
        await customer.save({ session });
        customersByIndex.set(Number(customerData.key.slice(-2)) - 1, customer);
      }

      for (let index = 0; index < plan.products.length; index += 1) {
        const productData = plan.products[index];
        const createdBy = creatorFor(index + 2);
        const category = categoriesByName.get(productData.categoryName);
        const supplier = suppliersByCode.get(productData.supplierCode);
        if (!category || !supplier) throw new Error(`Internal dataset relationship is incomplete for ${productData.key}.`);
        const openingMovementKey = `${productData.key}:opening`;
        const { product } = await createProductWithOpeningStock({
          workspaceId,
          productName: productData.name,
          sku: productData.sku,
          category: category._id,
          supplier: supplier._id,
          description: 'Synthetic catalog entry. Fitment is illustrative and must be verified before sale.',
          barcode: productData.barcode,
          unit: productData.unit,
          costPrice: productData.cost,
          sellingPrice: productData.price,
          currentStock: productData.openingQuantity,
          minimumStock: productData.minimum,
          maximumStock: productData.maximum,
          warehouseLocation: `Main Store - Rack ${String.fromCharCode(65 + (index % 6))}-${String(index + 1).padStart(2, '0')}`,
          manufacturer: 'Yamaha-compatible (synthetic record)',
          compatibleModels: `${productData.compatibleModels} (synthetic fitment; verify before use)`,
          isActive: true,
          createdBy,
          updatedBy: createdBy,
          createdAt: productData.createdAt,
          ...marker(plan.datasetId, productData.key),
        }, {
          transaction,
          occurredAt: productData.openingDate,
          sampleData: marker(plan.datasetId, openingMovementKey),
        });
        productsByIndex.set(index, product);
      }

      for (const record of plan.marketPrices) {
        const product = productsByIndex.get(record.productIndex);
        if (!product) throw new Error(`Market-price product is missing for ${record.key}.`);
        const marketPrice = new MarketPrice({
          workspaceId,
          product: product._id,
          productName: product.productName,
          price: record.price,
          source: `Synthetic sample source ${String.fromCharCode(65 + record.sourceIndex)} (illustrative only)`,
          priceType: record.priceType,
          currency: 'LKR',
          recordedAt: record.recordedAt,
          recordedBy: creatorFor(record.productIndex),
          ...marker(plan.datasetId, record.key),
        });
        await marketPrice.save({ session });
      }

      for (const [index, orderData] of plan.purchaseOrders.entries()) {
        const supplier = suppliersByCode.get(orderData.supplierCode);
        const userId = creatorFor(index);
        const items = orderData.items.map(({ productIndex, quantity }) => {
          const product = productsByIndex.get(productIndex);
          if (!product) throw new Error(`Purchase order product is missing for ${orderData.key}.`);
          return {
            productId: product._id,
            orderedQuantity: quantity,
            unitCost: plan.products[productIndex].cost,
          };
        });
        const order = await createPurchaseOrder({
          workspaceId,
          supplierId: supplier._id,
          poNumber: orderData.poNumber,
          orderDate: orderData.orderDate,
          expectedDeliveryDate: orderData.expectedDeliveryDate,
          items,
          notes: 'Synthetic sample purchase order. Not a real supplier transaction.',
          userId,
          sampleData: marker(plan.datasetId, orderData.key),
        }, { transaction });
        if (orderData.status !== 'draft') {
          await markPurchaseOrderOrdered({
            id: order._id,
            workspaceId,
            userId,
          }, { transaction });
        }
        if (orderData.status === 'cancelled') {
          await cancelPurchaseOrder({ id: order._id, workspaceId, userId }, { transaction });
        }
        ordersByIndex.set(index, order);
      }

      const operations = [
        ...plan.salesInvoices.map((invoice) => ({ kind: 'sale', date: invoice.saleDate, value: invoice })),
        ...plan.purchaseReceipts.map((receipt) => ({ kind: 'receipt', date: receipt.date, value: receipt })),
      ].sort((left, right) => left.date - right.date || left.kind.localeCompare(right.kind));

      for (const [operationIndex, operation] of operations.entries()) {
        if (operation.kind === 'sale') {
          const invoice = operation.value;
          const customer = customersByIndex.get(invoice.customerIndex);
          const userId = creatorFor(operationIndex);
          await recordSale({
            workspaceId,
            userId,
            customerId: customer._id,
            items: invoice.items.map((item) => ({
              productId: productsByIndex.get(item.productIndex)._id,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
            paymentStatus: 'Pending',
            notes: 'Synthetic sample invoice; no payment confirmation or external transaction is represented.',
            idempotencyKey: makeIdempotencyKey(plan.datasetId, invoice.key),
            invoiceNumber: invoice.invoiceNumber,
            saleDate: invoice.saleDate,
            sampleData: marker(plan.datasetId, invoice.key),
          }, { transaction });
        } else {
          const receipt = operation.value;
          const order = ordersByIndex.get(receipt.orderIndex);
          const userId = creatorFor(receipt.orderIndex + 1);
          await receivePurchaseOrderItems({
            id: order._id,
            workspaceId,
            items: receipt.items.map((item) => ({
              productId: productsByIndex.get(item.productIndex)._id,
              quantity: item.quantity,
            })),
            idempotencyKey: makeIdempotencyKey(plan.datasetId, `${order.poNumber}:${receipt.key}`),
            userId,
            receivedAt: receipt.date,
            sampleData: marker(plan.datasetId, `${plan.purchaseOrders[receipt.orderIndex].key}:${receipt.key}`),
          }, { transaction });
        }
      }
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
      maxCommitTimeMS: 30000,
    });
  } finally {
    await session.endSession();
  }
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    showHelp();
    return;
  }
  dotenv.config();
  assertLocalDatabaseTarget(args.database);
  const plan = buildBusinessSamplePlan({
    asOf: args['as-of'],
    datasetId: args['dataset-id'] || 'ahs-yamaha-synthetic-v2',
  });
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false,
    autoCreate: false,
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 5,
  });

  try {
    const workspace = await loadTarget({ workspaceId: args['workspace-id'], memberId: args['member-id'] });
    const creatorIds = await loadCreatorIds(workspace);
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    const transactionSupport = Boolean(hello.setName || hello.msg === 'isdbgrid');
    const snapshot = await createPlanSnapshot({
      database: mongoose.connection.name,
      workspace,
      workspaceId: args['workspace-id'],
      memberId: args['member-id'],
      creatorIds,
      plan,
    });
    snapshot.transactionSupport = transactionSupport;
    printPlan(snapshot);

    if (!args.apply) return;
    if (!snapshot.transactionSupport) throw new Error('Apply requires a replica set or sharded MongoDB cluster. No records were written.');
    if (snapshot.collisions.length) throw new Error(`Unique-key conflicts were found (${snapshot.collisions.join(', ')}). No records were written.`);
    if (!snapshot.stateSafe) throw new Error('A partial or unexpected sample dataset already exists. No records were written.');
    if (snapshot.complete) {
      console.log('\nNo-op: the complete dataset already exists; no records were inserted.');
      return;
    }
    if (snapshot.confirmation !== args['confirm-plan']) {
      throw new Error('The confirmation token does not match the current database/workspace/preflight plan. No records were written.');
    }

    await addSampleIndexes();
    await applyBusinessSamplePlan({
      workspaceId: args['workspace-id'],
      creatorIds,
      plan,
      appendOnly: snapshot.appendOnly,
    });
    console.log(`\nApplied dataset ${plan.datasetId}. Existing records were preserved; no users or workspaces were created or changed.`);
  } finally {
    await mongoose.disconnect();
  }
};

run().catch(async (error) => {
  console.error(`Business sample data generator failed: ${error.message}`);
  await mongoose.disconnect();
  process.exitCode = 1;
});
