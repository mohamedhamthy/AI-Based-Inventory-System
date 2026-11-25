import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDedicatedTestMongoUri, assertTransactionTopology } from './integrationSafety.js';

test('requires MONGODB_TEST_URI and rejects normal Mongo URI fallback ambiguity', () => {
  assert.throws(() => assertDedicatedTestMongoUri(), /MONGODB_TEST_URI is required/);
});

test('requires database name to end in _test', () => {
  assert.throws(
    () => assertDedicatedTestMongoUri('mongodb://127.0.0.1:27017/ai_inventory_system'),
    /must end with "_test"/,
  );
  assert.doesNotThrow(
    () => assertDedicatedTestMongoUri('mongodb://127.0.0.1:27017/ahs_synthetic_test'),
  );
});

test('accepts only MongoDB URI schemes', () => {
  assert.throws(
    () => assertDedicatedTestMongoUri('http://127.0.0.1:27017/ahs_test'),
    /mongodb:\/\/ or mongodb\+srv/,
  );
});

test('rejects standalone topology and accepts replica set or sharded cluster', async () => {
  await assert.rejects(
    assertTransactionTopology({
      connection: { db: { admin: () => ({ command: async () => ({ isWritablePrimary: true }) }) } },
    }),
    /Standalone MongoDB topology/,
  );
  await assert.doesNotReject(
    assertTransactionTopology({
      connection: { db: { admin: () => ({ command: async () => ({ setName: 'ahs-test-rs' }) }) } },
    }),
  );
  await assert.doesNotReject(
    assertTransactionTopology({
      connection: { db: { admin: () => ({ command: async () => ({ msg: 'isdbgrid' }) }) } },
    }),
  );
});
