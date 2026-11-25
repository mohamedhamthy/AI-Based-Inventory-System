import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validationResult } from 'express-validator';
import { validateIdempotencyKeyHeader } from './validation.js';

const getValidationErrors = async (idempotencyKey) => {
  const req = {
    headers: idempotencyKey === undefined ? {} : { 'idempotency-key': idempotencyKey },
    body: {},
    params: {},
    query: {},
  };
  await validateIdempotencyKeyHeader().run(req);
  return validationResult(req).array();
};

test('sales idempotency header rejects missing, blank, malformed, and oversized keys', async () => {
  for (const key of [undefined, '', '      ', 'short', 'bad key', 'x'.repeat(129)]) {
    const errors = await getValidationErrors(key);
    assert.ok(errors.length > 0, `expected key ${String(key)} to be invalid`);
  }
});

test('sales idempotency header accepts a valid UUID-style key', async () => {
  assert.deepEqual(await getValidationErrors('6b7833b0-7ee1-4e20-b24f-35b682aef00d'), []);
});
