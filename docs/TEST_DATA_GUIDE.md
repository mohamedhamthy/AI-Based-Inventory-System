# Synthetic AHS Test Data

The generator creates clearly marked synthetic data for an isolated test database only. It does not seed the normal application database.

The dataset includes:

- One synthetic workspace.
- Administrator, Manager, Store Keeper, Sales Staff, and Viewer test accounts.
- Spare-parts categories and a synthetic supplier.
- Four synthetic product examples.
- At least 26 completed weeks of synthetic sales.
- Synthetic Retail market-price observations.
- Draft, ordered, partial, and cancelled purchase orders.
- Products with and without barcodes.
- Equal, below, and above-minimum stock examples.

No genuine Yamaha OEM part numbers, verified compatibility claims, real supplier identity, or real market prices are used.

## Safety requirements

- Set `MONGODB_TEST_URI` only to an isolated test database.
- The database name must end in `_test`.
- The suite/generator will refuse normal `MONGODB_URI`.
- The target must be replica-set or sharded for transaction testing.
- Every generated workspace, user, category, supplier, product, sale, stock movement, market price, and purchase order carries `testSuite=synthetic` and the same unique `testRunId`. These optional schema fields are ownership metadata; ordinary application requests cannot set them.
- Synthetic users also receive `testWorkspaceId` when workspace linkage succeeds. The exact suite/run markers—not email, name, role, or workspace membership—are the deletion evidence.
- Cleanup requires both `--suite=synthetic` and the exact `--run-id`. It deletes only matching marked records, then matching users, and only deletes a marked workspace after its marked children are removed and no child records or unrelated members remain.
- Unmarked records in a suite-owned workspace and records belonging to another run are preserved. A user with exact ownership markers can be listed and cleaned even if workspace creation/linkage was interrupted or the workspace is gone; users linked to an existing unrelated workspace are preserved.
- `--list` reports marked workspaces and users, including orphan users and whether each workspace link exists. An empty successful query prints `Query succeeded: 0 matching synthetic runs found.` Connection, target-validation, and query failures are reported as errors rather than empty results.
- Cleanup is ordinary deletion and can run against an isolated standalone `_test` database.

## Generate

PowerShell:

```powershell
$env:MONGODB_TEST_URI="mongodb://127.0.0.1:27017/ahs_synthetic_test"
$env:AHS_TEST_RUN_ID="replace-with-a-new-test-run-id"
npm run test-data:generate --workspace backend
Remove-Item Env:MONGODB_TEST_URI
Remove-Item Env:AHS_TEST_RUN_ID
```

## List and cleanup

PowerShell:

```powershell
$env:MONGODB_TEST_URI="mongodb://127.0.0.1:27017/ahs_synthetic_test"
npm run test-data:cleanup --workspace backend -- --list
npm run test-data:cleanup --workspace backend -- --run-id=replace-with-the-exact-listed-run-id
Remove-Item Env:MONGODB_TEST_URI
```

For interrupted integration artifacts, including orphan users created before workspace linkage:

```powershell
$env:MONGODB_TEST_URI="mongodb://127.0.0.1:27017/ahs_integration_test"
npm run test:integration:cleanup --workspace backend -- --suite=integration --list
npm run test:integration:cleanup --workspace backend -- --suite=integration --run-id=replace-with-the-exact-listed-run-id
Remove-Item Env:MONGODB_TEST_URI
```

An empty list prints an explicit zero-result success line. Review the suite, run ID, ownership markers, and reported linked/orphan user status before cleaning. Do not infer ownership from display names or emails.

Synthetic listing and cleanup may run on an isolated standalone `_test` database because they perform ordinary queries/deletes. Synthetic generation and integration execution require a replica set or sharded cluster for transactions. The run ID is printed before generation begins; retain it even if generation is interrupted.

Do not point these commands at development or production databases.

## Existing-workspace business sample dataset

The separate generator below is for an explicitly reviewed **local development database and existing workspace**. Unlike the isolated test-data generator above, it does not create a workspace or user, and it does not delete or update existing business records. All additions carry `dataOrigin=sample`, a dataset ID, and a deterministic record key. Product records use internal sample SKUs; no genuine OEM numbers, verified compatibility, real supplier identity, actual market prices, or payment confirmations are claimed. Generated sales are marked `Pending`.

The generator only accepts a MongoDB URI whose hosts are `localhost`, `127.0.0.1`, or `::1`, and the required `--database` must match its database name. It requires the specified active member to already belong to the selected workspace. Apply requires a transaction-capable replica set or sharded cluster.

Run the first command as a **read-only preflight**. It reports the target, workspace, existing counts, exact proposed inserts, unique-key collision status, and a confirmation token. Review that output and explicitly approve it before running the second command. The second command must repeat the same arguments (including the as-of date) and add `--apply --confirm-plan <token>`. A partial prior run, key collision, changed preflight, or unsupported database topology is refused. Repeating a completed dataset is a no-op.

PowerShell (run from the repository root; replace the placeholders only with the intended local database/workspace/member values):

```powershell
npm run sample-data --workspace backend -- --database <local-database-name> --workspace-id <existing-workspace-object-id> --member-id <active-member-object-id> --dataset-id ahs-local-sample-v1
```

After reviewing and approving the exact preflight output, use its printed `Asia/Colombo as-of date` and `Plan confirmation token`:

```powershell
npm run sample-data --workspace backend -- --database <same-local-database-name> --workspace-id <same-workspace-object-id> --member-id <same-active-member-object-id> --dataset-id ahs-local-sample-v1 --as-of <printed-YYYY-MM-DD> --apply --confirm-plan <printed-token>
```

Do not run the apply command until the exact preflight plan is approved. The generator does not read or print credentials; it uses the local `MONGODB_URI` from the backend process environment or its normal dotenv configuration. This repository task has not run either command against any database.
