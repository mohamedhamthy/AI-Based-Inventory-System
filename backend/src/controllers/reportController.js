import asyncHandler from '../utils/asyncHandler.js';
import {
  exportCustomerSalesCsv,
  exportInventoryCsv,
  exportMonthlySalesCsv,
  exportMovementCsv,
  exportSalesCsv,
  getInventoryReport as loadInventoryReport,
  getMonthlySalesSummary as loadMonthlySalesSummary,
  getMovementReport as loadMovementReport,
  getSalesReport as loadSalesReport,
} from '../services/reportService.js';

const reportFilters = (req) => ({
  ...req.query,
  workspaceId: req.workspaceId,
});

const sendCsv = (res, filename, content) => {
  res.status(200)
    .type('text/csv; charset=utf-8')
    .attachment(filename)
    .send(content);
};

export const getInventoryReport = asyncHandler(async (req, res) => {
  const data = await loadInventoryReport(reportFilters(req));
  res.status(200).json({ success: true, data });
});

export const exportInventoryReport = asyncHandler(async (req, res) => {
  const content = await exportInventoryCsv(reportFilters(req));
  sendCsv(res, 'inventory-report.csv', content);
});

export const getMovementReport = asyncHandler(async (req, res) => {
  const data = await loadMovementReport(reportFilters(req));
  res.status(200).json({ success: true, data });
});

export const exportMovementReport = asyncHandler(async (req, res) => {
  const content = await exportMovementCsv(reportFilters(req));
  sendCsv(res, 'stock-movement-report.csv', content);
});

export const getSalesReport = asyncHandler(async (req, res) => {
  const data = await loadSalesReport(reportFilters(req));
  res.status(200).json({ success: true, data });
});

export const getMonthlySalesSummary = asyncHandler(async (req, res) => {
  const data = await loadMonthlySalesSummary(reportFilters(req));
  res.status(200).json({ success: true, data });
});

export const exportSalesReport = asyncHandler(async (req, res) => {
  const content = await exportSalesCsv(reportFilters(req));
  sendCsv(res, 'sales-transactions.csv', content);
});

export const exportCustomerSalesReport = asyncHandler(async (req, res) => {
  const content = await exportCustomerSalesCsv(reportFilters(req));
  sendCsv(res, 'sales-by-customer.csv', content);
});

export const exportMonthlySalesReport = asyncHandler(async (req, res) => {
  const content = await exportMonthlySalesCsv(reportFilters(req));
  sendCsv(res, 'monthly-sales-summary.csv', content);
});
