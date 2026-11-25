import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildMarketPriceAnalysis,
  loadMarketPriceAnalysis,
} from './marketPriceAnalysis.js';

const workspaceId = '64b000000000000000000010';
const productId = '64b000000000000000000030';

const query = (value, observations = {}) => ({
  select() { return this; },
  sort(order) {
    observations.sorts?.push(order);
    return this;
  },
  limit(limit) {
    observations.limits?.push(limit);
    return this;
  },
  lean() { return Promise.resolve(value); },
});

test('market analysis returns average, latest, historical change and source comparisons', () => {
  const analysis = buildMarketPriceAnalysis([
    { priceType: 'Retail', price: 100, source: 'Shop A', recordedAt: new Date('2026-01-01T00:00:00Z') },
    { priceType: 'Retail', price: 120, source: 'Shop B', recordedAt: new Date('2026-01-02T00:00:00Z') },
    { priceType: 'Retail', price: 140, source: 'Shop A', recordedAt: new Date('2026-01-03T00:00:00Z') },
    { priceType: 'Wholesale', price: 80, source: 'Distributor', recordedAt: new Date('2026-01-03T00:00:00Z') },
  ]);
  assert.equal(analysis.observationsUsed, 4);
  assert.equal(analysis.byPriceType.Retail.averagePrice, 120);
  assert.equal(analysis.byPriceType.Retail.latestPrice, 140);
  assert.equal(analysis.byPriceType.Retail.changeAmount, 40);
  assert.equal(analysis.byPriceType.Retail.percentageChange, 40);
  assert.deepEqual(analysis.byPriceType.Retail.sourceComparisons.map(({ source }) => source), ['Shop A', 'Shop B']);
});

test('missing market observations remain unavailable rather than becoming zero prices', () => {
  const analysis = buildMarketPriceAnalysis([]);
  assert.equal(analysis.observationsUsed, 0);
  assert.equal(analysis.byPriceType.Retail.averagePrice, null);
  assert.equal(analysis.byPriceType.Retail.latestPrice, null);
  assert.equal(analysis.byPriceType.Retail.changeAmount, null);
});

test('same-date market observations use createdAt to select latest, earliest, and source prices', () => {
  const analysis = buildMarketPriceAnalysis([
    {
      priceType: 'Retail',
      price: 100,
      source: 'Shop A',
      recordedAt: new Date('2026-01-02T00:00:00Z'),
      createdAt: new Date('2026-01-02T07:00:00Z'),
    },
    {
      priceType: 'Retail',
      price: 120,
      source: 'Shop B',
      recordedAt: new Date('2026-01-02T00:00:00Z'),
      createdAt: new Date('2026-01-02T08:00:00Z'),
    },
    {
      priceType: 'Retail',
      price: 140,
      source: 'Shop A',
      recordedAt: new Date('2026-01-02T00:00:00Z'),
      createdAt: new Date('2026-01-02T09:00:00Z'),
    },
  ]);
  const retail = analysis.byPriceType.Retail;
  const shopA = retail.sourceComparisons.find(({ source }) => source === 'Shop A');

  assert.equal(retail.latestPrice, 140);
  assert.equal(retail.latestSource, 'Shop A');
  assert.equal(retail.earliestPrice, 100);
  assert.equal(retail.changeAmount, 40);
  assert.equal(shopA.latestPrice, 140);
});

test('market history and price recommendation query only the authenticated workspace product', async () => {
  const productQueries = [];
  const marketQueries = [];
  const querySorts = [];
  const queryLimits = [];
  const ProductModel = {
    findOne(filter) {
      productQueries.push(filter);
      return query({
        _id: productId,
        productName: 'Oil filter',
        sku: 'OF-1',
        currentStock: 4,
        minimumStock: 2,
        costPrice: 40,
        sellingPrice: 60,
      });
    },
  };
  const MarketPriceModel = {
    find(filter) {
      marketQueries.push(filter);
      return query(filter.priceType
        ? [{ price: 80, source: 'Shop A', recordedAt: new Date('2026-01-03T00:00:00Z') }]
        : [{ _id: 'record-1', price: 80, priceType: 'Retail', source: 'Shop A', recordedAt: new Date('2026-01-03T00:00:00Z') }],
      { sorts: querySorts, limits: queryLimits });
    },
  };
  const result = await loadMarketPriceAnalysis(productId, workspaceId, { ProductModel, MarketPriceModel });

  assert.deepEqual(productQueries[0], { _id: productId, workspaceId, isActive: true });
  assert.equal(marketQueries[0].workspaceId, workspaceId);
  assert.equal(marketQueries[0].product, productId);
  assert.equal(marketQueries[1].workspaceId, workspaceId);
  assert.equal(marketQueries[1].product, productId);
  assert.equal(result.sellingPriceRecommendation.suggestedSellingPrice, 80);
  assert.equal(result.product.sellingPrice, 60);
  assert.deepEqual(querySorts, [
    { recordedAt: -1, createdAt: -1 },
    { recordedAt: -1, createdAt: -1 },
  ]);
  assert.deepEqual(queryLimits, [501, 10]);
});

test('market history rejects a product that is not found in the requested workspace', async () => {
  await assert.rejects(loadMarketPriceAnalysis(productId, workspaceId, {
    ProductModel: { findOne: () => query(null) },
    MarketPriceModel: { find: () => { throw new Error('market data must not be queried'); } },
  }), (error) => error.statusCode === 404);
});
