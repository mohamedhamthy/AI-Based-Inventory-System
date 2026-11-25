import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCustomer, getCustomersPage } from './customerService.js';

const workspaceId = '64b000000000000000000010';
const userId = '64b000000000000000000050';

test('customer listing is workspace-scoped, searchable, and paginated', async () => {
  let capturedQuery;
  const customers = [{ _id: 'customer-1', workspaceId, name: 'Fictional Customer' }];
  const CustomerModel = {
    find(query) {
      capturedQuery = query;
      return {
        sort() { return this; },
        skip() { return this; },
        limit() { return this; },
        lean: async () => customers,
      };
    },
    countDocuments: async (query) => {
      assert.equal(query, capturedQuery);
      return customers.length;
    },
  };
  const result = await getCustomersPage({
    workspaceId,
    page: 2,
    limit: 10,
    search: 'Customer',
  }, { CustomerModel });

  assert.equal(capturedQuery.workspaceId, workspaceId);
  assert.equal(capturedQuery.isActive, true);
  assert.ok(capturedQuery.$or.every((condition) => Object.values(condition)[0].test('Fictional Customer')));
  assert.equal(result.customers, customers);
  assert.deepEqual(result.pagination, { page: 2, limit: 10, totalItems: 1, totalPages: 1 });
});

test('customer creation validates names and retains explicit internal sample provenance', async () => {
  let saved;
  const CustomerModel = {
    create: async (record) => {
      saved = record;
      return record;
    },
  };
  const customer = await createCustomer({
    workspaceId,
    userId,
    name: '  Fictional Customer  ',
    phone: '077 000 1001',
    address: 'Fictional sample address, Sammanthurai',
    sampleData: {
      dataOrigin: 'sample',
      sampleDatasetId: 'test-dataset',
      sampleRecordKey: 'customer-01',
    },
  }, { CustomerModel });

  assert.equal(customer.name, 'Fictional Customer');
  assert.equal(saved.workspaceId, workspaceId);
  assert.equal(saved.createdBy, userId);
  assert.equal(saved.dataOrigin, 'sample');
  await assert.rejects(createCustomer({
    workspaceId,
    userId,
    name: 'x',
  }, { CustomerModel }), (error) => error.statusCode === 400);
});
