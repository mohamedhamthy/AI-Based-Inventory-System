import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Workspace from '../models/Workspace.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import StockMovement from '../models/StockMovement.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import MarketPrice from '../models/MarketPrice.js';
import MarketPriceForecast from '../models/MarketPriceForecast.js';
import { assertDedicatedTestMongoUri } from '../../test/integrationSafety.js';
import { cleanupOwnedRun, formatOwnedRuns, listOwnedRuns } from '../../test/testOwnedCleanup.js';

dotenv.config();

const records = [
  { name: 'Category', Model: Category },
  { name: 'Supplier', Model: Supplier },
  { name: 'Product', Model: Product },
  { name: 'Sale', Model: Sale },
  { name: 'StockMovement', Model: StockMovement },
  { name: 'PurchaseOrder', Model: PurchaseOrder },
  { name: 'MarketPrice', Model: MarketPrice },
  { name: 'MarketPriceForecast', Model: MarketPriceForecast },
];

const run = async () => {
  const uri = process.env.MONGODB_TEST_URI;
  try {
    assertDedicatedTestMongoUri(uri);
  } catch (error) {
    throw new Error(`Invalid database target: ${error.message}`, { cause: error });
  }

  try {
    await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 5000 });
  } catch (error) {
    throw new Error(`Database connection failed: ${error.message}`, { cause: error });
  }

  const args = process.argv.slice(2);
  const runId = args.find((arg) => arg.startsWith('--run-id='))?.slice('--run-id='.length).trim();
  const listOnly = args.includes('--list');

  try {
    if (listOnly) {
      const runs = await listOwnedRuns({ suite: 'synthetic', Workspace, User });
      console.log(formatOwnedRuns(runs, 'synthetic'));
      return;
    }
    if (!runId) throw new Error('Cleanup requires --run-id=<exact-run-id>; use --list to discover runs.');
    const result = await cleanupOwnedRun({
      suite: 'synthetic',
      runId,
      Workspace,
      User,
      records,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    throw new Error(`Cleanup query or operation failed: ${error.message}`, { cause: error });
  }
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
