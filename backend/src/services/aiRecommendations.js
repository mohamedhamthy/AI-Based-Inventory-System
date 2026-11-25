const nonNegativeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
};

const roundMoney = (value) => Number(value.toFixed(2));

export const buildPurchaseRecommendation = ({
  forecast,
  currentStock,
  minimumStock,
  outstandingQuantity = 0,
}) => {
  const stock = nonNegativeNumber(currentStock);
  const minimum = nonNegativeNumber(minimumStock);
  const outstanding = nonNegativeNumber(outstandingQuantity);
  const demand = Number(forecast?.next28DayDemand);
  const rawConfidence = forecast?.confidence;
  const hasValidConfidence = typeof rawConfidence === 'number'
    && Number.isFinite(rawConfidence)
    && rawConfidence >= 0
    && rawConfidence <= 100;
  const confidence = hasValidConfidence ? rawConfidence : 0;
  const confidenceWarning = !hasValidConfidence
    ? 'Forecast confidence is missing or invalid; it is a heuristic quality indicator, not a statistical probability.'
    : `Forecast quality score (${confidence}/100) is below the 40-point planning threshold; it is a heuristic quality indicator, not a statistical probability.`;

  if (
    forecast?.status !== 'reliable'
    || !Number.isFinite(demand)
    || demand < 0
    || !hasValidConfidence
    || confidence < 40
  ) {
    const confidenceIsReason = !hasValidConfidence || confidence < 40;
    return {
      action: 'Monitor',
      suggestedQuantity: null,
      currentStock: stock,
      minimumStock: minimum,
      outstandingQuantity: outstanding,
      projected28DayDemand: Number.isFinite(demand) && demand >= 0 ? demand : null,
      confidence,
      explanation: confidenceIsReason
        ? `A purchase quantity is withheld because ${!hasValidConfidence ? 'the forecast quality score is missing or invalid' : `the forecast quality score (${confidence}/100) is below 40`}.`
        : 'A purchase quantity is withheld because recent sales history or forecast validation is insufficient.',
      warning: confidenceIsReason
        ? confidenceWarning
        : forecast?.reason || 'Recent sales history or forecast validation is insufficient.',
    };
  }

  const suggestedQuantity = Math.max(0, Math.ceil(minimum + demand - stock - outstanding));
  const action = suggestedQuantity > 0
    ? 'Buy Now'
    : outstanding > 0 && stock <= minimum
      ? 'Wait'
      : 'Monitor';
  const explanation = suggestedQuantity > 0
    ? `Suggested quantity = max(0, minimum stock (${minimum}) + 28-day demand (${demand}) - on hand (${stock}) - outstanding purchase orders (${outstanding})), rounded up.`
    : action === 'Wait'
      ? `Outstanding purchase orders cover the target stock position; wait for ${outstanding} units already ordered before creating another order.`
      : 'Current stock and outstanding purchase orders cover the minimum-stock plus 28-day demand target.';

  return {
    action,
    suggestedQuantity,
    currentStock: stock,
    minimumStock: minimum,
    outstandingQuantity: outstanding,
    projected28DayDemand: demand,
    confidence,
    explanation,
    warning: null,
  };
};

export const buildSellingPriceRecommendation = ({
  costPrice,
  currentSellingPrice,
  retailObservations = [],
}) => {
  const cost = Number(costPrice);
  const currentPrice = Number(currentSellingPrice);
  const hasCost = Number.isFinite(cost) && cost > 0;
  const hasCurrentPrice = Number.isFinite(currentPrice) && currentPrice > 0;
  const validObservations = retailObservations.filter(({ price }) => (
    Number.isFinite(Number(price)) && Number(price) > 0
  ));
  const currentGrossProfit = hasCost && hasCurrentPrice ? roundMoney(currentPrice - cost) : null;
  const currentGrossMargin = hasCost && hasCurrentPrice
    ? roundMoney((currentGrossProfit / currentPrice) * 100)
    : null;
  const base = {
    status: 'unavailable',
    suggestedSellingPrice: null,
    expectedGrossProfitPerUnit: null,
    expectedGrossProfitMarginPercent: null,
    marketAveragePrice: null,
    marketObservationsUsed: validObservations.length,
    currentSellingPrice: hasCurrentPrice ? roundMoney(currentPrice) : null,
    currentGrossProfitPerUnit: currentGrossProfit,
    currentGrossProfitMarginPercent: currentGrossMargin,
  };

  if (!hasCost) {
    return { ...base, explanation: 'A selling-price recommendation requires a recorded product cost above zero.' };
  }
  if (!validObservations.length) {
    return { ...base, explanation: 'No recorded Retail market observations are available; no market-based price is suggested.' };
  }

  const marketAveragePrice = roundMoney(
    validObservations.reduce((total, { price }) => total + Number(price), 0) / validObservations.length,
  );
  if (marketAveragePrice <= cost) {
    return {
      ...base,
      marketAveragePrice,
      explanation: `The recorded Retail market average (${marketAveragePrice}) does not exceed product cost (${roundMoney(cost)}); no profitable market-based selling price is suggested.`,
    };
  }

  const suggestedSellingPrice = marketAveragePrice;
  const expectedGrossProfitPerUnit = roundMoney(suggestedSellingPrice - cost);
  const expectedGrossProfitMarginPercent = roundMoney(
    (expectedGrossProfitPerUnit / suggestedSellingPrice) * 100,
  );
  return {
    ...base,
    status: 'available',
    suggestedSellingPrice,
    expectedGrossProfitPerUnit,
    expectedGrossProfitMarginPercent,
    marketAveragePrice,
    explanation: `Uses the average of ${validObservations.length} recorded Retail LKR observations as the market reference. No target margin is assumed or added; review this estimate before changing the product price.`,
  };
};
