import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPurchaseRecommendation,
  buildSellingPriceRecommendation,
} from './aiRecommendations.js';

const reliableForecast = {
  status: 'reliable',
  next28DayDemand: 20,
  confidence: 75,
};

test('purchase quantity accounts for current stock, minimum stock, forecast demand and open orders', () => {
  const result = buildPurchaseRecommendation({
    forecast: reliableForecast,
    currentStock: 4,
    minimumStock: 10,
    outstandingQuantity: 8,
  });
  assert.equal(result.action, 'Buy Now');
  assert.equal(result.suggestedQuantity, 18);
  assert.match(result.explanation, /outstanding purchase orders \(8\)/);
});

test('purchase recommendation waits when an open order covers the stock target', () => {
  const result = buildPurchaseRecommendation({
    forecast: { ...reliableForecast, next28DayDemand: 0 },
    currentStock: 2,
    minimumStock: 5,
    outstandingQuantity: 6,
  });
  assert.equal(result.action, 'Wait');
  assert.equal(result.suggestedQuantity, 0);
});

test('purchase recommendation withholds a quantity when forecast validation is insufficient', () => {
  const result = buildPurchaseRecommendation({
    forecast: { status: 'insufficient_data', next28DayDemand: null, confidence: 0 },
    currentStock: 1,
    minimumStock: 5,
  });
  assert.equal(result.action, 'Monitor');
  assert.equal(result.suggestedQuantity, null);
  assert.ok(result.warning);
});

test('purchase recommendations withhold actionable quantities below heuristic confidence 40', () => {
  const confidenceCases = [
    { label: 'missing', forecast: { ...reliableForecast, confidence: undefined } },
    { label: '1', forecast: { ...reliableForecast, confidence: 1 } },
    { label: '20', forecast: { ...reliableForecast, confidence: 20 } },
    { label: '39', forecast: { ...reliableForecast, confidence: 39 } },
  ];

  for (const { label, forecast } of confidenceCases) {
    const result = buildPurchaseRecommendation({
      forecast,
      currentStock: 4,
      minimumStock: 10,
      outstandingQuantity: 3,
    });
    assert.equal(result.action, 'Monitor', label);
    assert.equal(result.suggestedQuantity, null, label);
    assert.match(result.warning, /heuristic quality indicator, not a statistical probability/, label);
    assert.match(result.explanation, /withheld/, label);
  }
});

test('purchase recommendation may proceed at the 40-point heuristic confidence threshold', () => {
  const result = buildPurchaseRecommendation({
    forecast: { ...reliableForecast, confidence: 40 },
    currentStock: 4,
    minimumStock: 10,
    outstandingQuantity: 3,
  });

  assert.equal(result.action, 'Buy Now');
  assert.equal(result.suggestedQuantity, 23);
});

test('selling price recommendation uses recorded retail average without an assumed margin', () => {
  const result = buildSellingPriceRecommendation({
    costPrice: 70,
    currentSellingPrice: 90,
    retailObservations: [{ price: 110 }, { price: 130 }],
  });
  assert.equal(result.suggestedSellingPrice, 120);
  assert.equal(result.expectedGrossProfitPerUnit, 50);
  assert.equal(result.expectedGrossProfitMarginPercent, 41.67);
  assert.equal(result.currentSellingPrice, 90);
  assert.match(result.explanation, /No target margin is assumed/);
});

test('selling price recommendation is unavailable when retail market average is below cost', () => {
  const result = buildSellingPriceRecommendation({
    costPrice: 120,
    currentSellingPrice: 130,
    retailObservations: [{ price: 90 }, { price: 110 }],
  });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.suggestedSellingPrice, null);
  assert.equal(result.marketAveragePrice, 100);
  assert.match(result.explanation, /does not exceed product cost/);
});

test('selling price recommendation warns when cost or retail observations are missing', () => {
  const missingCost = buildSellingPriceRecommendation({
    costPrice: 0,
    currentSellingPrice: 100,
    retailObservations: [{ price: 120 }],
  });
  const missingMarket = buildSellingPriceRecommendation({
    costPrice: 50,
    currentSellingPrice: 100,
  });
  assert.equal(missingCost.suggestedSellingPrice, null);
  assert.match(missingCost.explanation, /requires a recorded product cost/);
  assert.equal(missingMarket.suggestedSellingPrice, null);
  assert.match(missingMarket.explanation, /No recorded Retail market observations/);
});
