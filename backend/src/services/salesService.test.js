import assert from 'node:assert/strict';
import { test } from 'node:test';
import Sale from '../models/Sale.js';
import { getSalesPage } from './salesService.js';

test('sales staff history and summary remain scoped to their own workspace sales', async (t) => {
  const workspaceId = 'workspace-id';
  const userId = 'sales-user-id';
  const query = { workspaceId, createdBy: userId };
  let findFilter;
  let countFilter;
  let aggregateFilter;

  t.mock.method(Sale, 'find', (filter) => {
    findFilter = filter;
    return {
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      populate() { return this; },
      async lean() { return []; },
    };
  });
  t.mock.method(Sale, 'countDocuments', async (filter) => {
    countFilter = filter;
    return 0;
  });
  t.mock.method(Sale, 'aggregate', async (pipeline) => {
    aggregateFilter = pipeline[0].$match;
    return [];
  });

  await getSalesPage(workspaceId, 1, 10, { createdBy: userId });

  assert.deepEqual(findFilter, query);
  assert.deepEqual(countFilter, query);
  assert.deepEqual(aggregateFilter, query);
});
