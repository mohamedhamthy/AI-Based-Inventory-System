import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getStockMovementsPage = async (
  { workspaceId, page = 1, limit = 10, movementType, search = "" },
  { MovementModel = StockMovement, ProductModel = Product } = {},
) => {
  const query = { workspaceId };
  if (movementType) query.movementType = movementType;

  const cleanSearch = search.trim().slice(0, 100);
  if (cleanSearch) {
    const expression = new RegExp(escapeRegex(cleanSearch), "i");
    const matchingProducts = await ProductModel.find({
      workspaceId,
      $or: [
        { productName: expression },
        { sku: expression },
        { oemPartNumber: expression },
      ],
    })
      .select("_id")
      .lean();
    query.$or = [
      { reference: expression },
      { reason: expression },
      { product: { $in: matchingProducts.map((product) => product._id) } },
    ];
  }

  const [movements, totalItems, summaryRows] = await Promise.all([
    MovementModel.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("product", "productName sku oemPartNumber")
      .populate("performedBy", "name email")
      .lean(),
    MovementModel.countDocuments(query),
    MovementModel.aggregate([
      { $match: { workspaceId } },
      {
        $group: {
          _id: null,
          totalUnits: { $sum: "$quantity" },
          inbound: {
            $sum: {
              $cond: [{ $eq: ["$movementType", "stock_in"] }, "$quantity", 0],
            },
          },
          outbound: {
            $sum: {
              $cond: [{ $eq: ["$movementType", "sale"] }, "$quantity", 0],
            },
          },
          adjustments: {
            $sum: { $cond: [{ $eq: ["$movementType", "adjustment"] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const summary = summaryRows[0] || {};
  const totalPages = Math.ceil(totalItems / limit);
  return {
    movements,
    summary: {
      totalUnits: summary.totalUnits || 0,
      inbound: summary.inbound || 0,
      outbound: summary.outbound || 0,
      adjustments: summary.adjustments || 0,
    },
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};
