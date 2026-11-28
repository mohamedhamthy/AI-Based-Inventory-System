import mongoose from "mongoose";
import { createHash } from "node:crypto";
import Product from "../models/Product.js";
import Sale from "../models/Sale.js";
import StockMovement from "../models/StockMovement.js";
import Customer from "../models/Customer.js";
import AppError from "../utils/AppError.js";

export const TRANSACTION_SUPPORT_ERROR =
  "Inventory changes require MongoDB transactions, which are available on replica sets or sharded clusters. Configure the database accordingly; no stock operation was committed.";

const isTransactionUnsupported = (error) =>
  (error?.code === 20 || error?.codeName === "IllegalOperation") &&
  /Transaction numbers are only allowed on a replica set member or mongos/i.test(
    error.message || "",
  );

export const runInventoryTransaction = async (
  operation,
  {
    mongooseInstance = mongoose,
    unsupportedMessage = TRANSACTION_SUPPORT_ERROR,
  } = {},
) => {
  let session;
  try {
    session = await mongooseInstance.startSession();
    let result;
    await session.withTransaction(
      async () => {
        result = await operation(session);
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        readPreference: "primary",
      },
    );
    return result;
  } catch (error) {
    if (isTransactionUnsupported(error)) {
      throw new AppError(unsupportedMessage, 503);
    }
    throw error;
  } finally {
    if (session) await session.endSession();
  }
};

const normalizeQuantity = (value, label = "Quantity") => {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    throw new AppError(`${label} must be a positive number`, 400);
  }
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError(`${label} must be a positive number`, 400);
  }
  return quantity;
};

const normalizeOptionalText = (value, label, maxLength) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw new AppError(
      `${label} must be a string of at most ${maxLength} characters`,
      400,
    );
  }
  return value.trim() || undefined;
};

const normalizeNonNegativeAmount = (value, label) => {
  if (value === undefined || value === null) return 0;
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    throw new AppError(`${label} must be a non-negative amount`, 400);
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError(`${label} must be a non-negative amount`, 400);
  }
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

const allocateMoney = (amount, weights) => {
  const cents = Math.round(amount * 100);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (cents === 0 || totalWeight === 0) return weights.map(() => 0);

  let allocatedCents = 0;
  return weights.map((weight, index) => {
    const share =
      index === weights.length - 1
        ? cents - allocatedCents
        : Math.floor((cents * weight) / totalWeight);
    allocatedCents += share;
    return share / 100;
  });
};

const normalizeIdempotencyKey = (value, required = false) => {
  const key = typeof value === "string" ? value.trim() : "";
  if (
    (!key && required) ||
    key.length > 128 ||
    (key && key.length < 8) ||
    (key && !/^[A-Za-z0-9._:-]+$/.test(key))
  ) {
    throw new AppError(
      "A valid Idempotency-Key between 8 and 128 characters is required",
      400,
    );
  }
  return key || undefined;
};

const IDEMPOTENCY_REPLAY_CODE = "IDEMPOTENCY_KEY_ALREADY_USED";
const IDEMPOTENCY_REPLAY_MESSAGE =
  "This Idempotency-Key has already been processed.";

const createIdempotencyReplayError = () =>
  new AppError(IDEMPOTENCY_REPLAY_MESSAGE, 409, null, IDEMPOTENCY_REPLAY_CODE);

const asDuplicateOperationError = (error) => {
  if (error?.code === 11000) {
    return createIdempotencyReplayError();
  }
  return error;
};

const findProduct = async (ProductModel, filter, session) =>
  ProductModel.findOne(filter).session(session);

const saveMovement = async (
  MovementModel,
  movementData,
  session,
  occurredAt,
) => {
  const movement = new MovementModel(movementData);
  if (occurredAt) {
    movement.createdAt = occurredAt;
    movement.updatedAt = occurredAt;
    await movement.save({ session, timestamps: false });
  } else {
    await movement.save({ session });
  }
  return movement;
};

export const receiveStockWithinTransaction = async (
  {
    workspaceId,
    productId,
    quantity: requestedQuantity,
    reference,
    reason,
    userId,
    idempotencyKey,
    occurredAt,
    sampleData = {},
    session,
  },
  {
    ProductModel = Product,
    MovementModel = StockMovement,
    testOwnership = {},
  } = {},
) => {
  const quantity = normalizeQuantity(requestedQuantity);
  const cleanReference = normalizeOptionalText(reference, "Reference", 120);
  const cleanReason = normalizeOptionalText(reason, "Reason", 500);
  const key = normalizeIdempotencyKey(idempotencyKey, true);
  const product = await findProduct(
    ProductModel,
    {
      _id: productId,
      workspaceId,
      isActive: true,
    },
    session,
  );
  if (!product)
    throw new AppError("Part not found in the current workspace", 404);

  const stockBefore = Number(product.currentStock);
  const stockAfter = stockBefore + quantity;
  if (!Number.isFinite(stockAfter))
    throw new AppError("Stock receipt quantity is too large", 400);
  const updatedProduct = await ProductModel.findOneAndUpdate(
    {
      _id: product._id,
      workspaceId,
      isActive: true,
      currentStock: stockBefore,
    },
    { $inc: { currentStock: quantity }, $set: { updatedBy: userId } },
    { new: true, runValidators: true, session },
  );
  if (!updatedProduct)
    throw new AppError(
      "Stock changed during receipt; retry the operation",
      409,
    );

  const movement = await saveMovement(
    MovementModel,
    {
      workspaceId,
      product: product._id,
      movementType: "stock_in",
      quantity,
      stockBefore,
      stockAfter,
      reference: cleanReference,
      reason: cleanReason || "Stock received",
      performedBy: userId,
      idempotencyKey: key,
      ...testOwnership,
      ...sampleData,
    },
    session,
    occurredAt,
  );

  return { product: updatedProduct, movement };
};

export const receiveStock = async (
  {
    workspaceId,
    productId,
    quantity: requestedQuantity,
    reference,
    reason,
    userId,
    idempotencyKey,
    occurredAt,
    sampleData = {},
  },
  {
    ProductModel = Product,
    MovementModel = StockMovement,
    transaction = runInventoryTransaction,
    testOwnership = {},
  } = {},
) => {
  const quantity = normalizeQuantity(requestedQuantity);
  try {
    return await transaction(async (session) => {
      return receiveStockWithinTransaction(
        {
          workspaceId,
          productId,
          quantity,
          reference,
          reason,
          userId,
          idempotencyKey,
          occurredAt,
          sampleData,
          session,
        },
        { ProductModel, MovementModel, testOwnership },
      );
    });
  } catch (error) {
    throw asDuplicateOperationError(error);
  }
};

export const adjustStock = async (
  {
    workspaceId,
    productId,
    quantity: requestedQuantity,
    direction,
    reference,
    reason,
    userId,
    idempotencyKey,
    occurredAt,
  },
  {
    ProductModel = Product,
    MovementModel = StockMovement,
    transaction = runInventoryTransaction,
  } = {},
) => {
  const quantity = normalizeQuantity(requestedQuantity);
  if (!["increase", "decrease"].includes(direction)) {
    throw new AppError(
      "Adjustment direction must be increase or decrease",
      400,
    );
  }
  const cleanReference = normalizeOptionalText(reference, "Reference", 120);
  const cleanReason = normalizeOptionalText(reason, "Reason", 500);
  const key = normalizeIdempotencyKey(idempotencyKey, true);

  try {
    return await transaction(async (session) => {
      const product = await findProduct(
        ProductModel,
        {
          _id: productId,
          workspaceId,
          isActive: true,
        },
        session,
      );
      if (!product)
        throw new AppError("Part not found in the current workspace", 404);

      const stockBefore = Number(product.currentStock);
      const stockDelta = direction === "increase" ? quantity : -quantity;
      const stockAfter = stockBefore + stockDelta;
      if (!Number.isFinite(stockAfter))
        throw new AppError("Stock adjustment quantity is too large", 400);
      if (stockAfter < 0)
        throw new AppError(
          "Stock adjustment cannot reduce inventory below zero",
          400,
        );

      const updatedProduct = await ProductModel.findOneAndUpdate(
        {
          _id: product._id,
          workspaceId,
          isActive: true,
          currentStock: stockBefore,
        },
        { $inc: { currentStock: stockDelta }, $set: { updatedBy: userId } },
        { new: true, runValidators: true, session },
      );
      if (!updatedProduct)
        throw new AppError(
          "Stock changed during adjustment; retry the operation",
          409,
        );

      const movement = await saveMovement(
        MovementModel,
        {
          workspaceId,
          product: product._id,
          movementType: "adjustment",
          quantity,
          stockBefore,
          stockAfter,
          reference: cleanReference,
          reason: cleanReason || "Manual stock adjustment",
          performedBy: userId,
          idempotencyKey: key,
        },
        session,
        occurredAt,
      );

      return { product: updatedProduct, movement };
    });
  } catch (error) {
    throw asDuplicateOperationError(error);
  }
};

export const setProductStock = async (
  {
    workspaceId,
    productId,
    stockAfter: requestedStock,
    changes = {},
    clearBarcode = false,
    clearOemPartNumber = false,
    reference,
    reason,
    userId,
  },
  {
    ProductModel = Product,
    MovementModel = StockMovement,
    transaction = runInventoryTransaction,
  } = {},
) => {
  if (
    typeof requestedStock !== "number" &&
    (typeof requestedStock !== "string" || !requestedStock.trim())
  ) {
    throw new AppError("Current stock must be zero or greater", 400);
  }
  const stockAfter = Number(requestedStock);
  if (!Number.isFinite(stockAfter) || stockAfter < 0) {
    throw new AppError("Current stock must be zero or greater", 400);
  }
  const cleanReference = normalizeOptionalText(reference, "Reference", 120);
  const cleanReason = normalizeOptionalText(reason, "Reason", 500);

  return transaction(async (session) => {
    const product = await findProduct(
      ProductModel,
      {
        _id: productId,
        workspaceId,
        isActive: true,
      },
      session,
    );
    if (!product) throw new AppError("Part not found", 404);

    const stockBefore = Number(product.currentStock);
    const update = { ...changes, currentStock: stockAfter, updatedBy: userId };
    Object.assign(product, update);
    if (clearBarcode) product.set("barcode", undefined);
    if (clearOemPartNumber) product.set("oemPartNumber", undefined);
    await product.save({ session });

    let movement = null;
    if (stockAfter !== stockBefore) {
      movement = await saveMovement(
        MovementModel,
        {
          workspaceId,
          product: product._id,
          movementType: "adjustment",
          quantity: Math.abs(stockAfter - stockBefore),
          stockBefore,
          stockAfter,
          reference: cleanReference,
          reason:
            cleanReason || "Stock quantity changed through product update",
          performedBy: userId,
        },
        session,
      );
    }

    return { product, movement };
  });
};

export const createProductWithOpeningStock = async (
  productData,
  {
    ProductModel = Product,
    MovementModel = StockMovement,
    transaction = runInventoryTransaction,
    occurredAt,
    sampleData = {},
  } = {},
) =>
  transaction(async (session) => {
    const product = new ProductModel(productData);
    await product.save({ session });

    const stockAfter = Number(product.currentStock || 0);
    let movement = null;
    if (stockAfter > 0) {
      movement = await saveMovement(
        MovementModel,
        {
          workspaceId: product.workspaceId,
          product: product._id,
          movementType: "stock_in",
          quantity: stockAfter,
          stockBefore: 0,
          stockAfter,
          reason: "Opening stock recorded when product was created",
          performedBy: productData.createdBy,
          ...sampleData,
        },
        session,
        occurredAt,
      );
    }
    return { product, movement };
  });

export const recordSale = async (
  {
    workspaceId,
    items: requestedItems,
    productId,
    quantity: requestedQuantity,
    unitPrice: requestedUnitPrice,
    customerId,
    customerName,
    phone,
    paymentStatus,
    notes,
    userId,
    idempotencyKey,
    invoiceNumber: requestedInvoiceNumber,
    saleDate: requestedSaleDate,
    discountAmount: requestedDiscountAmount,
    taxRate: requestedTaxRate,
    sampleData = {},
  },
  {
    ProductModel = Product,
    SaleModel = Sale,
    MovementModel = StockMovement,
    CustomerModel = Customer,
    transaction = runInventoryTransaction,
    testOwnership = {},
  } = {},
) => {
  const items = (
    Array.isArray(requestedItems)
      ? requestedItems
      : [
          {
            productId,
            quantity: requestedQuantity,
            unitPrice: requestedUnitPrice,
          },
        ]
  ).map((item) => {
    const quantity = normalizeQuantity(item.quantity);
    if (quantity < 1) throw new AppError("Quantity must be at least 1", 400);
    if (
      typeof item.unitPrice !== "number" &&
      (typeof item.unitPrice !== "string" || !item.unitPrice.trim())
    ) {
      throw new AppError("Unit price must be zero or greater", 400);
    }
    const unitPrice = Number(item.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new AppError("Unit price must be zero or greater", 400);
    }
    const totalAmount = quantity * unitPrice;
    if (!Number.isFinite(totalAmount))
      throw new AppError("Sale total is outside the supported range", 400);
    return { productId: item.productId, quantity, unitPrice, totalAmount };
  });
  if (items.length < 1 || items.length > 50) {
    throw new AppError(
      "An invoice must contain between 1 and 50 product lines",
      400,
    );
  }
  const productIds = items.map(({ productId: id }) => String(id));
  if (new Set(productIds).size !== productIds.length) {
    throw new AppError("A product may only appear once on an invoice", 400);
  }
  if (
    !customerId &&
    (typeof customerName !== "string" || customerName.trim().length < 1)
  ) {
    throw new AppError("Customer name is required", 400);
  }
  const key = normalizeIdempotencyKey(idempotencyKey, true);
  const invoiceNumber =
    typeof requestedInvoiceNumber === "string" && requestedInvoiceNumber.trim()
      ? requestedInvoiceNumber.trim()
      : `INV-${createHash("sha256").update(`${workspaceId}:${key}`).digest("hex").slice(0, 16).toUpperCase()}`;
  if (invoiceNumber.length > 64)
    throw new AppError("Invoice number must be 64 characters or fewer", 400);
  const saleDate =
    requestedSaleDate === undefined ? undefined : new Date(requestedSaleDate);
  if (saleDate && !Number.isFinite(saleDate.getTime()))
    throw new AppError("Sale date must be valid", 400);
  const invoiceSubtotal =
    Math.round(
      (items.reduce((total, item) => total + item.totalAmount, 0) +
        Number.EPSILON) *
        100,
    ) / 100;
  if (!Number.isFinite(invoiceSubtotal))
    throw new AppError("Invoice subtotal is outside the supported range", 400);
  const invoiceDiscountAmount = normalizeNonNegativeAmount(
    requestedDiscountAmount,
    "Discount",
  );
  if (invoiceDiscountAmount > invoiceSubtotal)
    throw new AppError("Discount cannot exceed the invoice subtotal", 400);
  const invoiceTaxRate =
    requestedTaxRate === undefined || requestedTaxRate === null
      ? 0
      : Number(requestedTaxRate);
  if (
    !Number.isFinite(invoiceTaxRate) ||
    invoiceTaxRate < 0 ||
    invoiceTaxRate > 100
  ) {
    throw new AppError("Tax rate must be between 0 and 100 percent", 400);
  }
  const invoiceTaxAmount =
    Math.round(
      (((invoiceSubtotal - invoiceDiscountAmount) * invoiceTaxRate) / 100 +
        Number.EPSILON) *
        100,
    ) / 100;
  const invoiceDiscounts = allocateMoney(
    invoiceDiscountAmount,
    items.map((item) => item.totalAmount),
  );
  const taxableLineSubtotals = items.map(
    (item, index) => item.totalAmount - invoiceDiscounts[index],
  );
  const invoiceTaxes = allocateMoney(invoiceTaxAmount, taxableLineSubtotals);
  const invoiceTotal =
    Math.round(
      (invoiceSubtotal -
        invoiceDiscountAmount +
        invoiceTaxAmount +
        Number.EPSILON) *
        100,
    ) / 100;

  try {
    return await transaction(async (session) => {
      let customer;
      if (customerId) {
        customer = await CustomerModel.findOne({
          _id: customerId,
          workspaceId,
          isActive: true,
        }).session(session);
        if (!customer)
          throw new AppError(
            "Active customer not found in the current workspace",
            404,
          );
      }

      const sales = [];
      const movements = [];
      let lastProduct = null;
      for (const [index, item] of items.entries()) {
        const lineKey =
          items.length === 1
            ? key
            : createHash("sha256").update(`${key}:${index}`).digest("hex");
        const existingSale = await SaleModel.findOne({
          workspaceId,
          idempotencyKey: lineKey,
        }).session(session);
        if (existingSale) throw createIdempotencyReplayError();

        const product = await findProduct(
          ProductModel,
          {
            _id: item.productId,
            workspaceId,
            isActive: true,
          },
          session,
        );
        if (!product)
          throw new AppError("Part not found in the current workspace", 404);

        const stockBefore = Number(product.currentStock);
        if (stockBefore < item.quantity)
          throw new AppError(
            `Not enough stock for ${product.productName || "this part"}`,
            400,
          );
        const stockAfter = stockBefore - item.quantity;
        const updatedProduct = await ProductModel.findOneAndUpdate(
          {
            _id: product._id,
            workspaceId,
            isActive: true,
            currentStock: stockBefore,
          },
          {
            $inc: { currentStock: -item.quantity },
            $set: { updatedBy: userId },
          },
          { new: true, runValidators: true, session },
        );
        if (!updatedProduct)
          throw new AppError(
            "Stock changed during sale; retry the operation",
            409,
          );

        const lineSampleData = sampleData.sampleDatasetId
          ? {
              ...sampleData,
              sampleRecordKey: `${sampleData.sampleRecordKey || invoiceNumber}:line:${index + 1}`,
            }
          : {};
        const sale = new SaleModel({
          invoiceNumber,
          invoiceTotal,
          customer: customer?._id,
          customerName: customer?.name || customerName.trim(),
          phone: customer?.phone || phone,
          workspaceId,
          product: product._id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.totalAmount,
          discountAmount: invoiceDiscounts[index],
          taxRate: invoiceTaxRate,
          taxAmount: invoiceTaxes[index],
          invoiceSubtotal,
          invoiceDiscountAmount,
          invoiceTaxRate,
          invoiceTaxAmount,
          totalAmount:
            item.totalAmount - invoiceDiscounts[index] + invoiceTaxes[index],
          paymentStatus: paymentStatus || "Paid",
          notes,
          ...(saleDate ? { saleDate } : {}),
          createdBy: userId,
          idempotencyKey: lineKey,
          ...testOwnership,
          ...lineSampleData,
        });
        await sale.save({ session });

        const movement = await saveMovement(
          MovementModel,
          {
            workspaceId,
            product: product._id,
            movementType: "sale",
            quantity: item.quantity,
            stockBefore,
            stockAfter,
            reference: invoiceNumber,
            reason: `Stock issued for invoice ${invoiceNumber}`,
            performedBy: userId,
            sale: sale._id,
            idempotencyKey: lineKey,
            ...testOwnership,
            ...lineSampleData,
          },
          session,
          saleDate,
        );
        sales.push(sale);
        movements.push(movement);
        lastProduct = updatedProduct;
      }

      return {
        sale: sales[0],
        sales,
        product: lastProduct,
        movement: movements[0],
        movements,
        invoiceNumber,
        invoiceTotal,
        customer,
      };
    });
  } catch (error) {
    throw asDuplicateOperationError(error);
  }
};
