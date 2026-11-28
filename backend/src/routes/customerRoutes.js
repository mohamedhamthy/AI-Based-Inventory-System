import express from "express";
import { body, query } from "express-validator";
import {
  getCustomers,
  postCustomer,
} from "../controllers/customerController.js";
import { authorizePermissions } from "../middleware/authMiddleware.js";
import { validate } from "../validators/validation.js";

const router = express.Router();

router.get(
  "/",
  authorizePermissions("sales:read"),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("search").optional().isString().isLength({ max: 100 }),
  validate,
  getCustomers,
);

router.post(
  "/",
  authorizePermissions("sales:create"),
  body("name").isString().trim().isLength({ min: 2, max: 120 }),
  body("phone").optional().isString().isLength({ max: 40 }),
  body("address").optional().isString().isLength({ max: 300 }),
  body("notes").optional().isString().isLength({ max: 500 }),
  validate,
  postCustomer,
);

export default router;
