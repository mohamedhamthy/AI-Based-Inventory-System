import crypto from 'node:crypto';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import Category from '../models/Category.js';
import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';

const DEMO_EMAIL = 'demo@inventory.invalid';

const findOrCreateDemoUser = async () => {
  let user = await User.findOne({ email: DEMO_EMAIL });
  if (!user) {
    try {
      user = await User.create({
        name: 'Demo Visitor',
        email: DEMO_EMAIL,
        password: crypto.randomBytes(48).toString('hex'),
        role: 'demo',
        accountType: 'demo_user',
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      user = await User.findOne({ email: DEMO_EMAIL });
    }
  }

  if (!user || user.role !== 'demo' || user.accountType !== 'demo_user') {
    throw new Error('The reserved demo account is misconfigured');
  }
  return user;
};

const createDemoSampleData = async (workspaceId, userId) => {
  const categoryData = [
    { name: 'Engine Parts', code: 'DEMO-ENG', description: 'Sample engine components' },
    { name: 'Brake Systems', code: 'DEMO-BRK', description: 'Sample braking components' },
    { name: 'Electrical', code: 'DEMO-ELE', description: 'Sample electrical components' },
  ];
  const categories = await Promise.all(categoryData.map((category) => Category.findOneAndUpdate(
    { workspaceId, code: category.code },
    { $setOnInsert: { ...category, workspaceId, createdBy: userId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )));

  const supplierData = [
    { name: 'Sample Parts Co.', supplierCode: 'DEMO-SUP-01', contactPerson: 'Demo Contact', email: 'parts@example.invalid', phone: '000-000-0101', city: 'Sample City', country: 'Demo' },
    { name: 'Test Components Ltd.', supplierCode: 'DEMO-SUP-02', contactPerson: 'Sample Contact', email: 'supply@example.invalid', phone: '000-000-0102', city: 'Sample City', country: 'Demo' },
  ];
  const suppliers = await Promise.all(supplierData.map((supplier) => Supplier.findOneAndUpdate(
    { workspaceId, supplierCode: supplier.supplierCode },
    { $setOnInsert: { ...supplier, workspaceId, createdBy: userId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )));

  const productData = [
    { productName: 'Sample Brake Disc', sku: 'DEMO-1001', category: categories[1]._id, supplier: suppliers[0]._id, currentStock: 18, minimumStock: 5, costPrice: 40, sellingPrice: 65, unit: 'Piece' },
    { productName: 'Demo Spark Plug', sku: 'DEMO-1002', category: categories[2]._id, supplier: suppliers[1]._id, currentStock: 4, minimumStock: 6, costPrice: 8, sellingPrice: 14, unit: 'Piece' },
    { productName: 'Example Clutch Cable', sku: 'DEMO-1003', category: categories[0]._id, supplier: suppliers[0]._id, currentStock: 0, minimumStock: 3, costPrice: 12, sellingPrice: 20, unit: 'Piece' },
    { productName: 'Sample Chain Kit', sku: 'DEMO-1004', category: categories[0]._id, supplier: suppliers[1]._id, currentStock: 11, minimumStock: 4, costPrice: 30, sellingPrice: 48, unit: 'Set' },
  ];
  const products = await Promise.all(productData.map((product) => Product.findOneAndUpdate(
    { workspaceId, sku: product.sku },
    { $setOnInsert: { ...product, workspaceId, createdBy: userId, updatedBy: userId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )));

  if (await Sale.exists({ workspaceId })) return;

  await Sale.create([
    { customerName: 'Demo Customer One', product: products[0]._id, quantity: 2, unitPrice: 65, totalAmount: 130, paymentStatus: 'Paid', workspaceId, createdBy: userId },
    { customerName: 'Sample Customer Two', product: products[3]._id, quantity: 1, unitPrice: 48, totalAmount: 48, paymentStatus: 'Pending', workspaceId, createdBy: userId },
  ]);
};

export const ensureDemoEnvironment = async () => {
  const user = await findOrCreateDemoUser();
  const workspace = await Workspace.findOneAndUpdate(
    { systemKey: 'demo' },
    {
      $setOnInsert: { name: 'Demo Inventory', systemKey: 'demo' },
      $set: { owner: user._id, members: [user._id] },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await createDemoSampleData(workspace._id, user._id);
};
