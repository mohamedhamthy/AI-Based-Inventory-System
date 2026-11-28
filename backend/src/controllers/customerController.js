import asyncHandler from "../utils/asyncHandler.js";
import {
  createCustomer,
  getCustomersPage,
} from "../services/customerService.js";

export const getCustomers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.max(
    1,
    Math.min(Number.parseInt(req.query.limit, 10) || 100, 100),
  );
  const data = await getCustomersPage({
    workspaceId: req.workspaceId,
    page,
    limit,
    search: req.query.search || "",
  });
  res.status(200).json({ success: true, data });
});

export const postCustomer = asyncHandler(async (req, res) => {
  const customer = await createCustomer({
    name: req.body.name,
    phone: req.body.phone,
    address: req.body.address,
    notes: req.body.notes,
    workspaceId: req.workspaceId,
    userId: req.user._id,
  });
  res.status(201).json({ success: true, data: { customer } });
});
