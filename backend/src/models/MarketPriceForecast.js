import mongoose from 'mongoose';
import { addSampleDataIndex, sampleDataFields } from '../utils/sampleDataFields.js';

const forecastPointSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    predictedPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const marketPriceForecastSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, immutable: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, immutable: true, index: true },
    productName: { type: String, required: true },
    priceType: { type: String, enum: ['Retail', 'Wholesale', 'Online', 'Other'], required: true },
    forecastPeriod: { type: Number, enum: [7, 30, 60], required: true },
    status: { type: String, enum: ['reliable', 'insufficient_data'], required: true },
    predictedPrice: { type: Number, min: 0, default: null },
    trend: { type: String, enum: ['Increasing', 'Decreasing', 'Stable'], default: 'Stable' },
    changeAmount: { type: Number, default: null },
    percentageChange: { type: Number, default: null },
    recommendation: { type: String, enum: ['Buy Now', 'Wait', 'Monitor Price'], default: 'Monitor Price' },
    metrics: {
      mae: { type: Number, default: null },
      rmse: { type: Number, default: null },
      mape: { type: Number, default: null },
      confidence: { type: Number, min: 0, max: 100, default: 0 },
      observations: { type: Number, default: 0 },
      trainingObservations: { type: Number, default: 0 },
      testingObservations: { type: Number, default: 0 },
      model: { type: String, default: null },
      validationMethod: { type: String, default: null },
    },
    dataQualityWarnings: { type: [String], default: [] },
    forecastPoints: { type: [forecastPointSchema], default: [] },
    generatedAt: { type: Date, default: Date.now, required: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    testSuite: { type: String, enum: ['synthetic', 'integration'], immutable: true },
    testRunId: { type: String, trim: true, immutable: true },
    ...sampleDataFields(),
  },
  { timestamps: true },
);

marketPriceForecastSchema.index({ workspaceId: 1, product: 1, priceType: 1, generatedAt: -1 });
addSampleDataIndex(marketPriceForecastSchema);

const MarketPriceForecast = mongoose.model('MarketPriceForecast', marketPriceForecastSchema);
export default MarketPriceForecast;
