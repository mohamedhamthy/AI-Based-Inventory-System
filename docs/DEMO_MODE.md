# Public read-only demo

Demo mode reads the existing records from one workspace in the configured MongoDB database. It does not create a demo workspace, products, prices, sales, or sample records. Enabling public access to your main database exposes the selected workspace's real inventory, sales, customer, supplier, and report data to anyone using the demo button. Only enable it if those records are appropriate for public viewing; read-only access does not make confidential data safe to publish.

## Configure the deployment

In development, demo mode is enabled by default. In production, explicitly set `DEMO_MODE=true` on the backend deployment connected to your existing database. Set `DEMO_WORKSPACE_ID` to select a particular existing workspace; if omitted, the application selects the oldest existing workspace.

```env
DEMO_MODE=true
MONGODB_URI=mongodb://<database-user>:<password>@<database-host>/<your-existing-database>
# Optional overrides:
DEMO_ACCOUNT_EMAIL=public-demo@demo.invalid
DEMO_WORKSPACE_ID=<existing-workspace-object-id>
```

At startup the application creates only the `demo_viewer` login account if the configured email is unused, then adds that account as a member of the selected existing workspace. These are the only persistent setup changes; it does not create or populate a workspace or change any inventory, pricing, sales, or report record. It refuses to reuse an email belonging to a non-demo account or an inactive account. The password is random and not needed by visitors.

Demo mode also disables automatic index creation and database migrations at startup. The demo account is restricted to the configured workspace even if it is later added to another workspace.

The login screen provides an **Enter Demo Mode (Read Only)** button. Clicking it calls the rate-limited `/api/auth/demo-login` endpoint, which creates a session for the restricted demo account without exposing or asking for credentials.

## Read-only behavior

`demo_viewer` can read dashboard, inventory, sales, purchasing, reports, AI, and market-price data in the selected workspace, but has no create, update, delete, account-management, or settings permissions. API middleware rejects all unsafe methods except the specific market-price prediction endpoint. That endpoint runs the prediction in memory and does not save a forecast; demo logins also do not update the account's last-login field or session activity timestamp. Normal session creation and logout still operate so visitors can authenticate and end their sessions.

The authenticated application displays **DEMO MODE – READ ONLY**. Its views reflect the current contents of the selected existing workspace.
