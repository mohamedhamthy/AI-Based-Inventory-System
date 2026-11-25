import mongoose from 'mongoose';
import { addSampleDataIndex, sampleDataFields } from '../utils/sampleDataFields.js';

const supplierSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, immutable: true },
    name: { type: String, required: true, trim: true },
    supplierCode: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    alternatePhone: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    country: { type: String, trim: true },
    taxNumber: { type: String, trim: true },
    paymentTerms: { type: String, trim: true },
    leadTimeDays: { type: Number, min: 0, max: 365, default: 7 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    notes: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    testSuite: { type: String, enum: ['synthetic', 'integration'], immutable: true },
    testRunId: { type: String, trim: true, immutable: true },
    ...sampleDataFields(),
  },
  { timestamps: true },
);

supplierSchema.index({ name: 1, createdAt: -1 });
supplierSchema.index({ workspaceId: 1, supplierCode: 1 }, { unique: true });
addSampleDataIndex(supplierSchema);

const Supplier = mongoose.model('Supplier', supplierSchema);
export default Supplier;
