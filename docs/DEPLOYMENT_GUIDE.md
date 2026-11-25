# Deployment Guide

## Required software

- Node.js 20.19+ or 22.12+
- npm
- MongoDB 5.0+ with a replica set or sharded cluster for transaction support
- Python 3.9+ for market-price forecast subprocesses
- HTTPS-capable frontend/backend hosting

## Install

```sh
npm install
npm run build
npm run lint
npm test
npm run test:python
```

## Environment variables

Backend names:

- `PORT`
- `NODE_ENV`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CLIENT_URL`
- `TRUST_PROXY`
- `AI_PYTHON_EXECUTABLE`

Frontend:

- `VITE_API_URL`

Use private secret values and exact HTTPS origins. Do not commit populated `.env` files.

## MongoDB

Stock-changing operations require a transaction-capable topology. A standalone server will reject these operations safely. Configure replica-set authentication, access controls, TLS if supported by the host, and backups before deployment.

Synthetic and integration test cleanup is ordinary deletion and may run against an isolated standalone `_test` database. Synthetic-data generation and integration tests execute transactions or stock-changing operations and require a replica set or sharded cluster.

All opt-in test-data commands read only `MONGODB_TEST_URI`; they require a database name ending in `_test`. Synthetic and integration-created workspaces, users, and child records carry exact `testSuite` and `testRunId` ownership markers. Cleanup requires the exact suite and run ID, removes only matching marked records, and deletes an owned workspace only after its marked children are removed and no remaining child records or unrelated workspace members exist. Email addresses, display names, and workspace membership are not ownership evidence. Exact-run orphan users are listed and can be recovered even when their workspace was never linked or no longer exists; a run-owned user linked to an existing unrelated workspace is preserved.

Use the test-data commands only against a dedicated isolated test database. To list interrupted synthetic or integration runs, use `--list`; successful empty results print an explicit zero-result message, while target, connection, and query failures are reported separately. Review the exact suite and run ID before cleanup. See [the synthetic test-data guide](TEST_DATA_GUIDE.md) for copy-ready Windows PowerShell commands and the safe generation/list/cleanup order.

## Initial administrator

Run only on an isolated local/fresh database, using the loopback-development bootstrap restriction:

```sh
npm run bootstrap:admin --workspace backend
```

Never run bootstrap against a production or shared database. Recovery is a separate audited command documented in the README.

## Start and build

```sh
npm run dev:backend
npm run dev:frontend
npm run build
npm start --workspace backend
```

## Security and operations

- Terminate HTTPS at a trusted reverse proxy.
- Set `TRUST_PROXY` to the actual trusted hop count.
- Rotate `JWT_SECRET` and sessions during a suspected compromise.
- Restrict MongoDB network access and use least-privilege credentials.
- Back up MongoDB regularly and test restoration.
- Monitor logs for authentication, CSRF, and transaction errors.
- Do not expose `MONGODB_URI`, `JWT_SECRET`, or private `.env` contents.

## Troubleshooting

- **Standalone MongoDB transaction error:** configure replica set/sharded cluster; do not bypass transaction checks.
- **Origin rejected:** set `CLIENT_URL` or CORS frontend origin exactly.
- **JWT configuration error:** generate a private secret of at least 32 characters.
- **Python forecast unavailable:** verify `AI_PYTHON_EXECUTABLE` and Python dependencies.
- **Admin bootstrap refused:** verify loopback MongoDB, development mode, and absence of an existing admin.
