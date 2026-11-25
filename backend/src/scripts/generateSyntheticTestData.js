import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import Workspace from '../models/Workspace.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import StockMovement from '../models/StockMovement.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import MarketPrice from '../models/MarketPrice.js';
import { assertDedicatedTestMongoUri, assertTransactionTopology } from '../../test/integrationSafety.js';

dotenv.config();
const uri = process.env.MONGODB_TEST_URI;

const run = async () => {
  assertDedicatedTestMongoUri(uri);
  await mongoose.connect(uri, { autoIndex: true, serverSelectionTimeoutMS: 5000 });
  await assertTransactionTopology();

  const runId = process.env.AHS_TEST_RUN_ID?.trim() || randomUUID();
  const marker = `ahs:test:synthetic:${runId}`;
  const ownership = { testSuite: 'synthetic', testRunId: runId };
  console.log(`Starting synthetic test run ${runId}. Keep this identifier for exact cleanup.`);

  const password = await bcrypt.hash('AHS-Synthetic-Only-12!', 12);
  const users = await User.insertMany([
    { name: 'AHS Synthetic Administrator', email: `test-admin-${runId}@ahs-synthetic.invalid`, password, role: 'admin', isActive: true, ...ownership },
    { name: 'AHS Synthetic Manager', email: `test-manager-${runId}@ahs-synthetic.invalid`, password, role: 'manager', isActive: true, ...ownership },
    { name: 'AHS Synthetic Store Keeper', email: `test-store-${runId}@ahs-synthetic.invalid`, password, role: 'store_keeper', isActive: true, ...ownership },
    { name: 'AHS Synthetic Sales Staff', email: `test-sales-${runId}@ahs-synthetic.invalid`, password, role: 'employee', isActive: true, ...ownership },
    { name: 'AHS Synthetic Viewer', email: `test-viewer-${runId}@ahs-synthetic.invalid`, password, role: 'viewer', isActive: true, ...ownership },
  ]);

  const [admin, manager, storeKeeper, salesStaff] = users;
  const workspace = await Workspace.create({
    name: 'AHS SYNTHETIC TEST WORKSPACE',
    owner: admin._id,
    members: users.map((user) => user._id),
    systemKey: marker,
    ...ownership,
  });
  await User.updateMany(
    { _id: { $in: users.map((user) => user._id) } },
    { $set: { testWorkspaceId: workspace._id } },
  );

  const categories = await Category.insertMany([
    { workspaceId: workspace._id, name: 'Synthetic Engine Parts', code: 'TEST-ENG', description: 'Synthetic category only', createdBy: admin._id, ...ownership },
    { workspaceId: workspace._id, name: 'Synthetic Brakes', code: 'TEST-BRK', description: 'Synthetic category only', createdBy: admin._id, ...ownership },
    { workspaceId: workspace._id, name: 'Synthetic Electrical', code: 'TEST-ELC', description: 'Synthetic category only', createdBy: admin._id, ...ownership },
  ]);
  const supplier = await Supplier.create({
    workspaceId: workspace._id,
    name: 'Synthetic AHS Supplier',
    supplierCode: 'TEST-SUP-001',
    contactPerson: 'Synthetic Contact',
    country: 'Sri Lanka',
    city: 'Sammanthurai',
    createdBy: admin._id,
    ...ownership,
  });

  const now = new Date();
  const products = await Product.insertMany([
    { workspaceId: workspace._id, productName: 'Synthetic Yamaha Brake Shoe', sku: 'TEST-YAM-BRAKE-001', barcode: 'TEST-BC-001', category: categories[1]._id, supplier: supplier._id, manufacturer: 'Synthetic Manufacturer', compatibleModels: 'Synthetic-test-model-only', description: 'Synthetic spare part example', costPrice: 1200, sellingPrice: 1800, currentStock: 4, minimumStock: 4, createdBy: admin._id, ...ownership },
    { workspaceId: workspace._id, productName: 'Synthetic Yamaha Oil Filter', sku: 'TEST-YAM-FILTER-002', category: categories[0]._id, supplier: supplier._id, manufacturer: 'Synthetic Manufacturer', description: 'Synthetic spare part example', costPrice: 600, sellingPrice: 950, currentStock: 2, minimumStock: 5, createdBy: admin._id, ...ownership },
    { workspaceId: workspace._id, productName: 'Synthetic Yamaha Spark Plug', sku: 'TEST-YAM-PLUG-003', barcode: 'TEST-BC-003', category: categories[2]._id, supplier: supplier._id, manufacturer: 'Synthetic Manufacturer', description: 'Synthetic spare part example', costPrice: 450, sellingPrice: 700, currentStock: 0, minimumStock: 3, createdBy: admin._id, ...ownership },
    { workspaceId: workspace._id, productName: 'Synthetic Yamaha Chain Sprocket', sku: 'TEST-YAM-CHAIN-004', category: categories[0]._id, supplier: supplier._id, manufacturer: 'Synthetic Manufacturer', description: 'Synthetic spare part example', costPrice: 2200, sellingPrice: 3100, currentStock: 18, minimumStock: 5, createdBy: admin._id, ...ownership },
  ]);

  const stockLevels = new Map(products.map((product) => [product._id.toString(), product.currentStock + 108]));
  for (let week = 27; week >= 1; week -= 1) {
    const saleDate = new Date(now);
    saleDate.setUTCDate(saleDate.getUTCDate() - week * 7);
    for (const [index, product] of products.entries()) {
      const quantity = (week + index) % 4;
      if (quantity === 0) continue;
      const sale = await Sale.create({
        workspaceId: workspace._id,
        customerName: `Synthetic Customer ${week}-${index}`,
        phone: '0000000000',
        product: product._id,
        quantity,
        unitPrice: product.sellingPrice,
        totalAmount: quantity * product.sellingPrice,
        paymentStatus: 'Paid',
        saleDate,
        createdBy: salesStaff._id,
        idempotencyKey: `TEST-SALE-${week}-${index}`,
        ...ownership,
      });
      const productKey = product._id.toString();
      const stockBefore = stockLevels.get(productKey);
      const stockAfter = stockBefore - quantity;
      stockLevels.set(productKey, stockAfter);
      await StockMovement.create({
        workspaceId: workspace._id,
        product: product._id,
        movementType: 'sale',
        quantity,
        stockBefore,
        stockAfter,
        reference: `Synthetic sale ${sale._id}`,
        performedBy: salesStaff._id,
        sale: sale._id,
        ...ownership,
      });
    }
  }

  for (const product of products) {
    for (let days = 60; days >= 7; days -= 7) {
      await MarketPrice.create({
        workspaceId: workspace._id,
        product: product._id,
        productName: product.productName,
        price: product.costPrice + (days % 5) * 50,
        source: 'Synthetic Market Source',
        priceType: 'Retail',
        currency: 'LKR',
        recordedAt: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
        recordedBy: manager._id,
        ...ownership,
      });
    }
  }

  await PurchaseOrder.insertMany([
    { workspaceId: workspace._id, poNumber: 'TEST-PO-DRAFT-001', supplier: supplier._id, items: [{ product: products[1]._id, orderedQuantity: 10, receivedQuantity: 0, unitCost: 600, lineTotal: 6000 }], subtotal: 6000, totalAmount: 6000, status: 'draft', createdBy: manager._id, updatedBy: manager._id, ...ownership },
    { workspaceId: workspace._id, poNumber: 'TEST-PO-ORDERED-002', supplier: supplier._id, items: [{ product: products[0]._id, orderedQuantity: 12, receivedQuantity: 0, unitCost: 1200, lineTotal: 14400 }], subtotal: 14400, totalAmount: 14400, status: 'ordered', createdBy: manager._id, updatedBy: manager._id, ...ownership },
    { workspaceId: workspace._id, poNumber: 'TEST-PO-PARTIAL-003', supplier: supplier._id, items: [{ product: products[2]._id, orderedQuantity: 9, receivedQuantity: 3, unitCost: 450, lineTotal: 4050 }], subtotal: 4050, totalAmount: 4050, status: 'partially_received', createdBy: manager._id, updatedBy: storeKeeper._id, ...ownership },
    { workspaceId: workspace._id, poNumber: 'TEST-PO-CANCELLED-004', supplier: supplier._id, items: [{ product: products[3]._id, orderedQuantity: 5, receivedQuantity: 0, unitCost: 2200, lineTotal: 11000 }], subtotal: 11000, totalAmount: 11000, status: 'cancelled', createdBy: manager._id, updatedBy: manager._id, ...ownership },
  ]);

  console.log(JSON.stringify({
    workspaceId: workspace._id.toString(),
    systemKey: marker,
    testRunId: runId,
    userCount: users.length,
    productCount: products.length,
  }, null, 2));
};

run()
  .catch((error) => {
    console.error(`Synthetic test-data generation failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
