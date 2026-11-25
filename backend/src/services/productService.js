import Product from '../models/Product.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import AppError from '../utils/AppError.js';
import { runInventoryTransaction } from './inventoryService.js';

const outstandingPurchaseOrderStatuses = ['draft', 'ordered', 'partially_received'];

export const deactivateProduct = async ({
  productId,
  workspaceId,
  userId,
}, {
  ProductModel = Product,
  PurchaseOrderModel = PurchaseOrder,
  transaction = runInventoryTransaction,
} = {}) => transaction(async (session) => {
  const productQuery = ProductModel.findOne({ _id: productId, workspaceId });
  const product = await productQuery.session(session);
  if (!product) throw new AppError('Product not found', 404);
  if (!product.isActive) return product;

  const deactivatedProduct = await ProductModel.findOneAndUpdate(
    { _id: productId, workspaceId, isActive: true },
    {
      $set: { isActive: false, updatedBy: userId },
      $inc: { purchaseOrderGuardVersion: 1 },
    },
    { new: true, runValidators: true, session },
  );
  if (!deactivatedProduct) {
    throw new AppError('Product status changed; reload before deactivating', 409);
  }

  const purchaseOrders = await PurchaseOrderModel.find({
    workspaceId,
    status: { $in: outstandingPurchaseOrderStatuses },
    'items.product': product._id,
  }).select('items').session(session);
  const productIdString = String(product._id).toLowerCase();
  const hasOutstandingOrder = purchaseOrders.some((purchaseOrder) => (
    purchaseOrder.items.some((item) => (
      String(item.product?._id || item.product).toLowerCase() === productIdString
      && item.orderedQuantity > (item.receivedQuantity || 0)
    ))
  ));
  if (hasOutstandingOrder) {
    throw new AppError(
      'Product cannot be deactivated because it has an outstanding Purchase Order',
      409,
      null,
      'PRODUCT_HAS_OUTSTANDING_PURCHASE_ORDER',
    );
  }

  return deactivatedProduct;
});
