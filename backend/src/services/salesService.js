import Sale from "../models/Sale.js";

export const getSalesPage = async (workspaceId, page, limit, scope = {}) => {
  const query = { workspaceId, ...scope };
  const [sales, totalItems, summaryRows] = await Promise.all([
    Sale.find(query)
      .sort({ saleDate: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("product", "productName sku oemPartNumber")
      .populate("customer", "name phone address")
      .lean(),
    Sale.countDocuments(query),
    Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$totalAmount" },
          totalQty: { $sum: "$quantity" },
          invoices: { $addToSet: { $ifNull: ["$invoiceNumber", "$_id"] } },
        },
      },
      {
        $project: {
          totalSales: 1,
          totalQty: 1,
          transactions: { $size: "$invoices" },
        },
      },
    ]),
  ]);

  const summary = summaryRows[0] || {
    totalSales: 0,
    totalQty: 0,
    transactions: 0,
  };

  return {
    sales,
    totalItems,
    summary: {
      totalSales: summary.totalSales || 0,
      totalQty: summary.totalQty || 0,
      transactions: summary.transactions || 0,
    },
  };
};
