import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../src/models/Product.js';
import StockMovement from '../src/models/StockMovement.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';
import { buildLegacyOpeningBalancePlan } from '../src/scripts/legacyOpeningBalancePlan.js';

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20).toUpperCase();

const parseArgs = (args) => {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === '--apply') {
      parsed.apply = true;
      continue;
    }
    if (!['--database', '--workspace-id', '--member-id', '--confirm-plan'].includes(option)) {
      throw new Error(`Unknown option: ${option}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`A value is required after ${option}`);
    parsed[option.slice(2)] = value;
    index += 1;
  }
  for (const required of ['database', 'workspace-id', 'member-id']) {
    if (!parsed[required]) throw new Error(`--${required} is required`);
  }
  if (Boolean(parsed.apply) !== Boolean(parsed['confirm-plan'])) {
    throw new Error('--apply and --confirm-plan must be provided together');
  }
  return parsed;
};

const assertLocalDatabaseTarget = (databaseName) => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set. No database connection was attempted.');
  let uri;
  try {
    uri = new URL(process.env.MONGODB_URI);
  } catch {
    throw new Error('MONGODB_URI is invalid; its value is not displayed.');
  }
  if (uri.protocol !== 'mongodb:' || !['localhost', '127.0.0.1', '::1'].includes(uri.hostname.replace(/^\[|\]$/g, ''))) {
    throw new Error('Only an explicitly local mongodb:// URI is permitted.');
  }
  const connectedDatabase = decodeURIComponent(uri.pathname.replace(/^\/+/, ''));
  if (connectedDatabase !== databaseName) {
    throw new Error(`The --database value must exactly match the database name in MONGODB_URI (expected ${connectedDatabase || 'an explicit database name'}).`);
  }
};

const loadPlan = async ({ workspaceId, memberId }) => {
  if (!mongoose.isValidObjectId(workspaceId) || !mongoose.isValidObjectId(memberId)) {
    throw new Error('Workspace and member identifiers must be valid MongoDB ObjectIds.');
  }
  const [workspace, member] = await Promise.all([
    Workspace.findOne({ _id: workspaceId, members: memberId }).select('_id name').lean(),
    User.findOne({ _id: memberId, isActive: true, role: 'admin' }).select('_id').lean(),
  ]);
  if (!workspace || !member) throw new Error('The active admin member must already belong to the target workspace.');

  const products = await Product.find({
    workspaceId,
    sampleDatasetId: { $exists: false },
  }).select('_id productName sku currentStock createdAt').sort({ sku: 1 }).lean();
  const movements = products.length
    ? await StockMovement.find({
        workspaceId,
        product: { $in: products.map(({ _id }) => _id) },
      }).sort({ product: 1, createdAt: 1, _id: 1 }).lean()
    : [];
  const movementsByProduct = new Map();
  for (const movement of movements) {
    const key = String(movement.product);
    if (!movementsByProduct.has(key)) movementsByProduct.set(key, []);
    movementsByProduct.get(key).push(movement);
  }
  const plan = buildLegacyOpeningBalancePlan({ products, movementsByProduct });
  if (plan.errors.length) throw new Error(`Existing legacy stock ledger is inconsistent; no writes are allowed:\n${plan.errors.join('\n')}`);
  return { workspace, memberId, products, movementCount: movements.length, plan };
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  dotenv.config();
  assertLocalDatabaseTarget(args.database);
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false,
    autoCreate: false,
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 5,
  });
  try {
    const snapshot = await loadPlan({
      workspaceId: args['workspace-id'],
      memberId: args['member-id'],
    });
    const existingMovementCount = await StockMovement.countDocuments({ workspaceId: args['workspace-id'] });
    const serializable = {
      database: mongoose.connection.name,
      workspaceId: String(args['workspace-id']),
      products: snapshot.products.map(({ _id, currentStock }) => [String(_id), currentStock]),
      openingMovements: snapshot.plan.openingMovements.map(({ product, quantity, occurredAt }) => [
        String(product), quantity, occurredAt.toISOString(),
      ]),
    };
    const confirmation = hash(serializable);
    console.log('\nLEGACY OPENING BALANCE PREFLIGHT');
    console.log(`Database: ${mongoose.connection.name}`);
    console.log(`Workspace: ${snapshot.workspace.name} (${snapshot.workspace._id})`);
    console.log(`Legacy products checked: ${snapshot.products.length}`);
    console.log(`Existing workspace stock movements: ${existingMovementCount}`);
    console.log(`Legacy stock movements checked: ${snapshot.movementCount}`);
    console.log(`Opening stock movements to add: ${snapshot.plan.openingMovements.length}`);
    console.log(`Total opening stock quantity to record: ${snapshot.plan.openingMovements.reduce((sum, item) => sum + item.quantity, 0)}`);
    for (const item of snapshot.plan.openingMovements) {
      console.log(`  ${item.sku}: opening ${item.quantity} units on ${item.occurredAt.toISOString()}`);
    }
    console.log('Products and currentStock values will not be modified.');
    console.log('No records were written during this preflight.');
    console.log(`Plan confirmation token: ${confirmation}`);
    if (!args.apply) return;

    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') {
      throw new Error('Apply requires a replica set or sharded MongoDB cluster. No records were written.');
    }
    if (confirmation !== args['confirm-plan']) {
      throw new Error('The confirmation token does not match the current legacy opening plan. No records were written.');
    }
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const item of snapshot.plan.openingMovements) {
          const movement = new StockMovement({
            workspaceId: args['workspace-id'],
            product: item.product,
            movementType: 'stock_in',
            quantity: item.quantity,
            stockBefore: 0,
            stockAfter: item.quantity,
            reference: `Legacy opening balance ${String(item.product)}`,
            reason: 'Opening balance from preserved product stock; earlier movement history is unavailable.',
            performedBy: snapshot.memberId,
            idempotencyKey: `legacy-opening:${item.product}`,
          });
          movement.createdAt = item.occurredAt;
          movement.updatedAt = item.occurredAt;
          await movement.save({ session, timestamps: false });
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
    console.log(`\nRecorded ${snapshot.plan.openingMovements.length} legacy opening movements transactionally.`);
  } finally {
    await mongoose.disconnect();
  }
};

run().catch(async (error) => {
  console.error(`Legacy opening balance script failed: ${error.message}`);
  await mongoose.disconnect();
  process.exitCode = 1;
});
