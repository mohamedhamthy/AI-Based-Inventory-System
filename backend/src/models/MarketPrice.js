import mongoose from 'mongoose';
import { addSampleDataIndex, sampleDataFields } from '../utils/sampleDataFields.js';

const marketPriceSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, immutable: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, immutable: true, index: true },
    productName: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0.01 },
    source: { type: String, required: true, trim: true, maxlength: 120 },
    priceType: { type: String, enum: ['Retail', 'Wholesale', 'Online', 'Other'], required: true },
    currency: { type: String, enum: ['LKR'], default: 'LKR', required: true },
    recordedAt: { type: Date, required: true, index: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    testSuite: { type: String, enum: ['synthetic', 'integration'], immutable: true },
    testRunId: { type: String, trim: true, immutable: true },
    ...sampleDataFields(),
  },
  { timestamps: true },
);

marketPriceSchema.index({ workspaceId: 1, product: 1, priceType: 1, recordedAt: -1 });
addSampleDataIndex(marketPriceSchema);

const MarketPrice = mongoose.model('MarketPrice', marketPriceSchema);
export default MarketPrice;
