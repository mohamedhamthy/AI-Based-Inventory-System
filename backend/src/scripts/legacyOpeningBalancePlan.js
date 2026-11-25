const sameQuantity = (left, right) => Math.abs(left - right) <= 1e-8;

export const buildLegacyOpeningBalancePlan = ({ products, movementsByProduct }) => {
  const openingMovements = [];
  const errors = [];

  for (const product of products) {
    const movements = movementsByProduct.get(String(product._id)) || [];
    const firstMovement = movements[0];
    const openingQuantity = firstMovement
      ? Number(firstMovement.stockBefore)
      : Number(product.currentStock);
    if (!Number.isFinite(openingQuantity) || openingQuantity < 0) {
      errors.push(`${product.sku}: opening balance is not a non-negative number`);
      continue;
    }

    if (openingQuantity > 0) {
      let occurredAt = new Date(product.createdAt);
      if (firstMovement && occurredAt >= new Date(firstMovement.createdAt)) {
        occurredAt = new Date(new Date(firstMovement.createdAt).getTime() - 1);
      }
      openingMovements.push({
        product: product._id,
        productName: product.productName,
        sku: product.sku,
        quantity: openingQuantity,
        occurredAt,
      });
    }

    let balance = openingQuantity;
    for (const movement of movements) {
      if (!sameQuantity(Number(movement.stockBefore), balance)) {
        errors.push(`${product.sku}: movement chain starts at ${movement.stockBefore}, expected ${balance}`);
        break;
      }
      const quantity = Number(movement.quantity);
      let expectedAfter;
      if (movement.movementType === 'stock_in') expectedAfter = balance + quantity;
      else if (movement.movementType === 'sale') expectedAfter = balance - quantity;
      else if (movement.movementType === 'adjustment') expectedAfter = Number(movement.stockAfter);
      else {
        errors.push(`${product.sku}: unsupported movement type ${movement.movementType}`);
        break;
      }
      if (!Number.isFinite(expectedAfter) || expectedAfter < 0
        || !sameQuantity(Number(movement.stockAfter), expectedAfter)) {
        errors.push(`${product.sku}: invalid ${movement.movementType} movement`);
        break;
      }
      balance = expectedAfter;
    }
    if (!sameQuantity(balance, Number(product.currentStock))) {
      errors.push(`${product.sku}: ledger closes at ${balance}, product stock is ${product.currentStock}`);
    }
  }

  return { openingMovements, errors };
};
