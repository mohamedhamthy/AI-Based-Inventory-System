import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Supplier from '../models/Supplier.js';
import Product from '../models/Product.js';

dotenv.config();

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai_inventory_system');

  await Promise.all([User.deleteMany({}), Category.deleteMany({}), Supplier.deleteMany({}), Product.deleteMany({})]);

  const superAdmin = await User.create({
    name: 'Super Admin',
    email: 'superadmin@inventory.com',
    password: 'Password123!',
    role: 'super_admin',
    isActive: true,
  });

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@inventory.com',
    password: 'Password123!',
    role: 'admin',
    isActive: true,
  });

  const manager = await User.create({
    name: 'Manager User',
    email: 'manager@inventory.com',
    password: 'Password123!',
    role: 'manager',
    isActive: true,
  });

  const storeKeeper = await User.create({
    name: 'Store Keeper',
    email: 'storekeeper@inventory.com',
    password: 'Password123!',
    role: 'store_keeper',
    isActive: true,
  });

  const categories = await Category.create([
    { name: 'Engine Parts', code: 'ENG', description: 'Engine and drivetrain components', icon: '⚙️', color: '#22d3ee', createdBy: superAdmin._id },
    { name: 'Brake Systems', code: 'BRK', description: 'Brake assemblies and pads', icon: '🛑', color: '#f59e0b', createdBy: superAdmin._id },
    { name: 'Electrical Components', code: 'ELE', description: 'Sensors, lamps and electrical modules', icon: '🔌', color: '#818cf8', createdBy: admin._id },
    { name: 'Hydraulics', code: 'HYD', description: 'Hydraulic pumps, hoses and valves', icon: '💧', color: '#34d399', createdBy: manager._id },
    { name: 'Body Parts', code: 'BDY', description: 'Body and suspension components', icon: '🚗', color: '#fb923c', createdBy: manager._id },
  ]);

  const suppliers = await Supplier.create([
    { name: 'AutoCore Ltd', supplierCode: 'AC-001', contactPerson: 'Awa Ibrahim', email: 'sales@autocore.com', phone: '+2348011110001', address: 'Lagos', city: 'Lagos', country: 'Nigeria', paymentTerms: 'Net 30', status: 'active', createdBy: superAdmin._id },
    { name: 'ElectroParts', supplierCode: 'EP-001', contactPerson: 'Kola Adebayo', email: 'ops@electroparts.com', phone: '+2348011110002', address: 'Abuja', city: 'Abuja', country: 'Nigeria', paymentTerms: 'Net 45', status: 'active', createdBy: admin._id },
    { name: 'Motive Supply', supplierCode: 'MS-001', contactPerson: 'Bola Sanni', email: 'support@motive-supply.com', phone: '+2348011110003', address: 'Port Harcourt', city: 'Port Harcourt', country: 'Nigeria', paymentTerms: 'Net 30', status: 'active', createdBy: manager._id },
    { name: 'Prime Industrial', supplierCode: 'PI-001', contactPerson: 'Dawud Bello', email: 'procurement@primeindustrial.com', phone: '+2348011110004', address: 'Kano', city: 'Kano', country: 'Nigeria', paymentTerms: 'Net 60', status: 'active', createdBy: manager._id },
    { name: 'FleetLine Solutions', supplierCode: 'FLS-001', contactPerson: 'Rashid Lawal', email: 'ops@fleetline.com', phone: '+2348011110005', address: 'Ibadan', city: 'Ibadan', country: 'Nigeria', paymentTerms: 'Net 30', status: 'active', createdBy: storeKeeper._id },
  ]);

  const products = Array.from({ length: 20 }, (_, index) => ({
    productName: `Spare Part ${index + 1}`,
    sku: `SKU-${1000 + index}`,
    barcode: `BAR-${2000 + index}`,
    category: categories[index % categories.length]._id,
    supplier: suppliers[index % suppliers.length]._id,
    description: 'High quality industrial spare part',
    unit: 'Unit',
    costPrice: 40 + index * 5,
    sellingPrice: 70 + index * 6,
    currentStock: index % 4 === 0 ? 0 : index % 3 === 1 ? 5 : 18,
    minimumStock: 6,
    maximumStock: 30,
    warehouseLocation: `W-${(index % 5) + 1}`,
    manufacturer: 'PartsFlow Labs',
    compatibleModels: 'Model A, Model B',
    serialNumber: `SN-${index + 1}`,
    warrantyPeriod: '12 months',
    image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=500&q=80',
    isActive: true,
    createdBy: superAdmin._id,
    updatedBy: superAdmin._id,
  }));

  await Product.create(products);

  console.log('Seed completed successfully');
  await mongoose.disconnect();
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
