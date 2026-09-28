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
    { name: 'Aruj Auto Parts', supplierCode: 'AAP-001', contactPerson: 'Ahamed Nazeer', email: 'sales@arujautoparts.com', phone: '+94 77 111 0001', address: 'Galle Road', city: 'Colombo', country: 'Sri Lanka', paymentTerms: 'Net 30', status: 'active', createdBy: superAdmin._id },
    { name: 'Mansoor Motor Works', supplierCode: 'MMW-002', contactPerson: 'Mansoor Farook', email: 'ops@mansoormotorworks.com', phone: '+94 77 222 0002', address: 'Main Street', city: 'Kandy', country: 'Sri Lanka', paymentTerms: 'Net 45', status: 'active', createdBy: admin._id },
    { name: 'Naseem Cycle & Moto', supplierCode: 'NCM-003', contactPerson: 'Naseem Ibrahim', email: 'support@naseemmoto.com', phone: '+94 77 333 0003', address: 'Temple Road', city: 'Galle', country: 'Sri Lanka', paymentTerms: 'Net 30', status: 'active', createdBy: manager._id },
    { name: 'Zahir Spare Line', supplierCode: 'ZSL-004', contactPerson: 'Zahir Ameen', email: 'procurement@zahirspareline.com', phone: '+94 77 444 0004', address: 'Lake Road', city: 'Kurunegala', country: 'Sri Lanka', paymentTerms: 'Net 60', status: 'active', createdBy: manager._id },
    { name: 'Rifai Bike Solutions', supplierCode: 'RBS-005', contactPerson: 'Rifai Shihab', email: 'ops@rifaibikesolutions.com', phone: '+94 77 555 0005', address: 'High Level Road', city: 'Matara', country: 'Sri Lanka', paymentTerms: 'Net 30', status: 'active', createdBy: storeKeeper._id },
  ]);

  const yamahaParts = [
    { productName: 'Yamaha R15 Front Brake Disc', sku: 'YAM-BRK-001', barcode: 'BAR-1001', category: categories[1]._id, supplier: suppliers[0]._id, description: 'Front brake disc for Yamaha R15 with strong heat resistance and smooth stopping power', unit: 'Piece', costPrice: 5200, sellingPrice: 7600, currentStock: 18, minimumStock: 6, maximumStock: 30, warehouseLocation: 'A-01', manufacturer: 'Yamaha', compatibleModels: 'R15 V2, R15 V3', serialNumber: 'SN-1001', warrantyPeriod: '6 months', image: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=500&q=80', isActive: true, createdBy: superAdmin._id, updatedBy: superAdmin._id },
    { productName: 'Yamaha MT-15 Spark Plug', sku: 'YAM-ELC-002', barcode: 'BAR-1002', category: categories[2]._id, supplier: suppliers[1]._id, description: 'Iridium spark plug designed for Yamaha MT-15 and R15 engines', unit: 'Piece', costPrice: 1400, sellingPrice: 2200, currentStock: 5, minimumStock: 4, maximumStock: 20, warehouseLocation: 'B-03', manufacturer: 'NGK', compatibleModels: 'MT-15, R15, FZ', serialNumber: 'SN-1002', warrantyPeriod: '12 months', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=500&q=80', isActive: true, createdBy: superAdmin._id, updatedBy: superAdmin._id },
    { productName: 'Yamaha FZ Clutch Cable', sku: 'YAM-ENG-003', barcode: 'BAR-1003', category: categories[0]._id, supplier: suppliers[2]._id, description: 'Premium clutch cable for Yamaha FZ and Fazer commuter bikes', unit: 'Piece', costPrice: 1200, sellingPrice: 1850, currentStock: 0, minimumStock: 5, maximumStock: 15, warehouseLocation: 'A-04', manufacturer: 'Yamaha', compatibleModels: 'FZ, Fazer, SZ-RR', serialNumber: 'SN-1003', warrantyPeriod: '6 months', image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=500&q=80', isActive: true, createdBy: superAdmin._id, updatedBy: superAdmin._id },
    { productName: 'Yamaha R3 Chain Kit', sku: 'YAM-ENG-004', barcode: 'BAR-1004', category: categories[0]._id, supplier: suppliers[3]._id, description: 'Complete chain kit with roller and links for Yamaha R3', unit: 'Set', costPrice: 3200, sellingPrice: 4500, currentStock: 10, minimumStock: 4, maximumStock: 20, warehouseLocation: 'A-02', manufacturer: 'Yamaha', compatibleModels: 'R3, R15, MT-15', serialNumber: 'SN-1004', warrantyPeriod: '12 months', image: 'https://images.unsplash.com/photo-1605714311812-0d1f6c0cd2a4?auto=format&fit=crop&w=500&q=80', isActive: true, createdBy: superAdmin._id, updatedBy: superAdmin._id },
    { productName: 'Yamaha FZS Headlight Unit', sku: 'YAM-ELE-005', barcode: 'BAR-1005', category: categories[2]._id, supplier: suppliers[4]._id, description: 'OEM style headlight assembly for Yamaha FZS and FZ bikes', unit: 'Piece', costPrice: 6500, sellingPrice: 9000, currentStock: 7, minimumStock: 3, maximumStock: 12, warehouseLocation: 'C-02', manufacturer: 'Yamaha', compatibleModels: 'FZS, FZ-S, FZ', serialNumber: 'SN-1005', warrantyPeriod: '12 months', image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=500&q=80', isActive: true, createdBy: superAdmin._id, updatedBy: superAdmin._id },
    { productName: 'Yamaha Fazer Fork Seal', sku: 'YAM-BDY-006', barcode: 'BAR-1006', category: categories[4]._id, supplier: suppliers[2]._id, description: 'Front fork oil seal for Yamaha Fazer suspension service', unit: 'Pair', costPrice: 1100, sellingPrice: 1600, currentStock: 12, minimumStock: 6, maximumStock: 18, warehouseLocation: 'B-05', manufacturer: 'Yamaha', compatibleModels: 'Fazer, FZ, R3', serialNumber: 'SN-1006', warrantyPeriod: '6 months', image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=500&q=80', isActive: true, createdBy: superAdmin._id, updatedBy: superAdmin._id },
    { productName: 'Yamaha R15 Brake Lever', sku: 'YAM-BRK-007', barcode: 'BAR-1007', category: categories[1]._id, supplier: suppliers[0]._id, description: 'Aluminum brake lever for Yamaha R15 and MT-15', unit: 'Piece', costPrice: 2200, sellingPrice: 3100, currentStock: 9, minimumStock: 4, maximumStock: 15, warehouseLocation: 'A-03', manufacturer: 'Yamaha', compatibleModels: 'R15, MT-15, FZS', serialNumber: 'SN-1007', warrantyPeriod: '12 months', image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=500&q=80', isActive: true, createdBy: superAdmin._id, updatedBy: superAdmin._id },
    { productName: 'Yamaha YZF Battery 12V', sku: 'YAM-ELE-008', barcode: 'BAR-1008', category: categories[2]._id, supplier: suppliers[1]._id, description: '12V sealed maintenance-free battery for Yamaha sport bikes', unit: 'Piece', costPrice: 7800, sellingPrice: 10400, currentStock: 4, minimumStock: 3, maximumStock: 10, warehouseLocation: 'C-01', manufacturer: 'Exide', compatibleModels: 'FZ, R15, Saluto', serialNumber: 'SN-1008', warrantyPeriod: '12 months', image: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=500&q=80', isActive: true, createdBy: superAdmin._id, updatedBy: superAdmin._id },
    { productName: 'Yamaha R15 Oil Filter', sku: 'YAM-ENG-009', barcode: 'BAR-1009', category: categories[0]._id, supplier: suppliers[3]._id, description: 'Engine oil filter for Yamaha 150cc and 200cc bikes', unit: 'Piece', costPrice: 650, sellingPrice: 980, currentStock: 15, minimumStock: 5, maximumStock: 25, warehouseLocation: 'A-05', manufacturer: 'Yamaha', compatibleModels: 'R15, FZ, Fazer', serialNumber: 'SN-1009', warrantyPeriod: '6 months', image: 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=500&q=80', isActive: true, createdBy: superAdmin._id, updatedBy: superAdmin._id },
    { productName: 'Yamaha MT-15 Rear Shock', sku: 'YAM-BDY-010', barcode: 'BAR-1010', category: categories[4]._id, supplier: suppliers[4]._id, description: 'Rear shock absorber for Yamaha MT-15 and R15', unit: 'Piece', costPrice: 5600, sellingPrice: 7600, currentStock: 3, minimumStock: 2, maximumStock: 10, warehouseLocation: 'B-04', manufacturer: 'Yamaha', compatibleModels: 'MT-15, R15, FZ', serialNumber: 'SN-1010', warrantyPeriod: '12 months', image: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=500&q=80', isActive: true, createdBy: superAdmin._id, updatedBy: superAdmin._id },
  ];

  await Product.create(yamahaParts);

  console.log('Seed completed successfully');
  await mongoose.disconnect();
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
