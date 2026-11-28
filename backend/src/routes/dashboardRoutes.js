import express from "express";
import {
  getDashboardAlerts,
  getDashboardOverview,
} from "../controllers/dashboardController.js";
import { authorizePermissions } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/overview",
  authorizePermissions("dashboard:read"),
  getDashboardOverview,
);
router.get("/alerts", authorizePermissions("stock:manage"), getDashboardAlerts);

export default router;
