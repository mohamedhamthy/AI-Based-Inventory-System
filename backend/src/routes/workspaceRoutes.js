import express from "express";
import { getWorkspaces } from "../controllers/workspaceController.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  preventDemoWrites,
  verifyCsrfToken,
} from "../middleware/demoAccessMiddleware.js";

const router = express.Router();

router.use(protect, verifyCsrfToken, preventDemoWrites);
router.get("/", getWorkspaces);

export default router;
