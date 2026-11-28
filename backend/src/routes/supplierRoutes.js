import express from "express";
import {
  createSupplier,
  deleteSupplier,
  getSupplierById,
  getSuppliers,
  updateSupplier,
} from "../controllers/supplierController.js";
import { protect, authorizePermissions } from "../middleware/authMiddleware.js";
import {
  validateMongoId,
  validateSupplier,
  validate,
} from "../validators/validation.js";

const router = express.Router();

router
  .route("/")
  .get(getSuppliers)
  .post(
    protect,
    authorizePermissions("catalog:manage"),
    validateSupplier,
    validate,
    createSupplier,
  );
router
  .route("/:id")
  .get(validateMongoId("id"), validate, getSupplierById)
  .put(
    protect,
    authorizePermissions("catalog:manage"),
    validateMongoId("id"),
    validateSupplier,
    validate,
    updateSupplier,
  )
  .delete(
    protect,
    authorizePermissions("catalog:manage"),
    validateMongoId("id"),
    validate,
    deleteSupplier,
  );

export default router;
