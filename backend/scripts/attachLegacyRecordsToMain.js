import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Category from '../src/models/Category.js';
import Customer from '../src/models/Customer.js';
import MarketPrice from '../src/models/MarketPrice.js';
import MarketPriceForecast from '../src/models/MarketPriceForecast.js';
import Product from '../src/models/Product.js';
import PurchaseOrder from '../src/models/PurchaseOrder.js';
import Sale from '../src/models/Sale.js';
import StockMovement from '../src/models/StockMovement.js';
import Supplier from '../src/models/Supplier.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import { migrateLegacyWorkspaces } from '../src/config/workspaceMigration.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const MODELS = [
  ['categories', Category],
  ['customers', Customer],
  ['marketprices', MarketPrice],
  ['marketpriceforecasts', MarketPriceForecast],
  ['products', Product],
  ['purchaseorders', PurchaseOrder],
  ['sales', Sale],
  ['stockmovements', StockMovement],
  ['suppliers', Supplier],
];
const EXPECTED_MISSING_COUNTS = {
  categories: 5,
  customers: 0,
  marketprices: 0,
  marketpriceforecasts: 0,
  products: 10,
  purchaseorders: 0,
  sales: 0,
  stockmovements: 0,
  suppliers: 5,
};

const validateDatabaseTarget = () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured; no database connection was attempted.');
  const parsedUri = new URL(uri);
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  const databaseName = decodeURIComponent(parsedUri.pathname.replace(/^\/+/, ''));
  if (!['mongodb:', 'mongodb+srv:'].includes(parsedUri.protocol)
    || parsedUri.protocol === 'mongodb+srv:'
    || !localHosts.has(parsedUri.hostname)
    || databaseName !== 'ai_inventory_system') {
    throw new Error('Migration refused: MONGODB_URI must target local ai_inventory_system; its value is not displayed.');
  }
  return uri;
};

const assertBackupExists = async () => {
  const manifestPath = path.resolve(process.cwd(), 'backup_before_cleanup', 'manifest.json');
  if (!existsSync(manifestPath)) throw new Error('Migration refused: backup_before_cleanup/manifest.json was not found.');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.database !== 'ai_inventory_system' || !Array.isArray(manifest.collections)) {
    throw new Error('Migration refused: backup manifest does not describe ai_inventory_system.');
  }
};

const count = (Model, filter, session) => Model.collection.countDocuments(
  filter,
  session ? { session } : {},
);

const getSnapshot = async (session) => {
  const querySession = session || null;
  const [workspaces, users] = await Promise.all([
    Workspace.find({ name: 'Main workspace', systemKey: 'legacy-default' })
      .select('_id name systemKey owner members')
      .session(querySession)
      .lean(),
    User.find({}).select('_id').session(querySession).lean(),
  ]);
  if (workspaces.length !== 1) {
    throw new Error(`Migration refused: expected one Main workspace; found ${workspaces.length}.`);
  }
  const workspace = workspaces[0];
  const totalWorkspaces = await Workspace.countDocuments({}).session(querySession);
  const memberIds = (workspace.members || []).map(String).sort();
  const userIds = users.map((user) => String(user._id)).sort();
  if (totalWorkspaces !== 1 || users.length !== 4
    || memberIds.length !== 4
    || JSON.stringify(memberIds) !== JSON.stringify(userIds)) {
    throw new Error('Migration refused: expected the one Main workspace to contain exactly the four remaining users.');
  }

  const modelCounts = {};
  for (const [name, Model] of MODELS) {
    const [inMain, missing, explicitNull, otherWorkspace] = await Promise.all([
      count(Model, { workspaceId: workspace._id }, session),
      count(Model, { workspaceId: { $exists: false } }, session),
      count(Model, { workspaceId: { $exists: true, $eq: null } }, session),
      count(Model, {
        workspaceId: { $exists: true, $nin: [workspace._id, null] },
      }, session),
    ]);
    modelCounts[name] = { inMain, missing, explicitNull, otherWorkspace };
  }

  return {
    workspaceId: String(workspace._id),
    workspaceName: workspace.name,
    totalWorkspaces,
    totalUsers: users.length,
    memberIds,
    modelCounts,
  };
};

const assertExpectedState = (snapshot) => {
  for (const [name, expectedMissing] of Object.entries(EXPECTED_MISSING_COUNTS)) {
    const counts = snapshot.modelCounts[name];
    if (counts.inMain !== 0
      || counts.missing !== expectedMissing
      || counts.explicitNull !== 0
      || counts.otherWorkspace !== 0) {
      throw new Error(
        `Migration refused: ${name} counts differ from the reviewed state `
        + `(Main ${counts.inMain}, missing ${counts.missing}, null ${counts.explicitNull}, other ${counts.otherWorkspace}; `
        + `expected Main 0, missing ${expectedMissing}, null 0, other 0).`,
      );
    }
  }
};

const printPlan = (snapshot, apply) => {
  console.log('\nLEGACY WORKSPACE ATTACHMENT PREFLIGHT');
  console.log(`Database: ai_inventory_system`);
  console.log(`Target: ${snapshot.workspaceName} (${snapshot.workspaceId}) [systemKey=legacy-default]`);
  console.log(`Workspace count: ${snapshot.totalWorkspaces}; users: ${snapshot.totalUsers}; members: ${snapshot.memberIds.length}`);
  console.log('Exact migration filter: workspaceId does not exist; action: set workspaceId to the existing Main workspace. No records are inserted or deleted.');
  console.log('Counts by collection:');
  for (const [name, counts] of Object.entries(snapshot.modelCounts)) {
    console.log(`${name}: Main=${counts.inMain}, missing workspaceId=${counts.missing}, explicit null=${counts.explicitNull}, other workspace=${counts.otherWorkspace}`);
  }
  console.log(apply
    ? '\nPreflight complete; the reviewed migration will now be applied in a transaction.'
    : '\nDry-run only; no records were changed.');
};

const applyMigration = async (snapshot) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await getSnapshot(session);
      assertExpectedState(current);
      if (JSON.stringify(current) !== JSON.stringify(snapshot)) {
        throw new Error('Migration refused: the database changed after dry-run. Review a new preflight.');
      }

      await migrateLegacyWorkspaces({ session });

      const after = await getSnapshot(session);
      for (const [name, expectedMissing] of Object.entries(EXPECTED_MISSING_COUNTS)) {
        const counts = after.modelCounts[name];
        if (counts.inMain !== expectedMissing || counts.missing !== 0
          || counts.explicitNull !== 0 || counts.otherWorkspace !== 0) {
          throw new Error(`Migration aborted: post-migration ${name} counts did not match the reviewed plan.`);
        }
      }
      if (after.workspaceId !== snapshot.workspaceId
        || after.totalWorkspaces !== 1
        || after.totalUsers !== 4
        || JSON.stringify(after.memberIds) !== JSON.stringify(snapshot.memberIds)) {
        throw new Error('Migration aborted: workspace/user state changed unexpectedly.');
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
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== '--apply') || args.length > 1) {
    throw new Error('Usage: node backend/scripts/attachLegacyRecordsToMain.js [--apply]');
  }
  const apply = args.includes('--apply');
  const uri = validateDatabaseTarget();
  await assertBackupExists();
  await mongoose.connect(uri, {
    autoIndex: false,
    autoCreate: false,
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 5,
  });

  try {
    const snapshot = await getSnapshot();
    printPlan(snapshot, apply);
    assertExpectedState(snapshot);
    if (!apply) return;

    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') {
      throw new Error('Apply requires a replica set or sharded MongoDB cluster. No records were changed.');
    }
    await applyMigration(snapshot);
    console.log('\nLegacy records were attached to Main in one transaction.');
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error(`Legacy workspace migration failed: ${error.message}`);
  process.exitCode = 1;
});
