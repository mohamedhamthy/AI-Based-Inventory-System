import express from "express";
import { body, param, query } from "express-validator";
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrder,
  getPurchaseOrders,
  orderPurchaseOrder,
  receivePurchaseOrder,
  updatePurchaseOrder,
} from "../controllers/purchaseOrderController.js";
import { authorizePermissions } from "../middleware/authMiddleware.js";
import {
  validate,
  validateIdempotencyKeyHeader,
} from "../validators/validation.js";

const router = express.Router();

const validateItems = [
  body("items").isArray({ min: 1, max: 100 }),
  body("items.*.productId").isMongoId(),
  body("items.*.orderedQuantity").isInt({ min: 1 }),
  body("items.*.unitCost").isFloat({ min: 0 }),
];

const validateOptionalOrderFields = [
  body("supplierId").optional().isMongoId(),
  body("orderDate").optional().isISO8601(),
  body("expectedDeliveryDate").optional({ values: "falsy" }).isISO8601(),
  body("notes").optional().isString().isLength({ max: 1000 }),
];

router.get(
  "/",
  authorizePermissions("purchaseOrders:read"),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("status")
    .optional()
    .isIn(["draft", "ordered", "partially_received", "received", "cancelled"]),
  query("search").optional().isString().isLength({ max: 100 }),
  validate,
  getPurchaseOrders,
);

router.post(
  "/",
  authorizePermissions("purchaseOrders:create"),
  body("supplierId").isMongoId(),
  body("orderDate").optional().isISO8601(),
  body("expectedDeliveryDate").optional({ values: "falsy" }).isISO8601(),
  ...validateItems,
  body("notes").optional().isString().isLength({ max: 1000 }),
  validate,
  createPurchaseOrder,
);

router.get(
  "/:id",
  authorizePermissions("purchaseOrders:read"),
  param("id").isMongoId(),
  validate,
  getPurchaseOrder,
);

router.put(
  "/:id",
  authorizePermissions("purchaseOrders:manage"),
  param("id").isMongoId(),
  ...validateOptionalOrderFields,
  body("items").optional().isArray({ min: 1, max: 100 }),
  body("items.*.productId").optional().isMongoId(),
  body("items.*.orderedQuantity").optional().isInt({ min: 1 }),
  body("items.*.unitCost").optional().isFloat({ min: 0 }),
  body("notes").optional().isString().isLength({ max: 1000 }),
  validate,
  updatePurchaseOrder,
);

router.post(
  "/:id/order",
  authorizePermissions("purchaseOrders:manage"),
  param("id").isMongoId(),
  validate,
  orderPurchaseOrder,
);

router.post(
  "/:id/cancel",
  authorizePermissions("purchaseOrders:manage"),
  param("id").isMongoId(),
  validate,
  cancelPurchaseOrder,
);

router.post(
  "/:id/receipts",
  authorizePermissions("purchaseOrders:receive"),
  param("id").isMongoId(),
  body("items").isArray({ min: 1, max: 100 }),
  body("items.*.productId").isMongoId(),
  body("items.*.quantity").isInt({ min: 1 }),
  validateIdempotencyKeyHeader(),
  validate,
  receivePurchaseOrder,
);

export default router;
