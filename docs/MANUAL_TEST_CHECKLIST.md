# Manual End-to-End Test Checklist

Actual results remain `Not Run` until a real browser session and isolated database are used.

| ID | Preconditions | Steps | Expected result | Status |
|---|---|---|---|---|
| AUTH-01 | Fresh isolated database | Run the local admin bootstrap, then log in and log out | Admin/workspace created once; login/logout works | Not Run |
| AUTH-02 | Existing users | Exercise each role | Role UI/API restrictions match matrix | Not Run |
| AUTH-03 | Authenticated session | Submit an API request without CSRF/session or from an unauthorized origin | 401/403/403 policy is enforced | Not Run |
| INV-01 | Admin/Manager | Create category, supplier, and spare-part product | Records exist only in active workspace | Not Run |
| INV-02 | Product exists | Search by SKU, name, barcode, manufacturer, and model | Relevant matches work; no OEM data invented | Not Run |
| INV-03 | Camera unavailable | Open scanner and use manual barcode/part search | Manual fallback works; duplicate submission prevented | Not Run |
| INV-04 | Authorized stock role | Receive stock | Stock and immutable ledger movement update together | Not Run |
| INV-05 | Authorized staff role | Record sale and repeat same idempotency key | First sale succeeds; replay is rejected | Not Run |
| INV-06 | Insufficient stock | Attempt sale larger than stock | Sale rejected; stock unchanged | Not Run |
| INV-07 | Authorized role | Perform permitted adjustment | Ledger reflects before/after stock | Not Run |
| PO-01 | Draft order | Create multi-product draft, edit, and mark ordered | Valid transitions only | Not Run |
| PO-02 | Ordered PO | Record two partial receipts, then complete | Status and stock update consistently | Not Run |
| PO-03 | Partially received PO | Attempt over-receipt or duplicate key | Rejected safely | Not Run |
| DASH-01 | Synthetic data | Verify dashboard and low-stock counts | Counts match isolated workspace and stock/minimum rules | Not Run |
| RPT-01 | Synthetic data | Apply combined report filters and export CSV | CSV matches workspace/filter and formula protection | Not Run |
| AI-01 | Sufficient history | Generate 28-day demand forecast | Period exactly 28 future Colombo calendar days | Not Run |
| AI-02 | Market observations | Generate 7/30/60-day forecast | Horizon measured after latest observation; age shown | Not Run |
| AI-03 | Confidence/data cases | Review low-confidence and insufficient-data purchase advice | No quantity below confidence 40; reasons shown | Not Run |
| AI-04 | Recommendations | Confirm saving recommendations does not change selling prices | Product selling prices unchanged | Not Run |
| SEC-01 | Different workspaces | Attempt cross-workspace product/report/AI access | 404/403 and no cross-workspace data | Not Run |
| SEC-02 | Employee account | Attempt user/privileged operations | 403 for unauthorized writes | Not Run |
| SEC-03 | Viewer account | Attempt all write actions | Read-only behavior enforced; no writes | Not Run |
