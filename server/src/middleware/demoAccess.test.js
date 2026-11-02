import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.PORT = process.env.PORT || '5000';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai_inventory_system';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'security-test-secret-that-is-long-enough';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const { preventDemoWrites, requireTrustedOrigin, verifyCsrfToken } = await import('./demoAccessMiddleware.js');
const trustedOrigin = process.env.CLIENT_URL.split(',')[0];

const runMiddleware = (middleware, request) => {
  let error;
  let continued = false;
  middleware(request, {}, (nextError) => {
    error = nextError;
    continued = !nextError;
  });
  return { error, continued };
};

const makeRequest = ({ method = 'POST', role = 'demo', origin = trustedOrigin, csrfToken = 'expected-token', headerToken = 'expected-token', hasCookie = true } = {}) => ({
  method,
  user: { role },
  authSession: { csrfToken },
  cookies: hasCookie ? { inventory_session: 'session' } : {},
  get(name) {
    if (name === 'origin') return origin;
    if (name === 'x-csrf-token') return headerToken;
    return undefined;
  },
});

test('demo users can read but cannot write through protected application routes', () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    assert.equal(runMiddleware(preventDemoWrites, makeRequest({ method })).continued, true);
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const result = runMiddleware(preventDemoWrites, makeRequest({ method }));
    assert.equal(result.error?.statusCode, 403, `${method} should be rejected`);
  }
});

test('read-only gate does not change standard account permissions', () => {
  assert.equal(runMiddleware(preventDemoWrites, makeRequest({ role: 'employee', method: 'POST' })).continued, true);
  assert.equal(runMiddleware(preventDemoWrites, {
    ...makeRequest({ role: 'admin', method: 'POST' }),
    user: { role: 'admin', accountType: 'demo_user' },
  }).error?.statusCode, 403);
});

test('cookie-authenticated writes require the matching CSRF token and trusted origin', () => {
  assert.equal(runMiddleware(verifyCsrfToken, makeRequest()).continued, true);
  assert.equal(runMiddleware(verifyCsrfToken, makeRequest({ headerToken: 'wrong-token' })).error?.statusCode, 403);
  assert.equal(runMiddleware(verifyCsrfToken, makeRequest({ origin: 'https://attacker.example' })).error?.statusCode, 403);
  assert.equal(runMiddleware(verifyCsrfToken, makeRequest({ origin: null })).error?.statusCode, 403);
});

test('sign-in endpoints reject missing and untrusted browser origins', () => {
  assert.equal(runMiddleware(requireTrustedOrigin, makeRequest({ origin: trustedOrigin })).continued, true);
  assert.equal(runMiddleware(requireTrustedOrigin, makeRequest({ origin: 'https://attacker.example' })).error?.statusCode, 403);
  assert.equal(runMiddleware(requireTrustedOrigin, makeRequest({ origin: null })).error?.statusCode, 403);
});
