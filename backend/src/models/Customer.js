import mongoose from 'mongoose';
import { addSampleDataIndex, sampleDataFields } from '../utils/sampleDataFields.js';

const customerSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, immutable: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 40 },
    address: { type: String, trim: true, maxlength: 300 },
    notes: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    ...sampleDataFields(),
  },
  { timestamps: true },
);

customerSchema.index({ workspaceId: 1, isActive: 1, name: 1 });
addSampleDataIndex(customerSchema);

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;
