import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertExpectedCounts,
  EXPECTED_COLLECTION_COUNTS,
} from './removeDemoWorkspace.js';

const expectedCounts = {
  ...EXPECTED_COLLECTION_COUNTS,
  sessions: 0,
  demoUser: 1,
  demoWorkspace: 1,
  mainWorkspaceMembershipReferences: 1,
};
const expectedTarget = { totalWorkspaces: 2, totalUsers: 5 };

test('demo removal accepts only the reviewed collection and identity counts', () => {
  assert.doesNotThrow(() => assertExpectedCounts(expectedCounts, expectedTarget));

  for (const [collection, expected] of Object.entries(EXPECTED_COLLECTION_COUNTS)) {
    assert.throws(() => assertExpectedCounts({
      ...expectedCounts,
      [collection]: expected + 1,
    }, expectedTarget), new RegExp(`${collection} count is ${expected + 1}`));
  }
  assert.throws(() => assertExpectedCounts(expectedCounts, { totalWorkspaces: 3, totalUsers: 5 }), /expected 2 workspaces and 5 users/);
});

test('demo removal defaults to a non-applying preflight and refuses an unset database target', () => {
  const script = fileURLToPath(new URL('./removeDemoWorkspace.js', import.meta.url));
  const result = spawnSync(process.execPath, [script], {
    cwd: tmpdir(),
    env: { ...process.env, MONGODB_URI: '' },
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true,
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /MONGODB_URI is not configured; no database connection was attempted\./);
  assert.doesNotMatch(result.stdout, /DEMO WORKSPACE REMOVAL PREFLIGHT/);
});
