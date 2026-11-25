import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemandForecast } from './demandForecast.js';
import { buildAssistantResponse } from './assistantResponse.js';

test('demand forecast validates competing local models against recent weeks', () => {
  const sales = Array.from({ length: 26 }, (_, index) => index < 20 ? 0 : 4 + index);
  const result = buildDemandForecast(sales);

  assert.equal(result.status, 'reliable');
  assert.ok(result.model);
  assert.equal(result.weeklyForecast.length, 4);
  assert.ok(result.next28DayDemand > 0);
  assert.ok(result.confidence >= 0 && result.confidence <= 100);
});

test('demand forecast prorates only the future-day portions of intersecting weeks', () => {
  const sales = Array.from({ length: 26 }, (_, index) => index < 20 ? 0 : 4 + index);
  const dayCounts = [4, 7, 7, 7, 3];
  const result = buildDemandForecast(sales, dayCounts);
  const expectedDemand = result.weeklyForecast.reduce(
    (total, weeklyDemand, index) => total + weeklyDemand * dayCounts[index] / 7,
    0,
  );

  assert.equal(result.weeklyForecast.length, 5);
  assert.equal(result.next28DayDemand, Number(expectedDemand.toFixed(2)));
});

test('demand forecast rejects day portions that do not total 28 future dates', () => {
  assert.throws(() => buildDemandForecast(Array(26).fill(2), [7, 7, 7, 6]), RangeError);
});

test('demand forecast refuses to invent demand without enough recent sales', () => {
  const result = buildDemandForecast(Array(26).fill(0));

  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.next28DayDemand, null);
  assert.equal(result.confidence, 0);
});

test('local assistant answers product-specific questions with stored inventory facts', () => {
  const items = [{
    id: 'product-1',
    productName: 'Brake Pad',
    sku: 'BP-01',
    currentStock: 2,
    minimumStock: 5,
    recommendedPurchaseQty: 7,
    forecast: { next28DayDemand: 4, status: 'reliable' },
  }];

  const answer = buildAssistantResponse('What is the demand for BP-01?', items);
  assert.match(answer, /part number BP-01/);
  assert.match(answer, /2 in stock, minimum 5/);
  assert.match(answer, /about 4 units over 28 days/);
  assert.match(answer, /ordering 7 units/);
});

test('local assistant prevents duplicate purchase advice when open orders already cover the target', () => {
  const answer = buildAssistantResponse('What is the demand for BP-01?', [{
    id: 'product-1',
    productName: 'Brake Pad',
    sku: 'BP-01',
    currentStock: 2,
    minimumStock: 5,
    recommendedPurchaseQty: 0,
    purchaseRecommendation: { action: 'Wait', outstandingQuantity: 8 },
    forecast: { next28DayDemand: 4, status: 'reliable' },
  }]);

  assert.match(answer, /8 units are already on order/);
  assert.match(answer, /wait for receipt before creating another purchase order/);
});

test('local assistant summarizes workspace stock using current product records', () => {
  const items = [
    { currentStock: 2, minimumStock: 5, stockGap: 3 },
    { currentStock: 0, minimumStock: 1, stockGap: 1 },
  ];

  const answer = buildAssistantResponse('How much stock do I have?', items);
  assert.match(answer, /2 active products, 2 units on hand/);
  assert.match(answer, /2 products at or below minimum stock, and 1 out of stock/);
});

test('local assistant counts stock equal to minimum as low and includes it in priority items', () => {
  const items = [
    { productName: 'Equal stock part', sku: 'EQ-1', currentStock: 5, minimumStock: 5, stockGap: 0 },
    { productName: 'Above stock part', sku: 'AB-1', currentStock: 6, minimumStock: 5, stockGap: 0 },
  ];

  const summary = buildAssistantResponse('How much stock do I have?', items);
  const priorities = buildAssistantResponse('Which parts are low stock?', items);

  assert.match(summary, /1 products at or below minimum stock/);
  assert.match(priorities, /Equal stock part/);
  assert.doesNotMatch(priorities, /Above stock part/);
});

test('empty product identifiers do not match ordinary inventory queries', () => {
  const items = [
    { currentStock: 2, minimumStock: 5, stockGap: 3 },
    { currentStock: 0, minimumStock: 1, stockGap: 1, sku: '   ', productName: '  ' },
  ];

  const answer = buildAssistantResponse('How much stock do I have?', items);
  assert.match(answer, /2 active products, 2 units on hand/);
});

test('product-specific answers tolerate missing optional forecast information', () => {
  const items = [{
    id: 'product-2',
    productName: 'Oil Filter',
    sku: 'OF-02',
    currentStock: 3,
    minimumStock: 4,
  }];

  const answer = buildAssistantResponse('What is the demand for OF-02?', items);
  assert.match(answer, /not enough recent sales to validate a forecast/);
  assert.match(answer, /no purchase quantity is suggested/);
});

test('demand summaries ignore products without forecast data', () => {
  const answer = buildAssistantResponse('Which parts have the highest demand?', [
    { productName: 'Oil Filter', sku: 'OF-02' },
  ]);
  assert.match(answer, /not enough recent sales history to rank demand yet/);
});
