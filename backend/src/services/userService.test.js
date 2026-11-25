import assert from 'node:assert/strict';
import { test } from 'node:test';
import User from '../models/User.js';
import { createUserAccount, updateUserAccount } from './userService.js';

test('an administrator can create a staff account and add it to the selected workspace', async () => {
  const session = { id: 'user-create-session' };
  let createdValues;
  let workspaceUpdate;
  const safeUser = {
    _id: 'new-user-id',
    name: 'Parts Clerk',
    email: 'clerk@example.test',
    role: 'employee',
  };
  const UserModel = {
    findOne(filter) {
      assert.deepEqual(filter, { email: 'clerk@example.test' });
      return { session: async (usedSession) => {
        assert.equal(usedSession, session);
        return null;
      } };
    },
    async create(values, options) {
      assert.deepEqual(options, { session });
      createdValues = values[0];
      return [{ _id: safeUser._id, toSafeObject: () => safeUser }];
    },
  };
  const WorkspaceModel = {
    async updateOne(filter, update, options) {
      workspaceUpdate = { filter, update, options };
      return { matchedCount: 1 };
    },
  };

  const user = await createUserAccount({
    actor: { _id: 'admin-id', role: 'admin' },
    workspaceId: 'workspace-id',
    name: '  Parts Clerk  ',
    email: 'Clerk@Example.Test ',
    password: 'temporary-test-password',
    role: 'employee',
  }, {
    UserModel,
    WorkspaceModel,
    transaction: (operation) => operation(session),
  });

  assert.deepEqual(createdValues, {
    name: 'Parts Clerk',
    email: 'clerk@example.test',
    password: 'temporary-test-password',
    role: 'employee',
  });
  assert.deepEqual(workspaceUpdate, {
    filter: { _id: 'workspace-id', members: 'admin-id' },
    update: { $addToSet: { members: 'new-user-id' } },
    options: { session },
  });
  assert.deepEqual(user, safeUser);
});

test('an administrator cannot create a super-admin account', async () => {
  let transactionCalls = 0;

  await assert.rejects(createUserAccount({
    actor: { _id: 'admin-id', role: 'admin' },
    workspaceId: 'workspace-id',
    name: 'Privileged User',
    email: 'privileged@example.test',
    password: 'temporary-test-password',
    role: 'super_admin',
  }, {
    transaction: async () => { transactionCalls += 1; },
  }), (error) => error.statusCode === 403);

  assert.equal(transactionCalls, 0);
});

test('duplicate staff account emails are rejected before creating a user', async () => {
  let createCalls = 0;
  const UserModel = {
    findOne: () => ({ session: async () => ({ _id: 'existing-user' }) }),
    create: async () => { createCalls += 1; return []; },
  };

  await assert.rejects(createUserAccount({
    actor: { _id: 'admin-id', role: 'admin' },
    workspaceId: 'workspace-id',
    name: 'Parts Clerk',
    email: 'clerk@example.test',
    password: 'temporary-test-password',
    role: 'employee',
  }, {
    UserModel,
    WorkspaceModel: {},
    transaction: (operation) => operation({ id: 'user-create-session' }),
  }), (error) => error.statusCode === 409);

  assert.equal(createCalls, 0);
});

test('an admin cannot manage a super-admin account', async (t) => {
  const target = {
    _id: { equals: (id) => id === 'super-admin-id' },
    role: 'super_admin',
    isActive: true,
  };
  t.mock.method(User, 'findById', () => ({ select: async () => target }));

  await assert.rejects(
    updateUserAccount({
      actor: { _id: 'admin-id', role: 'admin' },
      userId: 'target-id',
      changes: { role: 'manager' },
    }),
    (error) => error.statusCode === 403,
  );
});

test('super-admin accounts cannot be demoted or disabled through the API', async (t) => {
  const target = {
    _id: { equals: () => false },
    role: 'super_admin',
    isActive: true,
  };
  t.mock.method(User, 'findById', () => ({ select: async () => target }));
  t.mock.method(User, 'countDocuments', async () => 0);

  await assert.rejects(
    updateUserAccount({
      actor: { _id: 'other-admin', role: 'super_admin' },
      userId: 'target-id',
      changes: { isActive: false },
    }),
    (error) => error.statusCode === 403,
  );
});

test('competing requests cannot demote and deactivate the same super-admin', async (t) => {
  const target = {
    _id: { equals: () => false },
    role: 'super_admin',
    isActive: true,
  };
  t.mock.method(User, 'findById', () => ({ select: async () => target }));
  const update = t.mock.method(User, 'findByIdAndUpdate', async () => {
    throw new Error('Super-admin update must not execute');
  });

  const results = await Promise.allSettled([
    updateUserAccount({
      actor: { _id: 'admin-one', role: 'super_admin' },
      userId: 'target-id',
      changes: { role: 'manager' },
    }),
    updateUserAccount({
      actor: { _id: 'admin-two', role: 'super_admin' },
      userId: 'target-id',
      changes: { isActive: false },
    }),
  ]);

  assert.deepEqual(results.map((result) => result.status), ['rejected', 'rejected']);
  assert.ok(results.every((result) => result.reason.statusCode === 403));
  assert.equal(update.mock.callCount(), 0);
});
