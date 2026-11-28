import Sale from "../models/Sale.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getSalesPage } from "../services/salesService.js";
import { recordSale } from "../services/inventoryService.js";

const buildSaleResponse = (sale) => {
  const saleData = typeof sale.toObject === "function" ? sale.toObject() : sale;
  const product = saleData.product;

  return {
    ...saleData,
    id: saleData._id.toString(),
    product:
      product && typeof product === "object"
        ? {
            ...(typeof product.toObject === "function"
              ? product.toObject()
              : product),
            id: product._id.toString(),
          }
        : product,
  };
};

export const createSale = asyncHandler(async (req, res) => {
  const result = await recordSale({
    items: req.body.items,
    productId: req.body.product,
    quantity: req.body.quantity,
    unitPrice: req.body.unitPrice,
    customerId: req.body.customerId,
    customerName: req.body.customerName,
    phone: req.body.phone,
    paymentStatus: req.body.paymentStatus,
    notes: req.body.notes,
    discountAmount: req.body.discountAmount,
    taxRate: req.body.taxRate,
    workspaceId: req.workspaceId,
    userId: req.user._id,
    idempotencyKey: req.get("Idempotency-Key"),
  });
  const populatedSales = await Sale.find({
    _id: { $in: result.sales.map((sale) => sale._id) },
    workspaceId: req.workspaceId,
  })
    .populate("product", "productName sku oemPartNumber")
    .populate("customer", "name phone address")
    .lean();
  const salesById = new Map(
    populatedSales.map((sale) => [String(sale._id), sale]),
  );
  const sales = result.sales.map((sale) =>
    buildSaleResponse(salesById.get(String(sale._id))),
  );
  const invoice = {
    invoiceNumber: result.invoiceNumber,
    invoiceTotal: result.invoiceTotal,
    customer: result.customer || null,
    items: sales,
  };
  res.status(201).json({
    success: true,
    message: "Sale recorded successfully",
    data: { sale: sales[0], invoice },
  });
});

export const getSales = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.max(
    1,
    Math.min(Number.parseInt(req.query.limit, 10) || 10, 100),
  );
  const salesScope =
    req.user.role === "employee" && req.user.accountType !== "demo_user"
      ? { createdBy: req.user._id }
      : {};
  const { sales, totalItems, summary } = await getSalesPage(
    req.workspaceId,
    page,
    limit,
    salesScope,
  );
  const totalPages = Math.ceil(totalItems / limit);

  res.status(200).json({
    success: true,
    message: "Sales retrieved successfully",
    data: {
      sales: sales.map(buildSaleResponse),
      summary: {
        totalSales: summary.totalSales,
        totalQty: summary.totalQty,
        transactions: summary.transactions,
      },
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    },
  });
});
