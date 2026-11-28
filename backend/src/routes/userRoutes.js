import express from "express";
import {
  createUser,
  getUsers,
  updateUser,
} from "../controllers/userController.js";
import { authorizePermissions, protect } from "../middleware/authMiddleware.js";
import {
  preventDemoWrites,
  verifyCsrfToken,
} from "../middleware/demoAccessMiddleware.js";
import { requireWorkspace } from "../middleware/workspaceMiddleware.js";
import {
  validate,
  validateMongoId,
  validateUserCreate,
  validateUserUpdate,
} from "../validators/validation.js";

const router = express.Router();

router.use(
  protect,
  verifyCsrfToken,
  preventDemoWrites,
  authorizePermissions("users:manage"),
);
router.post("/", requireWorkspace, validateUserCreate, validate, createUser);
router.get("/", getUsers);
router.patch(
  "/:id",
  validateMongoId("id"),
  validateUserUpdate,
  validate,
  updateUser,
);

export default router;
