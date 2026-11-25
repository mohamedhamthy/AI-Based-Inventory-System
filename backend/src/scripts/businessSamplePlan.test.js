import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildDemandForecast } from '../services/demandForecast.js';
import {
  buildBusinessSamplePlan,
  getBusinessSampleRecordKeys,
  INITIAL_BUSINESS_SAMPLE_PRODUCT_COUNT,
  summarizeBusinessSamplePlan,
  validateBusinessSampleLedger,
} from './businessSamplePlan.js';

const plan = buildBusinessSamplePlan({ asOf: '2026-11-18' });

test('sample-data CLI accepts preflight arguments without apply confirmation', () => {
  const script = fileURLToPath(new URL('./generateBusinessSampleData.js', import.meta.url));
  const result = spawnSync(process.execPath, [
    script,
    '--database',
    'local-test',
    '--workspace-id',
    '6ae87048a9d169f4859e1025',
    '--member-id',
    '6a6e003ea9e3e1ca95fcf6c1',
  ], {
    cwd: tmpdir(),
    env: { ...process.env, MONGODB_URI: '' },
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true,
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /MONGODB_URI is not set\. No database connection was attempted\./);
  assert.doesNotMatch(result.stderr, /--apply and --confirm-plan must be provided together/);
});

test('sample-price-forecasts CLI defaults to a preflight and refuses an unset database target', () => {
  const script = fileURLToPath(new URL('./generateBusinessMarketPriceForecasts.js', import.meta.url));
  const result = spawnSync(process.execPath, [
    script,
    '--database',
    'local-test',
    '--workspace-id',
    '6ae87048a9d169f4859e1025',
    '--member-id',
    '6a6e003ea9e3e1ca95fcf6c1',
  ], {
    cwd: tmpdir(),
    env: { ...process.env, MONGODB_URI: '' },
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true,
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /MONGODB_URI is not set\. No database connection was attempted\./);
  assert.doesNotMatch(result.stderr, /--apply and --confirm-plan must be provided together/);
});

test('business sample plan is deterministic, linked, and has auditable counts', () => {
  const secondPlan = buildBusinessSamplePlan({ asOf: '2026-11-18' });
  const counts = summarizeBusinessSamplePlan(plan);
  const keys = getBusinessSampleRecordKeys(plan);

  assert.deepEqual(summarizeBusinessSamplePlan(secondPlan), counts);
  assert.deepEqual(secondPlan.salesInvoices.map((invoice) => invoice.items), plan.salesInvoices.map((invoice) => invoice.items));
  assert.equal(counts.categories, 3);
  assert.equal(counts.suppliers, 2);
  assert.equal(counts.customers, 20);
  assert.equal(counts.products, 140);
  assert.equal(counts.purchaseOrders, 12);
  assert.deepEqual(counts.purchaseOrderStatuses, {
    draft: 2,
    ordered: 1,
    partially_received: 2,
    received: 6,
    cancelled: 1,
  });
  assert.equal(counts.marketPriceObservations, 140 * 53);
  assert.equal(counts.saleLines, plan.salesInvoices.reduce((total, invoice) => total + invoice.items.length, 0));
  assert.equal(counts.stockMovements, plan.products.length + counts.saleLines + 96);
  for (const recordKeys of Object.values(keys)) {
    assert.equal(new Set(recordKeys).size, recordKeys.length);
  }
  assert.equal(new Set(plan.products.map((product) => product.barcode)).size, 140);
  assert.equal(plan.products.length - INITIAL_BUSINESS_SAMPLE_PRODUCT_COUNT, 100);
  const originalKeys = getBusinessSampleRecordKeys(plan, INITIAL_BUSINESS_SAMPLE_PRODUCT_COUNT);
  assert.equal(originalKeys.Product.length, 40);
  assert.equal(originalKeys.MarketPrice.length, 40 * 53);
  assert.equal(originalKeys.StockMovement.length, 1600);
  assert.deepEqual(
    originalKeys.Sale,
    keys.Sale,
  );
  assert.ok(plan.salesInvoices.every((invoice) => (
    invoice.items.every((item) => item.productIndex < INITIAL_BUSINESS_SAMPLE_PRODUCT_COUNT)
  )));
  assert.ok(plan.products.every((product) => /^\d{13}$/.test(product.barcode)));
  assert.ok(plan.products.every((product) => (
    product.cost < product.price
    && (product.price - product.cost) / product.price >= 0.15
    && (product.price - product.cost) / product.price <= 0.4
    && product.compatibleModels
    && product.unit
  )));
  assert.ok(plan.customers.filter((customer) => customer.customerType === 'Workshop').length >= 15);
  assert.ok(plan.customers.filter((customer) => customer.customerType === 'Individual').length >= 5);
  assert.ok(plan.marketPrices.every((record) => record.priceType === 'Retail'));
  assert.equal(plan.marketPrices[0].recordedAt.toISOString().slice(0, 10), '2025-11-19');
  assert.equal(plan.marketPrices.at(-1).recordedAt.toISOString().slice(0, 10), '2026-11-18');
});

test('fast movers account for most planned sales and dated records include seasonal and weekend peaks', () => {
  const fastMoverUnits = plan.salesInvoices.reduce((total, invoice) => (
    total + invoice.items
      .filter((item) => item.productIndex < 8)
      .reduce((sum, item) => sum + item.quantity, 0)
  ), 0);
  const allUnits = plan.salesInvoices.reduce((total, invoice) => (
    total + invoice.items.reduce((sum, item) => sum + item.quantity, 0)
  ), 0);
  const saleParts = plan.salesInvoices.map((invoice) => {
    const date = invoice.saleDate;
    return {
      weekday: date.getUTCDay(),
      month: date.toISOString().slice(5, 7),
      day: Number(date.toISOString().slice(8, 10)),
    };
  });

  assert.ok(fastMoverUnits / allUnits >= 0.75 && fastMoverUnits / allUnits <= 0.9);
  assert.ok(saleParts.some(({ month }) => month === '04'));
  assert.ok(saleParts.some(({ month }) => month === '12'));
  assert.ok(saleParts.some(({ weekday }) => weekday === 0 || weekday === 6));
  assert.ok(saleParts.some(({ day }) => day >= 28));
});

test('planned demand histories drive validated forecasts for active products', () => {
  const weeklySales = plan.products.map(() => Array(26).fill(0));
  plan.salesInvoices.forEach((invoice) => {
    if (invoice.historyWeek === null || invoice.historyWeek < 26) return;
    invoice.items.forEach((item) => {
      weeklySales[item.productIndex][invoice.historyWeek - 26] += item.quantity;
    });
  });

  const forecasts = weeklySales.map((series) => buildDemandForecast(series));
  assert.ok(forecasts.slice(0, 8).every((forecast) => (
    forecast.status === 'reliable'
    && Number.isFinite(forecast.next28DayDemand)
    && forecast.next28DayDemand > 0
    && forecast.weeklyForecast.length === 4
  )));
  assert.ok(forecasts.some((forecast) => forecast.status === 'uncertain' || forecast.status === 'insufficient_data'));
});

test('planned dated sales and receipts reconcile to closing stock without negative inventory', () => {
  const ledger = validateBusinessSampleLedger(plan);
  const belowMinimum = plan.products.filter((product, index) => ledger.balances[index] < product.minimum);
  assert.equal(ledger.valid, true, ledger.violations.join('\n'));
  assert.equal(ledger.saleLineCount, getBusinessSampleRecordKeys(plan).Sale.length);
  assert.equal(ledger.receiptLineCount, 96);
  assert.equal(belowMinimum.length, 6);
  assert.ok(belowMinimum.every((product) => product.expectedEndingStock >= 0));
  assert.ok(ledger.balances.every(Number.isInteger));

  const inconsistentPlan = structuredClone(plan);
  inconsistentPlan.salesInvoices[0].items[0].quantity += 1;
  assert.equal(validateBusinessSampleLedger(inconsistentPlan).valid, false);
});

test('planned retail price history returns validated predictions for every supported horizon', (context) => {
  const python = process.env.AI_PYTHON_EXECUTABLE || 'python';
  const records = plan.marketPrices
    .filter((record) => record.productIndex === 0 && record.priceType === 'Retail')
    .map(({ price, recordedAt }) => ({ price, recordedAt: recordedAt.toISOString() }));
  const script = fileURLToPath(new URL('../ai/market_price_forecast.py', import.meta.url));
  for (const horizon of [7, 30, 60]) {
    const result = spawnSync(python, [script], {
      input: JSON.stringify({ records, horizon }),
      encoding: 'utf8',
      timeout: 30000,
      windowsHide: true,
    });
    if (result.error?.code === 'ENOENT') {
      context.skip('Python runtime is unavailable; existing Python forecast tests remain the runtime validation.');
      return;
    }
    assert.equal(result.status, 0, result.stderr);
    const forecast = JSON.parse(result.stdout);
    assert.equal(forecast.status, 'reliable', forecast.message || JSON.stringify(forecast.metrics));
    assert.equal(forecast.metrics.observations, 53);
    assert.equal(forecast.forecastPoints.length, horizon);
    assert.ok(forecast.forecastPoints.every((point) => Number.isFinite(point.predictedPrice) && point.predictedPrice > 0));
  }
});
