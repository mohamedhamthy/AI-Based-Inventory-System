import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializeAdminSetup } from './bootstrapAdmin.js';

const createModels = ({ existingUsers = [], failWorkspaceCreation = false } = {}) => {
  const users = existingUsers.slice();
  const workspaces = [];
  let bootstrapState = null;
  let nextId = 1;

  const UserModel = {
    async exists(filter) {
      if (filter.role) {
        return users.some((user) => filter.role.$in.includes(user.role));
      }
      return users.some((user) => user.email === filter.email);
    },
    async create(values) {
      const user = { ...values, _id: `user-${nextId++}` };
      users.push(user);
      return user;
    },
    async deleteOne(filter) {
      const index = users.findIndex((user) => user._id === filter._id);
      if (index >= 0) users.splice(index, 1);
    },
  };
  const WorkspaceModel = {
    async create(values) {
      if (failWorkspaceCreation) throw new Error('workspace creation failed');
      const workspace = { ...values, _id: `workspace-${nextId++}` };
      workspaces.push(workspace);
      return workspace;
    },
    async deleteOne(filter) {
      const index = workspaces.findIndex((workspace) => workspace._id === filter._id);
      if (index >= 0) workspaces.splice(index, 1);
    },
  };
  const BootstrapStateModel = {
    async create(values) {
      if (bootstrapState) throw Object.assign(new Error('duplicate key'), { code: 11000 });
      bootstrapState = values;
      return bootstrapState;
    },
    async updateOne(filter, update) {
      if (!bootstrapState || bootstrapState._id !== filter._id || bootstrapState.token !== filter.token) {
        return { matchedCount: 0 };
      }
      Object.assign(bootstrapState, update.$set);
      return { matchedCount: 1 };
    },
    async deleteOne(filter) {
      if (bootstrapState?._id === filter._id && bootstrapState.token === filter.token) {
        bootstrapState = null;
      }
    },
  };

  return {
    models: { UserModel, WorkspaceModel, BootstrapStateModel },
    users,
    workspaces,
    getBootstrapState: () => bootstrapState,
  };
};

const setupInput = {
  name: 'AHS Administrator',
  email: 'ADMIN@AHSMOTORS.EXAMPLE',
  password: 'a-private-test-password',
};

test('initial admin setup creates an admin and owned workspace once', async () => {
  const fake = createModels();
  const result = await initializeAdminSetup(setupInput, fake.models);

  assert.equal(result.user.role, 'admin');
  assert.equal(result.user.email, 'admin@ahsmotors.example');
  assert.equal(fake.workspaces[0].name, 'Main workspace');
  assert.equal(fake.workspaces[0].systemKey, 'legacy-default');
  assert.deepEqual(fake.workspaces[0].members, [result.user._id]);
  assert.equal(fake.workspaces[0].owner, result.user._id);
  assert.equal(fake.getBootstrapState().state, 'completed');
  assert.ok(fake.getBootstrapState().claimedAt instanceof Date);
  assert.equal(typeof fake.getBootstrapState().hostname, 'string');
  assert.ok(Number.isSafeInteger(fake.getBootstrapState().processId));
});

test('bootstrap remains available when public registration created only employee accounts', async () => {
  const fake = createModels({
    existingUsers: [{ _id: 'registered-user', email: 'employee@example.test', role: 'employee' }],
  });
  const result = await initializeAdminSetup(setupInput, fake.models);

  assert.equal(result.user.role, 'admin');
  assert.equal(fake.users.length, 2);
  assert.equal(fake.workspaces[0].owner, result.user._id);
});

test('a repeated bootstrap attempt is rejected without creating another admin', async () => {
  const fake = createModels();
  await initializeAdminSetup(setupInput, fake.models);

  await assert.rejects(
    initializeAdminSetup({ ...setupInput, email: 'other@ahsmotors.example' }, fake.models),
    (error) => error.statusCode === 409,
  );
  assert.equal(fake.users.length, 1);
  assert.equal(fake.workspaces.length, 1);
});

test('bootstrap refuses to create another admin when an administrator already exists', async () => {
  const fake = createModels({ existingUsers: [{ _id: 'existing-admin', role: 'super_admin' }] });

  await assert.rejects(
    initializeAdminSetup(setupInput, fake.models),
    (error) => error.statusCode === 409,
  );
  assert.equal(fake.users.length, 1);
  assert.equal(fake.workspaces.length, 0);
  assert.equal(fake.getBootstrapState(), null);
});

test('bootstrap rollback retains its claim for explicit safe recovery', async () => {
  const fake = createModels({ failWorkspaceCreation: true });

  await assert.rejects(
    initializeAdminSetup(setupInput, fake.models),
    /claim was intentionally retained/,
  );
  assert.equal(fake.users.length, 0);
  assert.equal(fake.workspaces.length, 0);
  assert.equal(fake.getBootstrapState().state, 'initializing');
});
