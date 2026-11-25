import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RECOVERY_CONFIRMATION_PHRASE,
  recoverAdminBootstrap,
} from './bootstrapAdmin.js';

const makeRecoveryModels = ({ claim, hasAdministrator = false } = {}) => {
  let storedClaim = claim;
  let administratorChecks = 0;
  let findClaimCalls = 0;
  let deleteCalls = 0;

  return {
    models: {
      UserModel: {
        async exists() {
          administratorChecks += 1;
          return hasAdministrator;
        },
      },
      BootstrapStateModel: {
        findById() {
          findClaimCalls += 1;
          return { lean: async () => storedClaim };
        },
        async deleteOne(filter) {
          deleteCalls += 1;
          const matches = storedClaim
            && filter._id === storedClaim._id
            && filter.token === storedClaim.token
            && filter.state === storedClaim.state
            && filter.hostname === storedClaim.hostname
            && filter.processId === storedClaim.processId
            && filter.claimedAt === storedClaim.claimedAt;
          if (matches) storedClaim = null;
          return { deletedCount: matches ? 1 : 0 };
        },
      },
    },
    getClaim: () => storedClaim,
    getCounts: () => ({ administratorChecks, findClaimCalls, deleteCalls }),
  };
};

const makeClaim = (overrides = {}) => ({
  _id: 'initial-admin',
  state: 'initializing',
  token: 'test-claim-token',
  claimedAt: new Date(),
  hostname: 'test-host',
  processId: 876543,
  ...overrides,
});

const recoveryOptions = (models, overrides = {}) => ({
  ...models,
  databaseSettings: {
    nodeEnv: 'development',
    mongoUri: 'mongodb://127.0.0.1:27017/ai_inventory_test',
  },
  currentHostname: 'test-host',
  checkProcess: () => 'stopped',
  ...overrides,
});

test('recovery refuses an active bootstrap process and preserves its claim', async () => {
  const fake = makeRecoveryModels({ claim: makeClaim() });

  await assert.rejects(
    recoverAdminBootstrap(
      RECOVERY_CONFIRMATION_PHRASE,
      recoveryOptions(fake.models, { checkProcess: () => 'running' }),
    ),
    /still running; the claim was not removed/,
  );
  assert.ok(fake.getClaim());
  assert.equal(fake.getCounts().deleteCalls, 0);
});

test('recovery removes a stale claim only after confirming its owner process stopped', async () => {
  const fake = makeRecoveryModels({ claim: makeClaim() });

  const result = await recoverAdminBootstrap(
    RECOVERY_CONFIRMATION_PHRASE,
    recoveryOptions(fake.models),
  );

  assert.deepEqual(result, { recovered: true });
  assert.equal(fake.getClaim(), null);
  assert.equal(fake.getCounts().deleteCalls, 1);
});

test('recovery refuses when an admin or super-admin already exists', async () => {
  const fake = makeRecoveryModels({ claim: makeClaim(), hasAdministrator: true });

  await assert.rejects(
    recoverAdminBootstrap(RECOVERY_CONFIRMATION_PHRASE, recoveryOptions(fake.models)),
    /administrator exists/,
  );
  assert.ok(fake.getClaim());
  assert.equal(fake.getCounts().findClaimCalls, 0);
  assert.equal(fake.getCounts().deleteCalls, 0);
});

test('recovery rejects an incorrect confirmation phrase before database checks', async () => {
  const fake = makeRecoveryModels({ claim: makeClaim() });

  await assert.rejects(
    recoverAdminBootstrap('recover', recoveryOptions(fake.models)),
    /confirmation did not match/,
  );
  assert.ok(fake.getClaim());
  assert.deepEqual(fake.getCounts(), {
    administratorChecks: 0,
    findClaimCalls: 0,
    deleteCalls: 0,
  });
});

test('recovery fails safely if claim ownership cannot be verified', async () => {
  const fake = makeRecoveryModels({ claim: makeClaim({ hostname: 'different-host' }) });

  await assert.rejects(
    recoverAdminBootstrap(RECOVERY_CONFIRMATION_PHRASE, recoveryOptions(fake.models)),
    /ownership cannot be verified/,
  );
  assert.ok(fake.getClaim());
  assert.equal(fake.getCounts().deleteCalls, 0);
});

test('recovery refuses production or non-loopback database targets', async () => {
  for (const databaseSettings of [
    { nodeEnv: 'production', mongoUri: 'mongodb://127.0.0.1/ai_inventory_test' },
    { nodeEnv: 'development', mongoUri: 'mongodb://db.example.test/ai_inventory_test' },
  ]) {
    const fake = makeRecoveryModels({ claim: makeClaim() });
    await assert.rejects(
      recoverAdminBootstrap(
        RECOVERY_CONFIRMATION_PHRASE,
        recoveryOptions(fake.models, { databaseSettings }),
      ),
      /production|loopback/i,
    );
    assert.ok(fake.getClaim());
    assert.equal(fake.getCounts().deleteCalls, 0);
  }
});
