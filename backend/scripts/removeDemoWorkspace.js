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
import Session from '../src/models/Session.js';
import StockMovement from '../src/models/StockMovement.js';
import Supplier from '../src/models/Supplier.js';
import User from '../src/models/User.js';
import Workspace from '../src/models/Workspace.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const DEMO_EMAIL = 'demo@inventory.invalid';
export const EXPECTED_COLLECTION_COUNTS = {
  categories: 3,
  customers: 0,
  marketprices: 0,
  marketpriceforecasts: 0,
  products: 4,
  purchaseorders: 0,
  sales: 2,
  stockmovements: 0,
  suppliers: 2,
};
const SCOPED_MODELS = [
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
    throw new Error('Removal refused: MONGODB_URI must target local ai_inventory_system; its value is not displayed.');
  }
  return uri;
};

const assertBackupExists = async () => {
  const manifestPath = path.resolve(process.cwd(), 'backup_before_cleanup', 'manifest.json');
  if (!existsSync(manifestPath)) throw new Error('Removal refused: backup_before_cleanup/manifest.json was not found.');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.database !== 'ai_inventory_system' || !Array.isArray(manifest.collections)) {
    throw new Error('Removal refused: the backup manifest does not describe ai_inventory_system.');
  }
  for (const [name, Model] of SCOPED_MODELS) {
    const entry = manifest.collections.find((collection) => collection.name === Model.collection.collectionName);
    if (!entry || entry.documentCount === undefined) {
      throw new Error(`Removal refused: backup is missing the ${name} collection.`);
    }
  }
  for (const name of ['users', 'workspaces', 'sessions']) {
    if (!manifest.collections.some((collection) => collection.name === name)) {
      throw new Error(`Removal refused: backup is missing the ${name} collection.`);
    }
  }
};

const countDocuments = (Model, filter, session) => Model.collection.countDocuments(
  filter,
  session ? { session } : {},
);

const loadRemovalTarget = async (session) => {
  const [demoUsers, demoWorkspaces, mainWorkspaces, totalWorkspaces, totalUsers] = await Promise.all([
    User.find({ email: DEMO_EMAIL, role: 'demo' }).select('_id email role').session(session || null).lean(),
    Workspace.find({ systemKey: 'demo' }).select('_id name systemKey owner members').session(session || null).lean(),
    Workspace.find({ systemKey: 'legacy-default', name: 'Main workspace' }).select('_id name systemKey members').session(session || null).lean(),
    Workspace.countDocuments({}).session(session || null),
    User.countDocuments({}).session(session || null),
  ]);
  if (demoUsers.length !== 1 || demoWorkspaces.length !== 1 || mainWorkspaces.length !== 1) {
    throw new Error('Removal refused: expected exactly one demo user, demo workspace, and Main workspace.');
  }

  const user = demoUsers[0];
  const workspace = demoWorkspaces[0];
  const mainWorkspace = mainWorkspaces[0];
  if (workspace.name !== 'Demo Inventory'
    || String(workspace.owner) !== String(user._id)
    || !Array.isArray(workspace.members)
    || !workspace.members.some((memberId) => String(memberId) === String(user._id))
    || workspace.members.length !== 1
    || String(workspace._id) === String(mainWorkspace._id)) {
    throw new Error('Removal refused: the demo workspace owner/membership does not match the verified demo user.');
  }
  const mainMembershipReferenceCount = mainWorkspace.members
    ? mainWorkspace.members.filter((memberId) => String(memberId) === String(user._id)).length
    : 0;
  const otherMemberships = await Workspace.find({
    _id: { $ne: workspace._id },
    members: user._id,
  }).select('_id').session(session || null).lean();
  if (mainMembershipReferenceCount !== 1
    || otherMemberships.length !== 1
    || String(otherMemberships[0]._id) !== String(mainWorkspace._id)) {
    throw new Error('Removal refused: demo membership references differ from the inspected Main/Demo state.');
  }
  return {
    user,
    workspace,
    mainWorkspace,
    mainMembershipReferenceCount,
    totalWorkspaces,
    totalUsers,
  };
};

const collectCounts = async ({ user, workspace, mainMembershipReferenceCount }, session) => {
  const counts = {};
  for (const [name, Model] of SCOPED_MODELS) {
    counts[name] = await countDocuments(Model, { workspaceId: workspace._id }, session);
  }
  counts.sessions = await countDocuments(Session, { user: user._id }, session);
  counts.demoUser = await countDocuments(User, { _id: user._id, email: DEMO_EMAIL, role: 'demo' }, session);
  counts.demoWorkspace = await countDocuments(Workspace, {
    _id: workspace._id,
    systemKey: 'demo',
    name: 'Demo Inventory',
    owner: user._id,
  }, session);
  counts.mainWorkspaceMembershipReferences = mainMembershipReferenceCount;
  return counts;
};

export const assertExpectedCounts = (counts, target) => {
  if (target.totalWorkspaces !== 2 || target.totalUsers !== 5) {
    throw new Error(`Removal refused: expected 2 workspaces and 5 users; found ${target.totalWorkspaces} and ${target.totalUsers}.`);
  }
  for (const [name, expected] of Object.entries(EXPECTED_COLLECTION_COUNTS)) {
    if (counts[name] !== expected) {
      throw new Error(`Removal refused: ${name} count is ${counts[name]}; expected ${expected}.`);
    }
  }
  if (counts.demoUser !== 1 || counts.demoWorkspace !== 1) {
    throw new Error('Removal refused: the exact demo user/workspace ownership filters no longer match one record each.');
  }
  if (counts.mainWorkspaceMembershipReferences !== 1) {
    throw new Error('Removal refused: expected one demo-user membership reference in Main workspace.');
  }
};

const printPlan = (target, counts, apply) => {
  console.log('\nDEMO WORKSPACE REMOVAL PREFLIGHT (DRY-RUN)');
  console.log(`Database: ai_inventory_system`);
  console.log(`Workspace: ${target.workspace.name} (${target.workspace._id}) [systemKey=demo]`);
  console.log(`Owner: ${DEMO_EMAIL} (${target.user._id})`);
  console.log(`Main workspace membership references to remove: ${target.mainMembershipReferenceCount}`);
  console.log('Exact removal filters: each inventory collection by workspaceId; sessions by demo user; workspace by _id/systemKey/name/owner; user by _id/email/role.');
  for (const [name, count] of Object.entries(counts)) console.log(`${name}: ${count}`);
  console.log(`Total workspaces now: ${target.totalWorkspaces}; expected after apply: 1`);
  console.log(`Total users now: ${target.totalUsers}; expected after apply: 4`);
  console.log(apply
    ? '\nPreflight complete; the reviewed plan will now be applied in a transaction.'
    : '\nNo records were changed.');
};

const applyRemoval = async (target, expectedCounts) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const currentTarget = await loadRemovalTarget(session);
      const currentCounts = await collectCounts(currentTarget, session);
      assertExpectedCounts(currentCounts, currentTarget);
      if (JSON.stringify(currentCounts) !== JSON.stringify(expectedCounts)) {
        throw new Error('Removal refused: counts changed after preflight. Run the dry-run again and review it.');
      }

      for (const [name, Model] of SCOPED_MODELS) {
        const result = await Model.deleteMany({ workspaceId: currentTarget.workspace._id }, { session });
        if (result.deletedCount !== currentCounts[name]) {
          throw new Error(`Removal aborted: deleted ${result.deletedCount} ${name}, expected ${currentCounts[name]}.`);
        }
      }

      const sessionResult = await Session.deleteMany({ user: currentTarget.user._id }, { session });
      if (sessionResult.deletedCount !== currentCounts.sessions) {
        throw new Error(`Removal aborted: deleted ${sessionResult.deletedCount} sessions, expected ${currentCounts.sessions}.`);
      }
      const membershipResult = await Workspace.updateOne({
        _id: currentTarget.mainWorkspace._id,
        name: 'Main workspace',
        systemKey: 'legacy-default',
        members: currentTarget.user._id,
      }, {
        $pull: { members: currentTarget.user._id },
      }, { session });
      if (membershipResult.modifiedCount !== currentCounts.mainWorkspaceMembershipReferences) {
        throw new Error(`Removal aborted: removed ${membershipResult.modifiedCount} Main membership references, expected ${currentCounts.mainWorkspaceMembershipReferences}.`);
      }
      const userResult = await User.deleteOne({
        _id: currentTarget.user._id,
        email: DEMO_EMAIL,
        role: 'demo',
      }, { session });
      if (userResult.deletedCount !== currentCounts.demoUser) {
        throw new Error(`Removal aborted: deleted ${userResult.deletedCount} demo users, expected ${currentCounts.demoUser}.`);
      }
      const workspaceResult = await Workspace.deleteOne({
        _id: currentTarget.workspace._id,
        systemKey: 'demo',
        name: 'Demo Inventory',
        owner: currentTarget.user._id,
      }, { session });
      if (workspaceResult.deletedCount !== currentCounts.demoWorkspace) {
        throw new Error(`Removal aborted: deleted ${workspaceResult.deletedCount} demo workspaces, expected ${currentCounts.demoWorkspace}.`);
      }

      const [remainingWorkspaces, remainingUsers, mainStillExists, mainMembershipReferenceCount] = await Promise.all([
        Workspace.countDocuments({}).session(session),
        User.countDocuments({}).session(session),
        Workspace.countDocuments({
          _id: currentTarget.mainWorkspace._id,
          name: 'Main workspace',
          systemKey: 'legacy-default',
        }).session(session),
        Workspace.countDocuments({
          _id: currentTarget.mainWorkspace._id,
          members: currentTarget.user._id,
        }).session(session),
      ]);
      if (remainingWorkspaces !== 1 || remainingUsers !== 4 || mainStillExists !== 1
        || mainMembershipReferenceCount !== 0) {
        throw new Error('Removal aborted: post-removal workspace/user counts did not match the required state.');
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
  if (args.some((argument) => argument !== '--apply') || args.filter((argument) => argument === '--apply').length > 1) {
    throw new Error('Usage: node backend/scripts/removeDemoWorkspace.js [--apply]');
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
    const target = await loadRemovalTarget();
    const counts = await collectCounts(target);
    printPlan(target, counts, apply);
    assertExpectedCounts(counts, target);
    if (!apply) return;

    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') {
      throw new Error('Apply requires a replica set or sharded MongoDB cluster. No records were changed.');
    }
    await applyRemoval(target, counts);
    console.log('\nDemo workspace removal committed. Main workspace and the four non-demo users remain.');
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(`Demo workspace removal failed: ${error.message}`);
    process.exitCode = 1;
  });
}
