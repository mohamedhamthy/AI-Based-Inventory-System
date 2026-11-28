import asyncHandler from "../utils/asyncHandler.js";
import { adjustStock, receiveStock } from "../services/inventoryService.js";
import { getStockMovementsPage } from "../services/stockMovementService.js";

const buildMovementResponse = (movement) => {
  const data =
    typeof movement.toObject === "function"
      ? movement.toObject({ virtuals: true })
      : movement;
  return { ...data, id: data._id?.toString() };
};

const buildProductResponse = (product) => {
  const data =
    typeof product.toObject === "function"
      ? product.toObject({ virtuals: true })
      : product;
  return { ...data, id: data._id?.toString() };
};

export const getStockMovements = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.max(
    1,
    Math.min(Number.parseInt(req.query.limit, 10) || 10, 100),
  );
  const movementType =
    typeof req.query.type === "string" ? req.query.type : undefined;
  const search = typeof req.query.search === "string" ? req.query.search : "";
  const result = await getStockMovementsPage({
    workspaceId: req.workspaceId,
    page,
    limit,
    movementType,
    search,
  });

  res.status(200).json({
    success: true,
    message: "Stock movements retrieved successfully",
    data: {
      ...result,
      movements: result.movements.map(buildMovementResponse),
    },
  });
});

export const createStockIn = asyncHandler(async (req, res) => {
  const { productId, quantity, reference, reason } = req.body;
  const result = await receiveStock({
    workspaceId: req.workspaceId,
    productId,
    quantity,
    reference,
    reason,
    userId: req.user._id,
    idempotencyKey: req.get("Idempotency-Key"),
  });

  res.status(201).json({
    success: true,
    message: "Stock received successfully",
    data: {
      movement: buildMovementResponse(result.movement),
      product: buildProductResponse(result.product),
    },
  });
});

export const createStockAdjustment = asyncHandler(async (req, res) => {
  const { productId, quantity, direction, reference, reason } = req.body;
  const result = await adjustStock({
    workspaceId: req.workspaceId,
    productId,
    quantity,
    direction,
    reference,
    reason,
    userId: req.user._id,
    idempotencyKey: req.get("Idempotency-Key"),
  });

  res.status(201).json({
    success: true,
    message: "Stock adjusted successfully",
    data: {
      movement: buildMovementResponse(result.movement),
      product: buildProductResponse(result.product),
    },
  });
});
