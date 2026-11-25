import mongoose from 'mongoose';
import { addSampleDataIndex, sampleDataFields } from '../utils/sampleDataFields.js';

const saleSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, immutable: true },
    invoiceNumber: { type: String, trim: true, maxlength: 64 },
    invoiceTotal: { type: Number, min: 0 },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, min: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    taxRate: { type: Number, min: 0, max: 100, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    invoiceSubtotal: { type: Number, min: 0 },
    invoiceDiscountAmount: { type: Number, min: 0, default: 0 },
    invoiceTaxRate: { type: Number, min: 0, max: 100, default: 0 },
    invoiceTaxAmount: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Partial'], default: 'Paid' },
    idempotencyKey: { type: String, trim: true, maxlength: 128 },
    saleDate: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    testSuite: { type: String, enum: ['synthetic', 'integration'], immutable: true },
    testRunId: { type: String, trim: true, immutable: true },
    ...sampleDataFields(),
  },
  { timestamps: true },
);

saleSchema.pre('validate', function validateSaleTotals() {
  if (this.subtotal === undefined) return;

  const expectedTotal = Math.round((
    Number(this.subtotal) - Number(this.discountAmount || 0) + Number(this.taxAmount || 0) + Number.EPSILON
  ) * 100) / 100;
  if (this.discountAmount > this.subtotal || !Number.isFinite(expectedTotal)
    || Math.abs(this.totalAmount - expectedTotal) > 1e-8) {
    this.invalidate('totalAmount', 'Sale line total must equal subtotal minus discount plus tax');
  }
  if (this.invoiceSubtotal !== undefined) {
    const expectedInvoiceTotal = Math.round((
      Number(this.invoiceSubtotal)
      - Number(this.invoiceDiscountAmount || 0)
      + Number(this.invoiceTaxAmount || 0)
      + Number.EPSILON
    ) * 100) / 100;
    if (this.invoiceDiscountAmount > this.invoiceSubtotal
      || !Number.isFinite(expectedInvoiceTotal)
      || Math.abs(this.invoiceTotal - expectedInvoiceTotal) > 1e-8) {
      this.invalidate('invoiceTotal', 'Invoice total must equal subtotal minus discount plus tax');
    }
  }
});

saleSchema.index({ workspaceId: 1, saleDate: -1, _id: -1 });
saleSchema.index(
  { workspaceId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
saleSchema.index(
  { workspaceId: 1, invoiceNumber: 1 },
  { partialFilterExpression: { invoiceNumber: { $type: 'string' } } },
);
addSampleDataIndex(saleSchema);

const Sale = mongoose.model('Sale', saleSchema);
export default Sale;
