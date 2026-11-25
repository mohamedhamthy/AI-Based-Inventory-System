# Test Plan and Results

## Evidence classification

- **Unit tests:** deterministic logic tests run by Node's built-in test runner.
- **Mock-based service tests:** use in-memory substitutes or fake models instead of MongoDB.
- **Mongoose schema tests:** validate schema rules and update plans, but do not prove database index behavior.
- **Deterministic Python tests:** invoke local forecast algorithms with fixed inputs.
- **Real database integration tests:** not run unless `MONGODB_TEST_URI` is configured and topology safety checks pass.
- **Browser/device tests:** not run in the automated suite. Camera hardware was not accessed.

## Automated commands

Run these from the repository root:

```sh
npm test
npm run test:python
npm run lint
npm run build
git diff --check
```

For backend integration tests:

```sh
set MONGODB_TEST_URI=mongodb://127.0.0.1:27017/ahs_integration_test
npm run test:integration --workspace backend
```

PowerShell:

```powershell
$env:MONGODB_TEST_URI="mongodb://127.0.0.1:27017/ahs_integration_test"
npm run test:integration --workspace backend
Remove-Item Env:MONGODB_TEST_URI
```

The suite refuses databases whose names do not end in `_test`, refuses standalone topology, and never reads `MONGODB_URI` or `.env` fallback values.

## Focused integration coverage

The opt-in suite currently covers:

- Workspace-scoped barcode uniqueness and duplicate rejection.
- Multiple barcode-less products.
- Valid barcode uniqueness across workspaces.

Additional transaction scenarios are designed in the suite guide and remain to be expanded against a replica-set test deployment:

- Stock-In plus ledger.
- Sale plus stock/ledger consistency.
- Insufficient-stock rejection.
- Ledger-write rollback.
- Duplicate sale idempotency.
- Partial/full purchase receipt.
- Duplicate receipt prevention.
- Deactivation guards.
- Report/AI workspace isolation.

## Final validation status

- Full backend suite: **157 tests, 156 passed, 0 failed, 1 skipped**.
- Python forecast suite: **6 tests passed, 0 failed**.
- Backend and frontend lint: **passed**.
- Frontend production build: **passed**.
- `git diff --check`: **passed** for tracked changes.
- Opt-in Mongo integration suite: **prepared and skipped** because `MONGODB_TEST_URI` was not configured. No MongoDB, migration, seed, or transaction operation was run.
- Browser/device/manual tests: **Not Run**.
