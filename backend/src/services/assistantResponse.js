const normalize = (value) =>
  typeof value === "string"
    ? value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";

const formatProduct = (item) => {
  const partNumber = item.sku ? ` (part number ${item.sku})` : "";
  const demand = item.forecast?.next28DayDemand ?? null;
  const period = item.forecast?.period;
  const periodText = period
    ? ` from ${period.startDate} through ${period.endDate} (${period.timeZone})`
    : "";
  const demandText =
    demand === null
      ? "not enough recent sales to validate a forecast"
      : `about ${demand} units over 28 days${periodText}`;
  const purchaseQuantity = item.recommendedPurchaseQty ?? null;
  const purchaseRecommendation = item.purchaseRecommendation;
  let purchaseText;
  if (purchaseRecommendation?.action === "Wait") {
    purchaseText = `${purchaseRecommendation.outstandingQuantity} units are already on order; wait for receipt before creating another purchase order`;
  } else if (purchaseQuantity === null) {
    purchaseText =
      purchaseRecommendation?.warning ||
      purchaseRecommendation?.explanation ||
      "no purchase quantity is suggested until the forecast has stronger validation";
  } else if (purchaseQuantity > 0) {
    purchaseText = `consider ordering ${purchaseQuantity} units net${purchaseRecommendation?.outstandingQuantity ? ` of ${purchaseRecommendation.outstandingQuantity} units already on order` : ""}`;
  } else {
    purchaseText =
      "current stock and outstanding purchase orders cover the estimated 28-day demand and minimum stock";
  }
  return `${item.productName}${partNumber}: ${item.currentStock} in stock, minimum ${item.minimumStock}; ${demandText}; ${purchaseText}.`;
};

export const buildAssistantResponse = (
  query,
  items,
  savedPriceForecasts = [],
) => {
  const normalizedQuery = normalize(query);
  const matchedProduct = items.find((item) => {
    const identifiers = [
      normalize(item.sku),
      normalize(item.productName),
    ].filter(Boolean);
    return identifiers.some((identifier) =>
      normalizedQuery.includes(identifier),
    );
  });

  if (matchedProduct && /(price|market|cost)/.test(normalizedQuery)) {
    const partNumber = matchedProduct.sku
      ? ` (part number ${matchedProduct.sku})`
      : "";
    const savedForecast = savedPriceForecasts.find(
      (forecast) =>
        String(forecast.product) === matchedProduct.id ||
        forecast.productName === matchedProduct.productName,
    );
    if (!savedForecast) {
      return `${matchedProduct.productName}${partNumber} has no saved reliable market-price forecast yet. Add verified price observations on Market Prices and run a forecast there.`;
    }
    return `${matchedProduct.productName}${partNumber}: the latest saved ${savedForecast.priceType.toLowerCase()} market forecast is ${savedForecast.predictedPrice} LKR for ${savedForecast.forecastPeriod} days (${savedForecast.metrics.confidence}% validation score, ${savedForecast.metrics.mape}% MAPE). This is a model estimate, not a supplier quote.`;
  }

  if (matchedProduct) {
    return formatProduct(matchedProduct);
  }

  if (
    /(low stock|out of stock|reorder|restock|shortage|buy)/.test(
      normalizedQuery,
    )
  ) {
    const itemsToReorder = items
      .filter(
        (item) =>
          Number(item.currentStock) <= Number(item.minimumStock) ||
          item.recommendedPurchaseQty > 0,
      )
      .slice(0, 5);
    return itemsToReorder.length
      ? `Highest-priority stock items:\n${itemsToReorder.map(formatProduct).join("\n")}`
      : "No products currently meet the at-or-below minimum-stock or validated 28-day reorder criteria.";
  }

  if (/(top sell|best sell|fast mov|demand|popular)/.test(normalizedQuery)) {
    const topItems = items
      .filter((item) => item.forecast?.next28DayDemand != null)
      .sort(
        (left, right) =>
          right.forecast.next28DayDemand - left.forecast.next28DayDemand,
      )
      .slice(0, 5);
    return topItems.length
      ? `Highest validated 28-day demand:\n${topItems.map(formatProduct).join("\n")}`
      : "There is not enough recent sales history to rank demand yet.";
  }

  if (/(price|market|cost)/.test(normalizedQuery)) {
    const formatSavedForecast = (forecast) => {
      const product = items.find(
        (item) => item.id === String(forecast.product),
      );
      const partNumber = product?.sku ? ` (part number ${product.sku})` : "";
      return `${forecast.productName}${partNumber}: ${forecast.predictedPrice} LKR in ${forecast.forecastPeriod} days (${forecast.metrics.confidence}% validation score).`;
    };
    return savedPriceForecasts.length
      ? `Latest saved market forecasts:\n${savedPriceForecasts.slice(0, 5).map(formatSavedForecast).join("\n")}`
      : "No saved reliable market-price forecasts are available. Add verified observations on the Market Prices page and run a forecast.";
  }

  if (/(stock|inventory|how many|quantity)/.test(normalizedQuery)) {
    const totalUnits = items.reduce(
      (total, item) => total + item.currentStock,
      0,
    );
    const lowStockCount = items.filter(
      (item) => Number(item.currentStock) <= Number(item.minimumStock),
    ).length;
    const outOfStockCount = items.filter(
      (item) => item.currentStock <= 0,
    ).length;
    return `Current workspace snapshot: ${items.length} active products, ${totalUnits} units on hand, ${lowStockCount} products at or below minimum stock, and ${outOfStockCount} out of stock.`;
  }

  return "I can answer questions about current stock, minimum stock, validated 28-day demand, reorder quantities, and saved market-price forecasts. Try “Which parts need reordering?” or ask about a product name or SKU.";
};
