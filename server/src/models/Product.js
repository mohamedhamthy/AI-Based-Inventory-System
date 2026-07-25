import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true, trim: true, index: true },
    sku: { type: String, required: true, unique: true, trim: true, index: true },
    barcode: { type: String, unique: true, sparse: true, trim: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    description: { type: String, trim: true },
    unit: { type: String, default: 'Unit' },
    costPrice: { type: Number, min: 0, default: 0 },
    sellingPrice: { type: Number, min: 0, default: 0 },
    currentStock: { type: Number, min: 0, default: 0 },
    minimumStock: { type: Number, min: 0, default: 0 },
    maximumStock: { type: Number, min: 0, default: 0 },
    warehouseLocation: { type: String, trim: true },
    manufacturer: { type: String, trim: true },
    compatibleModels: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    warrantyPeriod: { type: String, trim: true },
    image: { type: String },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

productSchema.virtual('stockStatus').get(function () {
  if (!this.isActive) return 'Inactive';
  if (this.currentStock === 0) return 'Out of Stock';
  if (this.currentStock <= this.minimumStock) return 'Low Stock';
  return 'In Stock';
});

productSchema.index({ productName: 1, createdAt: -1 });
productSchema.index({ category: 1, supplier: 1, createdAt: -1 });

const Product = mongoose.model('Product', productSchema);
export default Product;
