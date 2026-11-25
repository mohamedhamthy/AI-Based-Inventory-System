import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.PORT = '5000';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/ai_inventory_test';
process.env.JWT_SECRET = 'security-test-secret-that-is-long-enough';
process.env.JWT_EXPIRES_IN = '1d';
process.env.CLIENT_URL = 'http://localhost:5173';

const { authorizePermissions, protect } = await import('./authMiddleware.js');

const invoke = (middleware, request) => new Promise((resolve) => {
  middleware(request, {}, (error) => resolve(error));
});

test('missing authentication returns 401', async () => {
  const error = await invoke(protect, { headers: {}, cookies: {} });
  assert.equal(error.statusCode, 401);
});

test('authenticated but unauthorized API action returns 403', async () => {
  const error = await invoke(authorizePermissions('users:manage'), {
    user: { role: 'employee' },
  });
  assert.equal(error.statusCode, 403);
});

test('authorized role proceeds through the permission middleware', async () => {
  const error = await invoke(authorizePermissions('sales:create'), {
    user: { role: 'employee' },
  });
  assert.equal(error, undefined);
});

test('staff account creation requires administrator user-management permission', async () => {
  for (const role of ['admin', 'super_admin']) {
    assert.equal(await invoke(authorizePermissions('users:manage'), { user: { role } }), undefined);
  }
  for (const role of ['manager', 'store_keeper', 'employee', 'viewer', 'demo']) {
    const error = await invoke(authorizePermissions('users:manage'), { user: { role } });
    assert.equal(error.statusCode, 403, `${role} must not create staff accounts`);
  }
});

test('workspace creation is allowed only for admins and super admins', async () => {
  for (const role of ['admin', 'super_admin']) {
    assert.equal(await invoke(authorizePermissions('workspaces:manage'), { user: { role } }), undefined);
  }
  for (const role of ['manager', 'store_keeper', 'employee', 'viewer', 'demo']) {
    const error = await invoke(authorizePermissions('workspaces:manage'), { user: { role } });
    assert.equal(error.statusCode, 403, `${role} must be denied`);
  }
});

test('demo and viewer can read sales but cannot write sales', async () => {
  for (const role of ['demo', 'viewer']) {
    assert.equal(await invoke(authorizePermissions('sales:read'), { user: { role } }), undefined);
    const error = await invoke(authorizePermissions('sales:create'), { user: { role } });
    assert.equal(error.statusCode, 403);
  }
});

test('dashboard, alert, and report endpoints enforce their permission scopes', async () => {
  for (const role of ['admin', 'super_admin', 'manager', 'store_keeper', 'employee', 'viewer', 'demo']) {
    assert.equal(await invoke(authorizePermissions('dashboard:read'), { user: { role } }), undefined);
  }
  for (const role of ['admin', 'super_admin', 'manager', 'store_keeper']) {
    assert.equal(await invoke(authorizePermissions('stock:manage'), { user: { role } }), undefined);
  }
  for (const role of ['employee', 'viewer', 'demo']) {
    assert.equal((await invoke(authorizePermissions('stock:manage'), { user: { role } })).statusCode, 403);
  }
  for (const role of ['admin', 'super_admin', 'manager']) {
    assert.equal(await invoke(authorizePermissions('reports:read'), { user: { role } }), undefined);
  }
  for (const role of ['store_keeper', 'employee', 'viewer', 'demo']) {
    assert.equal((await invoke(authorizePermissions('reports:read'), { user: { role } })).statusCode, 403);
  }
});
