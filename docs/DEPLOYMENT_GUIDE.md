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

## Recommended hosting: Vercel, Render, and MongoDB Atlas

The repository includes a Vercel configuration for the static frontend and a Render Blueprint plus Dockerfile for the Express API. The API container includes Python for market-price forecasts.

1. Push the repository to GitHub.
2. Create or select a MongoDB Atlas cluster. Create a database user restricted to this application database and ensure backups are enabled. If your current main database is local, it is not reachable from Render; migrate/restore that database into Atlas before deploying. Atlas must allow connections from Render. Prefer fixed outbound IP restrictions where available; if using `0.0.0.0/0`, use a strong database-only password and least-privilege database user. The current local database name is `ai_inventory_system`, so include that name in the Atlas URI path (for example, `mongodb+srv://<user>:<password>@<cluster-host>/ai_inventory_system`). A URI ending in `/` without a database name may connect to MongoDB's default `test` database instead.
3. In Render, create a Blueprint from the repository using `render.yaml`. Set `MONGODB_URI` to the intended Atlas database and `CLIENT_URL` to the exact Vercel production origin (for example `https://your-project.vercel.app`). Optionally set `DEMO_WORKSPACE_ID` to select a particular existing workspace; otherwise the oldest workspace is selected. The Blueprint uses Render's free plan, which may sleep when idle.
4. In Vercel, import the same repository with the repository root as the project root. The checked-in `vercel.json` builds the frontend workspace and serves `frontend/dist`. Set `VITE_API_URL` to the Render API URL ending in `/api` (for example `https://ai-inventory-api.onrender.com/api`), then deploy.
5. Update Render's `CLIENT_URL` with the final Vercel origin and redeploy the API. Add any Vercel preview origin explicitly if preview deployments need API access; origins must match exactly.
6. Wait for Render's `/health` check to pass, then test sign-in, read-only demo login, prediction, and a rejected write request over HTTPS on phone and desktop widths.

The Render Blueprint enables the public read-only demo. Anyone can enter the selected existing workspace, so review its customer, sales, supplier, and inventory data before deploying. Demo mode adds only the demo login account and its workspace membership; it does not generate sample business records. Do not put database credentials, JWT secrets, or populated environment files in Git.

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
