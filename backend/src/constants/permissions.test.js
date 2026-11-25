import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasPermission } from './permissions.js';

test('administrator permissions include user administration and AI operations', () => {
  for (const role of ['admin', 'super_admin']) {
    assert.equal(hasPermission(role, 'users:manage'), true);
    assert.equal(hasPermission(role, 'products:delete'), true);
    assert.equal(hasPermission(role, 'ai:use'), true);
    assert.equal(hasPermission(role, 'marketPrices:manage'), true);
  }
});

test('inventory managers can manage inventory and use insights, but not users', () => {
  assert.equal(hasPermission('manager', 'products:update'), true);
  assert.equal(hasPermission('manager', 'catalog:manage'), true);
  assert.equal(hasPermission('manager', 'reports:read'), true);
  assert.equal(hasPermission('manager', 'ai:use'), true);
  assert.equal(hasPermission('manager', 'stock:manage'), true);
  assert.equal(hasPermission('manager', 'users:manage'), false);
  assert.equal(hasPermission('manager', 'marketPrices:manage'), false);
});

test('only admins and super admins can manage workspaces', () => {
  assert.equal(hasPermission('admin', 'workspaces:manage'), true);
  assert.equal(hasPermission('super_admin', 'workspaces:manage'), true);
  for (const role of ['manager', 'store_keeper', 'employee', 'viewer', 'demo']) {
    assert.equal(hasPermission(role, 'workspaces:manage'), false, `${role} must not create workspaces`);
  }
});

test('system management remains exclusive to super admins', () => {
  assert.equal(hasPermission('super_admin', 'system:manage'), true);
  assert.equal(hasPermission('admin', 'system:manage'), false);
});

test('sales staff can read stock and record sales, but cannot administer inventory', () => {
  assert.equal(hasPermission('employee', 'products:read'), true);
  assert.equal(hasPermission('employee', 'sales:create'), true);
  assert.equal(hasPermission('employee', 'products:update'), false);
  assert.equal(hasPermission('employee', 'users:manage'), false);
  assert.equal(hasPermission('employee', 'ai:use'), false);
});

test('viewer remains read-only', () => {
  for (const permission of ['products:create', 'products:update', 'products:delete', 'catalog:manage', 'stock:manage', 'sales:create', 'users:manage']) {
    assert.equal(hasPermission('viewer', permission), false, `${permission} must be denied`);
  }
  assert.equal(hasPermission('viewer', 'products:read'), true);
  assert.equal(hasPermission('viewer', 'sales:read'), true);
});

test('demo and viewer can read sales but cannot create or manage sales', () => {
  for (const role of ['demo', 'viewer']) {
    assert.equal(hasPermission(role, 'sales:read'), true);
    assert.equal(hasPermission(role, 'sales:create'), false);
    assert.equal(hasPermission(role, 'sales:update'), false);
    assert.equal(hasPermission(role, 'sales:delete'), false);
  }
});

test('store keeper retains stock work without catalog or user administration', () => {
  assert.equal(hasPermission('store_keeper', 'products:update'), true);
  assert.equal(hasPermission('store_keeper', 'stock:manage'), true);
  assert.equal(hasPermission('store_keeper', 'sales:create'), true);
  assert.equal(hasPermission('store_keeper', 'catalog:manage'), false);
  assert.equal(hasPermission('store_keeper', 'products:delete'), false);
  assert.equal(hasPermission('store_keeper', 'users:manage'), false);
});

test('purchase order access matches admin, manager, and store keeper responsibilities', () => {
  for (const role of ['super_admin', 'admin', 'manager']) {
    for (const permission of [
      'purchaseOrders:read',
      'purchaseOrders:create',
      'purchaseOrders:manage',
      'purchaseOrders:receive',
    ]) {
      assert.equal(hasPermission(role, permission), true, `${role} must have ${permission}`);
    }
  }

  assert.equal(hasPermission('store_keeper', 'purchaseOrders:read'), true);
  assert.equal(hasPermission('store_keeper', 'purchaseOrders:receive'), true);
  assert.equal(hasPermission('store_keeper', 'purchaseOrders:create'), false);
  assert.equal(hasPermission('store_keeper', 'purchaseOrders:manage'), false);
  for (const role of ['employee', 'viewer', 'demo']) {
    for (const permission of [
      'purchaseOrders:read',
      'purchaseOrders:create',
      'purchaseOrders:manage',
      'purchaseOrders:receive',
    ]) {
      assert.equal(hasPermission(role, permission), false, `${role} must not have ${permission}`);
    }
  }
});

test('sales staff and demo users cannot receive or adjust stock', () => {
  for (const role of ['employee', 'viewer', 'demo']) {
    assert.equal(hasPermission(role, 'stock:manage'), false, `${role} must not manage stock`);
  }
});

test('dashboard, low-stock alerts, and reports use the existing role matrix', () => {
  for (const role of ['super_admin', 'admin', 'manager', 'store_keeper', 'employee', 'viewer', 'demo']) {
    assert.equal(hasPermission(role, 'dashboard:read'), true, `${role} must retain dashboard access`);
  }
  for (const role of ['super_admin', 'admin', 'manager', 'store_keeper']) {
    assert.equal(hasPermission(role, 'stock:manage'), true, `${role} may view stock alerts`);
  }
  for (const role of ['employee', 'viewer', 'demo']) {
    assert.equal(hasPermission(role, 'stock:manage'), false, `${role} must not receive the new alert view`);
  }
  for (const role of ['super_admin', 'admin', 'manager']) {
    assert.equal(hasPermission(role, 'reports:read'), true, `${role} must access reports`);
  }
  for (const role of ['store_keeper', 'employee', 'viewer', 'demo']) {
    assert.equal(hasPermission(role, 'reports:read'), false, `${role} must not gain report access`);
  }
});
