import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Supplier from '../models/Supplier.js';
import Sale from '../models/Sale.js';

const inventoryModels = [Product, Category, Supplier, Sale];

export const migrateLegacyWorkspaces = async () => {
  const [memberIds, allUsers, hasLegacyData] = await Promise.all([
    Workspace.distinct('members'),
    User.find().select('_id').lean(),
    Promise.all(inventoryModels.map((Model) => Model.exists({ workspaceId: { $exists: false } }))),
  ]);
  const memberIdSet = new Set(memberIds.map(String));
  const unassignedUsers = allUsers.filter((user) => !memberIdSet.has(String(user._id)));
  const hasUnassignedData = hasLegacyData.some(Boolean);

  if (unassignedUsers.length === 0 && !hasUnassignedData) return;

  const ownerId = unassignedUsers[0]?._id || allUsers[0]?._id;
  if (!ownerId) throw new Error('Cannot migrate legacy inventory without an existing user account');

  const workspace = await Workspace.findOneAndUpdate(
    { systemKey: 'legacy-default' },
    { $setOnInsert: { name: 'Main workspace', owner: ownerId, systemKey: 'legacy-default' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const memberIdsToAdd = [...new Set([ownerId.toString(), ...unassignedUsers.map((user) => user._id.toString())])];
  await Workspace.updateOne(
    { _id: workspace._id },
    { $addToSet: { members: { $each: memberIdsToAdd } } },
  );

  await Promise.all(
    inventoryModels.map((Model) =>
      Model.updateMany(
        { workspaceId: { $exists: false } },
        { $set: { workspaceId: workspace._id } },
      ),
    ),
  );
};

const dropGlobalUniqueIndex = async (Model, indexName) => {
  const indexes = await Model.collection.indexes();
  const index = indexes.find((candidate) => candidate.name === indexName && candidate.unique);
  if (index) await Model.collection.dropIndex(indexName);
};

export const migrateWorkspaceIndexes = async () => {
  const models = [Product, Category, Supplier];
  await Promise.all(models.map((Model) => Model.createIndexes()));
  await Promise.all([
    dropGlobalUniqueIndex(Product, 'sku_1'),
    dropGlobalUniqueIndex(Product, 'barcode_1'),
    dropGlobalUniqueIndex(Category, 'name_1'),
    dropGlobalUniqueIndex(Category, 'code_1'),
    dropGlobalUniqueIndex(Supplier, 'supplierCode_1'),
  ]);
};
