import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanupOwnedRun,
  createTestOwnershipTracker,
  formatOwnedRuns,
  listOwnedRuns,
} from './testOwnedCleanup.js';

const createMockModel = (initialRows, events, collectionName) => {
  const rows = [...initialRows];
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
    if (key === '_id' && value?.$in) return value.$in.includes(row._id);
    if (value && typeof value === 'object' && value.$in) {
      return value.$in.includes(row[key]) || (Array.isArray(row[key]) && row[key].some((item) => value.$in.includes(item)));
    }
    return row[key] === value;
  });
  return {
    rows,
    find(filter) {
      if (events.failFind === collectionName) throw new Error(`${collectionName} query failed`);
      const selected = rows.filter((row) => matches(row, filter));
      return {
        select: async () => selected,
      };
    },
    async deleteMany(filter) {
      events.operations.push(`delete:${collectionName}`);
      const matchedRows = rows.filter((row) => matches(row, filter));
      for (const match of matchedRows) rows.splice(rows.indexOf(match), 1);
      return { deletedCount: matchedRows.length };
    },
    async countDocuments(filter) {
      return rows.filter((row) => matches(row, filter)).length;
    },
  };
};

const createModels = ({ workspaces = [], users = [], records = [] } = {}) => {
  const events = { operations: [], failFind: null };
  const models = {
    events,
    Workspace: createMockModel(workspaces, events, 'Workspace'),
    User: createMockModel(users, events, 'User'),
    records: records.map(({ name, rows }) => ({
      name,
      Model: createMockModel(rows, events, name),
    })),
  };
  return models;
};

test('ownership tracker registers IDs immediately and isolates each run', () => {
  const tracker = createTestOwnershipTracker({ suite: 'integration', runId: 'run-a' });
  tracker.registerWorkspace('workspace-a');
  tracker.registerUser('user-a');
  tracker.registerRecord('record-a');

  assert.deepEqual(tracker.snapshot(), {
    workspaceIds: ['workspace-a'],
    userIds: ['user-a'],
    recordIds: ['record-a'],
  });
});

test('cleanup deletes only exact-run records and preserves unmarked or other-run records', async () => {
  const models = createModels({
    workspaces: [
      { _id: 'workspace-a', testSuite: 'synthetic', testRunId: 'run-a' },
      { _id: 'workspace-b', testSuite: 'synthetic', testRunId: 'run-b' },
    ],
    users: [
      { _id: 'user-a', email: 'similar@example.test', testSuite: 'synthetic', testRunId: 'run-a' },
      { _id: 'user-b', email: 'similar@example.test', testSuite: 'synthetic', testRunId: 'run-b' },
      { _id: 'user-unmarked', email: 'test-admin-run-a@ahs-synthetic.invalid' },
    ],
    records: [{
      name: 'Product',
      rows: [
        { _id: 'product-a', workspaceId: 'workspace-a', testSuite: 'synthetic', testRunId: 'run-a' },
        { _id: 'product-other-run', workspaceId: 'workspace-a', testSuite: 'synthetic', testRunId: 'run-b' },
        { _id: 'product-unmarked', workspaceId: 'workspace-a' },
      ],
    }],
  });

  const result = await cleanupOwnedRun({
    suite: 'synthetic',
    runId: 'run-a',
    ...models,
  });

  assert.equal(result.deletedRecords[0].deletedCount, 1);
  assert.deepEqual(models.records[0].Model.rows.map((row) => row._id), ['product-other-run', 'product-unmarked']);
  assert.deepEqual(models.User.rows.map((user) => user._id), ['user-b', 'user-unmarked']);
  assert.deepEqual(models.Workspace.rows.map((workspace) => workspace._id), ['workspace-a', 'workspace-b']);
  assert.ok(models.events.operations.indexOf('delete:Product') < models.events.operations.indexOf('delete:Workspace'));
});

test('orphan exact-run users are listed and cleaned without matching email evidence', async () => {
  const models = createModels({
    users: [
      { _id: 'orphan-a', email: 'ordinary@example.test', testSuite: 'synthetic', testRunId: 'run-a' },
      { _id: 'orphan-other-run', email: 'similar@example.test', testSuite: 'synthetic', testRunId: 'run-b' },
      { _id: 'unmarked-similar', email: 'test-viewer-run-a@ahs-synthetic.invalid' },
    ],
  });

  const runs = await listOwnedRuns({ suite: 'synthetic', ...models });
  assert.equal(runs.length, 2);
  const runA = runs.find((run) => run.testRunId === 'run-a');
  assert.equal(runA.orphanUsers.length, 1);
  assert.equal(runA.orphanUsers[0].workspaceLinkExists, false);

  const cleanup = await cleanupOwnedRun({ suite: 'synthetic', runId: 'run-a', ...models });
  assert.equal(cleanup.deletedUserCount, 1);
  assert.deepEqual(models.User.rows.map((user) => user._id), ['orphan-other-run', 'unmarked-similar']);
});

test('primary and secondary suite workspaces are both cleaned by exact run markers', async () => {
  const models = createModels({
    workspaces: [
      { _id: 'primary', testSuite: 'integration', testRunId: 'run-a' },
      { _id: 'secondary', testSuite: 'integration', testRunId: 'run-a' },
      { _id: 'other', testSuite: 'integration', testRunId: 'run-b' },
    ],
    records: [{
      name: 'Category',
      rows: [
        { _id: 'c1', workspaceId: 'primary', testSuite: 'integration', testRunId: 'run-a' },
        { _id: 'c2', workspaceId: 'secondary', testSuite: 'integration', testRunId: 'run-a' },
        { _id: 'c3', workspaceId: 'secondary' },
      ],
    }],
  });

  const result = await cleanupOwnedRun({ suite: 'integration', runId: 'run-a', ...models });
  assert.equal(result.deletedWorkspaceCount, 1);
  assert.deepEqual(models.Workspace.rows.map((workspace) => workspace._id), ['secondary', 'other']);
  assert.deepEqual(models.records[0].Model.rows.map((record) => record._id), ['c3']);
});

test('preserves an exact-run user linked to an unrelated existing workspace', async () => {
  const models = createModels({
    workspaces: [
      { _id: 'suite-workspace', owner: 'user-a', members: ['user-a'], testSuite: 'integration', testRunId: 'run-a' },
      { _id: 'unrelated-workspace', testSuite: 'synthetic', testRunId: 'other-run' },
    ],
    users: [
      { _id: 'user-a', testSuite: 'integration', testRunId: 'run-a', testWorkspaceId: 'unrelated-workspace' },
    ],
  });

  const result = await cleanupOwnedRun({ suite: 'integration', runId: 'run-a', ...models });

  assert.equal(result.deletedUserCount, 0);
  assert.equal(result.deletedWorkspaceCount, 0);
  assert.deepEqual(models.User.rows.map((user) => user._id), ['user-a']);
  assert.deepEqual(models.Workspace.rows.map((workspace) => workspace._id), ['suite-workspace', 'unrelated-workspace']);
});

test('empty list has explicit success status and query failure remains distinguishable', async () => {
  const emptyModels = createModels();
  const runs = await listOwnedRuns({ suite: 'synthetic', ...emptyModels });
  assert.equal(formatOwnedRuns(runs, 'synthetic'), 'Query succeeded: 0 matching synthetic runs found.');

  const failingModels = createModels();
  failingModels.events.failFind = 'Workspace';
  await assert.rejects(
    listOwnedRuns({ suite: 'synthetic', ...failingModels }),
    /Workspace query failed/,
  );
});
