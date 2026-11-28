import asyncHandler from "../utils/asyncHandler.js";
import {
  getDashboardOverviewData,
  getLowStockAlerts,
} from "../services/dashboardService.js";

export const getDashboardOverview = asyncHandler(async (req, res) => {
  const overviewData = await getDashboardOverviewData(req.workspaceId, {
    role: req.user.role,
    userId: req.user._id,
  });
  res.status(200).json({
    success: true,
    message: "Dashboard overview retrieved successfully",
    data: overviewData,
  });
});

export const getDashboardAlerts = asyncHandler(async (req, res) => {
  const result = await getLowStockAlerts(req.workspaceId);
  res.status(200).json({
    success: true,
    message: "Low-stock alerts retrieved successfully",
    data: result,
  });
});
