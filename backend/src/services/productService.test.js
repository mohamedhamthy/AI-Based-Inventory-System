import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deactivateProduct } from './productService.js';

const workspaceId = '64b000000000000000000010';
const otherWorkspaceId = '64b000000000000000000099';
const productId = '64b000000000000000000030';
const userId = '64b000000000000000000050';
const session = { id: 'product-deactivation-session' };

const createDatabase = ({ purchaseOrders = [], productWorkspace = workspaceId } = {}) => {
  const product = {
    _id: productId,
    workspaceId: productWorkspace,
    isActive: true,
    purchaseOrderGuardVersion: 0,
  };
  const query = (value) => ({
    select() { return this; },
    session(usedSession) {
      assert.equal(usedSession, session);
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  });
  const ProductModel = {
    findOne(filter) {
      return query(
        String(filter._id) === product._id && filter.workspaceId === product.workspaceId
          ? product
          : null,
      );
    },
    async findOneAndUpdate(filter, update, options) {
      assert.equal(options.session, session);
      if (String(filter._id) !== product._id || filter.workspaceId !== product.workspaceId
        || (filter.isActive && !product.isActive)) return null;
      Object.assign(product, update.$set);
      product.purchaseOrderGuardVersion += update.$inc.purchaseOrderGuardVersion;
      return product;
    },
  };
  const PurchaseOrderModel = {
    find(filter) {
      const candidates = purchaseOrders.filter((order) => (
        order.workspaceId === filter.workspaceId
        && filter.status.$in.includes(order.status)
        && order.items.some((item) => String(item.product) === String(productId))
      ));
      return query(candidates);
    },
  };
  const transaction = async (operation) => {
    const before = { ...product };
    try {
      return await operation(session);
    } catch (error) {
      Object.assign(product, before);
      throw error;
    }
  };

  return { product, ProductModel, PurchaseOrderModel, transaction };
};

const pendingOrder = (status, receivedQuantity = 0, orderWorkspaceId = workspaceId) => ({
  workspaceId: orderWorkspaceId,
  status,
  items: [{ product: productId, orderedQuantity: 5, receivedQuantity }],
});

const deactivate = (database) => deactivateProduct({
  productId,
  workspaceId,
  userId,
}, {
  ProductModel: database.ProductModel,
  PurchaseOrderModel: database.PurchaseOrderModel,
  transaction: database.transaction,
});

for (const status of ['draft', 'ordered', 'partially_received']) {
  test(`product with outstanding ${status} purchase order cannot be deactivated`, async () => {
    const database = createDatabase({ purchaseOrders: [pendingOrder(status, 2)] });
    await assert.rejects(deactivate(database), (error) => (
      error.statusCode === 409
      && error.message === 'Product cannot be deactivated because it has an outstanding Purchase Order'
    ));
    assert.equal(database.product.isActive, true);
    assert.equal(database.product.purchaseOrderGuardVersion, 0);
  });
}

test('fully received and cancelled purchase orders do not block deactivation', async () => {
  const database = createDatabase({
    purchaseOrders: [
      pendingOrder('received', 5),
      pendingOrder('cancelled'),
    ],
  });
  await deactivate(database);
  assert.equal(database.product.isActive, false);
});

test('a product with no outstanding purchase orders can be deactivated', async () => {
  const database = createDatabase();
  await deactivate(database);
  assert.equal(database.product.isActive, false);
});

test('purchase orders in another workspace do not block product deactivation', async () => {
  const database = createDatabase({
    purchaseOrders: [pendingOrder('ordered', 0, otherWorkspaceId)],
  });
  await deactivate(database);
  assert.equal(database.product.isActive, false);
});
