import assert from 'node:assert/strict';
import { test } from 'node:test';
import Workspace from '../models/Workspace.js';
import { requireWorkspace } from './workspaceMiddleware.js';

const invoke = (middleware, request) => new Promise((resolve) => {
  middleware(request, {}, (error) => resolve(error));
});

test('workspace selection never trusts an id without the authenticated user membership', async (t) => {
  const userId = 'user-id';
  const permittedWorkspace = { _id: 'member-workspace' };
  const queries = [];
  t.mock.method(Workspace, 'findOne', (query) => {
    queries.push(query);
    return {
      sort() {
        return this;
      },
      async lean() {
        return query._id ? null : permittedWorkspace;
      },
    };
  });

  const request = {
    headers: { 'x-workspace-id': '64b000000000000000000001' },
    user: { _id: userId },
  };
  const error = await invoke(requireWorkspace, request);

  assert.equal(error, undefined);
  assert.equal(request.workspaceId, permittedWorkspace._id);
  assert.deepEqual(queries[0], { _id: request.headers['x-workspace-id'], members: userId });
  assert.deepEqual(queries[1], { members: userId });
});
