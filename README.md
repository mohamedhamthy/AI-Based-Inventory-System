# AI-Based Parts Management System

A responsive inventory and spare-parts management platform for **AHS Motors** — **Yamaha Spare Parts · Sammanthurai**, Sri Lanka. Built with React, Vite, Express, MongoDB, and JWT authentication.

Inventory management is the primary purpose of the system. Product records remain workspace-scoped in the existing Product collection.

## Features

- Inventory dashboard, reports, sales, purchase orders, categories, suppliers, stock movements, and forecasts
- Workspace-isolated inventory data with role-based access and HTTP-only authentication cookies
- Global user management for admins and super admins, including account role and sign-in status controls
- Paginated product and sales APIs
- Workspace-local sales demand forecasts, market-price model selection, and an inventory assistant
- Responsive dark-theme interface

## Spare-parts catalogue

- The existing `sku` field is displayed as the part number and supports case-insensitive partial search alongside the part name, barcode, manufacturer, and compatible-model text.
- An optional `oemPartNumber` field stores a separately verified genuine/OEM part number. It is unique within a workspace when provided. Existing SKU behavior is retained.
- Part numbers remain unique per workspace under the existing (case-sensitive) database index, while catalogue search is case-insensitive; no Yamaha OEM numbering format is assumed or normalized.
- `manufacturer`, `compatibleModels`, `barcode`, and descriptive fields remain optional for existing and incomplete product records. Enter compatible Yamaha models only when verified.
- Product selection in sales, stock receipts, and purchase orders displays the part number and available stock context; barcode scanning keeps manual entry as a fallback when camera access is unavailable.

## Actual inventory import and demo data

The repository does not contain verified AHS Motors product, supplier, purchase-price, selling-price, or stock records. Do not treat example values or unverified product compatibility as business data. The separate [DEMO DATA CSV](docs/sample-data/DEMO_PARTS_DATASET.csv) contains fictional, explicitly labeled examples only; it is not seeded, imported, or loaded at application startup.

Older static frontend mock fixtures are also unused by the application and are marked `DEMO DATA - NOT FOR IMPORT`; they are not Yamaha fitment references or AHS Motors business records.

To enter verified business data:

1. Create the required categories and suppliers in the active workspace.
2. Open **Parts Management → Import CSV** and download the import template, or add products individually.
3. Use `ACTUAL` in the `Record type` column. The preview rejects demo/test/unclassified rows, validates required values and workspace category/supplier references, and checks SKU, OEM number, and barcode duplicates within the file and against existing active and inactive products.
4. Review the row-level preview and confirm that the records are actual shop data. Import creates new products only; it never overwrites existing records. Correct rejected rows and upload again.
5. Any non-zero opening stock is recorded through the existing stock ledger and transaction workflow. Import does not write stock directly.
6. Use **Export catalog** to download the current catalog in the same CSV-compatible format. Exports are workspace-scoped, protected against spreadsheet-formula injection, and limited to 20,000 rows.

The CSV accepts product name, SKU, optional genuine/OEM number, optional barcode, category and supplier names, manufacturer, verified compatible models, LKR purchase/selling prices, stock/minimum/maximum quantities, rack location, description, active status, and record type. Consult the [user guide](docs/USER_GUIDE.md) for the complete workflow.

The checked-in sample generator creates clearly marked synthetic records only. Its inventory, compatibility text, contacts, prices, and transactions are illustrative and are not verified shop data. See the [synthetic dataset notes](docs/SYNTHETIC_DATASET.md).

## Project layout

```text
frontend/
  public/
  src/
    assets/
    components/
    contexts/
    data/
    pages/
    routes/
    services/
    styles/
    utils/
  package.json
backend/
  src/
    ai/
    config/
    controllers/
    middleware/
    models/
    routes/
    services/
    seed/
    utils/
    validators/
  package.json
package.json
```

The root package is an npm workspace for the independent frontend and backend packages.

## Local development

Requirements: Node.js 20.19+ or 22.12+, npm, MongoDB 5.0+ (weekly demand aggregation uses `$dateTrunc`), and Python 3.9+ for market-price forecasts.

1. Install all workspace dependencies from the repository root:

   ```sh
   npm install
   ```

2. Create local environment files:

   ```sh
   cp frontend/.env.example frontend/.env
   cp backend/.env.example backend/.env
   ```

   On Windows PowerShell, use `Copy-Item frontend\.env.example frontend\.env` and `Copy-Item backend\.env.example backend\.env`.

3. Configure `MONGODB_URI` in `backend/.env`, and set a private `JWT_SECRET` of at least 32 characters. Keep `.env` files private and untracked.
4. Start the API and frontend in separate terminals from the repository root:

   ```sh
   npm run dev:backend
   npm run dev:frontend
   ```

   The API health check is at `http://localhost:5000/health`; Vite serves the frontend at `http://localhost:5173`.

Other useful commands:

```sh
npm run build
npm run lint
npm test
npm run test:python
```

The backend uses `AI_PYTHON_EXECUTABLE` to select the Python executable for API forecast requests.

## Initial administrator setup

For a fresh local installation, configure `backend/.env` to use a loopback MongoDB database (for example `localhost` or `127.0.0.1`), start MongoDB, and run this command from the repository root:

```sh
npm run bootstrap:admin --workspace backend
```

In PowerShell, run the same command. The script refuses production mode and non-loopback MongoDB hosts, then prompts for the administrator name, email, and a hidden password (12 or more characters). It creates the fixed **Main workspace** (`systemKey: legacy-default`) and its initial administrator. The password is passed through the existing Mongoose `User` model hashing hook; it is not echoed or stored in an environment file. Setup refuses to run when any admin/super-admin already exists and uses a unique one-time database claim to prevent concurrent or repeated bootstrap attempts. It does not promote or overwrite an existing account. Do not run this command against a production database.

If the process is interrupted and leaves an `initializing` claim, first verify locally that the recorded process is no longer running and that no admin/super-admin account exists. Then run the separate recovery command from the repository root:

```sh
npm run bootstrap:admin:recover --workspace backend
```

Recovery requires the interactive phrase `RECOVER STALE ADMIN BOOTSTRAP`, the same loopback-development-database restriction, matching host ownership, a valid claim timestamp and process ID, and proof that the recorded process is stopped. It fails without deleting the claim if any ownership or process check is uncertain, or if an administrator already exists. After successful recovery, rerun the bootstrap command above.

## Single workspace and demo mode

- The application uses one **Main workspace** (`systemKey: legacy-default`). Workspace-scoped records are isolated to it, and unassigned legacy inventory is attached there by the guarded migration. Workspace switching and workspace creation are not offered. Public registration is disabled; admins create staff accounts through **User Management**, and new staff are added to Main.
- The application does not automatically provision demo accounts or insert demo catalog records at startup. Demo workspace records and the demo account were removed from the local project database. The `demo` role remains read-only if assigned to an account; no demo credentials are published.
- The fictional CSV dataset is kept separate under `docs/sample-data/` and its `Record type` is intentionally rejected by the product importer.
- Authentication uses HTTP-only cookies, CSRF-token and trusted-origin checks, inactive/absolute session limits, and rate-limited sign-in. No demo password or administrator credentials are published.

## User management

The **Users** page is available to admins and super admins. It supports searching and filtering accounts, changing roles, and enabling or disabling sign-in globally across workspaces. Admins cannot view or manage super admin accounts; only super admins can assign the super admin role. Users cannot change their own role or disable their own account, and super admin accounts cannot be demoted or disabled through the API. Disabling an account also revokes its active sessions.

### Business role permissions

| Role | Permissions |
| --- | --- |
| `super_admin` | All application permissions, including user administration, market-price management, and privileged system operations. Existing super-admin safeguards still apply. |
| `admin` | Manage users/roles, products, categories, suppliers, stock, purchase orders and market-price records in Main; access sales, reports, dashboard, and AI features. Cannot manage or assign super-admin accounts. |
| `manager` (Inventory Manager) | Manage products, categories, suppliers, stock and purchase orders; view sales, inventory reports, and market-price information; use demand forecasts and the inventory assistant. No user/role administration. |
| `store_keeper` | Read inventory/catalog, sales, and purchase orders; create/update products and stock; record sales and purchase-order receipts. Cannot create, edit, order, or cancel purchase orders, delete products, or manage catalogs/users. |
| `employee` (Sales Staff) | Read products, categories, suppliers, stock and sales; record sales. No inventory/catalog editing, reports, AI, market-price, user, or privileged system operations. |
| `viewer` | Read-only dashboard, inventory/catalog, stock and sales access; no create/update/delete or administrative operations. |
| `demo` | Same read-only sales and inventory access as a viewer; demo writes remain blocked by the backend. |

`system:manage` is reserved for `super_admin`; no Settings page or system-management feature is currently provided.

## Stock movements

Stock receipts and adjustments are available from **Stock movements** to users with stock-management permission. Product creation with a non-zero opening balance, product stock edits, quick inventory adjustments, and sales also write to the workspace-scoped movement ledger. Ledger entries are read-only through the application API.

Stock changes, sales, and their movement records are committed in MongoDB transactions. The backend does not fall back to separate stock and ledger writes: stock-changing requests require a MongoDB replica set or sharded cluster. A standalone MongoDB deployment returns an explicit service-unavailable error until it is configured to support transactions.

Every sales creation request must include an `Idempotency-Key` header containing 8–128 permitted characters. Reusing a key that has already been processed returns HTTP 409 with code `IDEMPOTENCY_KEY_ALREADY_USED`; the API does not return the original sale. If the Sales page reports a duplicate key, refresh sales and stock information before attempting another sale.

## Dashboard, alerts, and reports

The dashboard reads current workspace inventory, Asia/Colombo business-day sales, six Sri Lankan calendar months of sales, recent sales and stock movements, and pending ordered/partially-received purchase orders. Employee sales totals and recent sales are restricted to sales recorded by that employee. Purchase-order metrics are included only for roles with purchase-order read access.

Low-stock alerts are computed from active products on each request; they are not persisted or sent externally. A low-stock product has positive stock at or below its existing `minimumStock` threshold. Zero-stock products are reported separately as out of stock. The navigation alert panel is available to stock managers, including store keepers.

The Reports page provides filtered current inventory, stock movement, sales transaction, monthly sales, and product sales reports. Date-only inputs and returned date groupings use Asia/Colombo; the selected end date includes the complete Sri Lankan calendar day. Timestamp filters require an explicit timezone offset. The sales report summary lists are bounded to 100 rows and include truncation indicators, while summary totals cover all matching sales. CSV exports use the same workspace-scoped filters, quote and escape values, protect text cells against spreadsheet formula injection, omit customer contact/private actor fields, and reject exports larger than 20,000 rows so filters can be narrowed.

## Purchase orders

Admins and inventory managers can create and manage draft purchase orders, mark them ordered, and cancel eligible orders. Store keepers can view orders and record receipts. Purchase orders are isolated by workspace, and products and suppliers are validated against the active workspace. A receipt can be partial or complete; receipt quantities cannot exceed the remaining ordered quantities, and an order cannot be cancelled after receiving starts.

Purchase-order receipts require an `Idempotency-Key` and run in the same MongoDB transaction as product stock updates, stock movement ledger entries, and the purchase-order receipt/status update. Reusing a processed receipt key returns HTTP 409; it does not replay the original receipt result. Refresh the purchase order and stock information before starting a new receipt operation. As with all stock-changing operations, receipts require MongoDB replica-set or sharded-cluster transaction support and fail safely on a standalone server.

Creating or editing a draft purchase order and deactivating a product also require MongoDB transaction support. These operations coordinate through a write on each affected product so a product cannot be deactivated concurrently with creation or editing of an outstanding purchase order. They fail safely if transactions are unavailable.

## Environment variables

- Frontend: `VITE_API_URL` (API base URL ending in `/api`)
- Backend: `PORT`, `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`, `TRUST_PROXY`, `AI_PYTHON_EXECUTABLE`
- Set `CLIENT_URL` to the exact frontend origin. Comma-separate trusted origins; do not use wildcard origins with cookie authentication.
- Set `TRUST_PROXY` to the trusted reverse-proxy hop count, or `0` when the API is directly exposed.

## Market price history and forecasting

The Market Prices page uses verified observations in the active workspace. Admins and super admins can add, edit, delete, or import records; inventory managers can view history and forecasts but cannot change records. The page compares recorded averages and source observations and shows an estimated price trend against recorded history. Run a forecast explicitly for a 7-, 30-, or 60-day horizon. Forecast horizons are measured after the latest recorded observation, and the UI shows that observation's date and age at forecast time; no fixed staleness cutoff is configured. The local Python service compares last-observation, moving-average, linear-trend, and damped-trend models using rolling chronological validation; unreliable predictions are withheld. Zero prices are handled safely by the model's validation metrics, while saved market-price records must remain greater than zero. No external market data is collected and no historical prices are generated or pre-seeded.

The AI Forecasting page charts historical weekly demand separately from forecast portions within the next 28 full Asia/Colombo calendar dates. The window starts the day after the run's Colombo business date, excluding elapsed days; each weekly model estimate is distributed evenly across its seven calendar days, and only intersecting days contribute. Three local demand models are compared against the latest six complete sales weeks, using up to 26 completed weeks of workspace sales. Forecasts are suppressed when there is too little recent sales history or validation error is excessive. Purchase recommendations use the same 28-day demand total, product minimum stock, current stock, and remaining quantities on ordered or partially received purchase orders. Actionable quantities require a heuristic forecast quality score of at least 40/100; this score is not a probability. Quantities are planning estimates, not supplier lead-time or safety-stock calculations; review the explanation and warning and confirm stock before purchasing.

The AI Assistant answers supported inventory, demand, reorder, and saved market-forecast questions from the active workspace's records. It treats stock at or below minimum stock as low stock and accounts for outstanding purchase-order quantities when describing net reorder estimates. The selling-price recommendation uses the saved product cost and up to 10 latest recorded Retail observations, ordered by observation date and creation time; it suggests their average only when that average exceeds cost, shows expected gross profit/margin without adding a target margin, and never changes the product's selling price. These are review aids, not instructions to purchase or reprice. The system uses local rules, statistics, and the local Python process only; there is no external AI provider, API key, or transfer of inventory data to a third party. It is not a general-purpose chatbot and does not replace supplier quote or purchasing review.

CSV import accepts up to 500 rows with headers `productId` (or `sku`), `price`, `source`, `priceType`, and `recordedAt`; `currency` is optional and must be `LKR`. Forecasts support 7, 30, or 60 days and require at least 8 distinct price dates over at least 14 days with holdout MAPE at or below 50%. The confidence score is an evaluation score, not a probability.

## Deployment

Build the frontend with `npm run build`. Configure the backend from `backend/.env.example` with `NODE_ENV=production`, a private MongoDB URI, a newly generated JWT secret, and the exact HTTPS frontend origin in `CLIENT_URL`. Set the deployed frontend's `VITE_API_URL` to the HTTPS API URL ending in `/api`. Run the API with `npm start --workspace backend`. Use HTTPS for both services and configure MongoDB access controls and backups with your host.

## Project completion documentation

- [Requirements traceability](docs/REQUIREMENTS_TRACEABILITY.md)
- [Test plan and results](docs/TEST_PLAN_AND_RESULTS.md)
- [Synthetic test-data guide](docs/TEST_DATA_GUIDE.md)
- [AHS Motors user guide](docs/USER_GUIDE.md)
- [Deployment guide](docs/DEPLOYMENT_GUIDE.md)
- [Manual test checklist](docs/MANUAL_TEST_CHECKLIST.md)
- [Client evaluation form](docs/CLIENT_EVALUATION_FORM.md)
- [Screenshot checklist](docs/SCREENSHOT_CHECKLIST.md)

## Synthetic test ownership

Every synthetic/integration-created workspace, user, and child record carries exact `testSuite` and `testRunId` ownership markers. Users also receive `testWorkspaceId` when linking succeeds. Cleanup requires the exact suite and run ID and deletes only records with both matching ownership markers; it does not infer ownership from an email, display name, role, or workspace membership. Unmarked records inside an owned workspace and records from other runs are preserved. An owned workspace is removed only after its marked children are cleaned and it has no remaining child records or unrelated members.

Interrupted runs can be discovered with the cleanup command's `--list` option. It reports marked workspaces, users, and orphan users, including the suite/run IDs and whether a user's workspace link still exists. Exact-run orphan users can be cleaned even if workspace creation or linkage failed, while users linked to an existing unrelated workspace are preserved. A successful empty query prints `Query succeeded: 0 matching <suite> runs found.`; connection, target-validation, and query failures are explicit errors.

Cleanup and listing perform ordinary database operations and can run on an isolated standalone database whose name ends in `_test`. Synthetic-data generation and transaction integration tests require a replica set or sharded cluster. Use `MONGODB_TEST_URI` only, review the listed exact run ID, and follow [the test data guide](docs/TEST_DATA_GUIDE.md) for copy-ready Windows PowerShell commands. These scripts do not run during normal application startup.
