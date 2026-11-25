import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.PORT = '5000';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/ai_inventory_test';
process.env.JWT_SECRET = 'security-test-secret-that-is-long-enough';
process.env.JWT_EXPIRES_IN = '1d';
process.env.CLIENT_URL = 'http://localhost:5173';

const { default: authRoutes } = await import('../routes/authRoutes.js');

test('public registration endpoint rejects account creation', async () => {
  const registrationRoute = authRoutes.stack.find((layer) => layer.route?.path === '/register')?.route;
  assert.ok(registrationRoute, 'the retired endpoint should return an explicit denial');
  const rejectRegistration = registrationRoute.stack[registrationRoute.stack.length - 1].handle;
  const error = await new Promise((resolve) => rejectRegistration({}, {}, resolve));

  assert.equal(error.statusCode, 403);
  assert.match(error.message, /public account registration is disabled/i);
});
