import express from "express";
import { body, query } from "express-validator";
import {
  createStockAdjustment,
  createStockIn,
  getStockMovements,
} from "../controllers/stockMovementController.js";
import { authorizePermissions } from "../middleware/authMiddleware.js";
import { validate } from "../validators/validation.js";

const router = express.Router();

router.get(
  "/",
  authorizePermissions("stock:read"),
  query("type").optional().isIn(["stock_in", "sale", "adjustment"]),
  query("search").optional().isString().isLength({ max: 100 }),
  validate,
  getStockMovements,
);

router.post(
  "/stock-in",
  authorizePermissions("stock:manage"),
  body("productId").isMongoId(),
  body("quantity").isFloat({ gt: 0 }),
  body("reference").optional().isString().isLength({ max: 120 }),
  body("reason").optional().isString().isLength({ max: 500 }),
  validate,
  createStockIn,
);

router.post(
  "/adjustments",
  authorizePermissions("stock:manage"),
  body("productId").isMongoId(),
  body("quantity").isFloat({ gt: 0 }),
  body("direction").isIn(["increase", "decrease"]),
  body("reference").optional().isString().isLength({ max: 120 }),
  body("reason").optional().isString().isLength({ max: 500 }),
  validate,
  createStockAdjustment,
);

export default router;
