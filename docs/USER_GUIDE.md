# AI-Based Parts Management System

## AHS Motors

**Yamaha Spare Parts · Sammanthurai**

Inventory management is the main purpose of this application. Product data, sales, purchasing, and reports are scoped to the signed-in user's workspace. Amounts use LKR and business-day/date reporting uses Asia/Colombo.

## Sign in and account access

Public self-registration is disabled. Ask an administrator to create your staff account and provide your initial password through a secure channel. Administrators create accounts in **User Management**; the account is added to the active workspace and receives the role selected by the administrator. Sign out from the account menu when finished. Available actions depend on your assigned role; contact an administrator if a required action is hidden or denied.

The repository does not provide verified AHS Motors account or inventory data. There is no default demo credential, and application startup does not insert the demo CSV records.

## Add categories, suppliers, and parts

1. Create a category for each useful parts grouping (for example, engine, brakes, or electrical).
2. Add the supplier using the business details verified by AHS Motors.
3. Open **Parts Management → Add Part** and enter the part name, SKU, category, supplier, purchase and selling prices in LKR, stock/reorder quantities, and rack/shelf location.
4. Enter a genuine/OEM number only when verified from an authorized supplier or manufacturer source. SKU and OEM number are separate fields.
5. Enter compatible Yamaha model information only after it has been verified. Do not assume compatibility from a sample or an unverified listing.
6. Save the part. If opening stock is entered, the system records it through the stock movement ledger; do not use product edit as a substitute for a later stock transaction.

Search supports the part name, SKU, optional OEM number, barcode, manufacturer, and compatible-model text. Category and supplier filters can narrow the list.

## Import actual inventory CSV

On **Parts Management**, select **Import CSV** and download the template. The import format is Excel-compatible CSV and includes part name, SKU, optional OEM number/barcode, category and supplier names, manufacturer, verified compatible models, purchase/selling price (LKR), stock thresholds, current stock, rack/shelf location, description, status, and `Record type`.

- Before import, create the referenced categories and suppliers in the current workspace.
- Every row must be marked `ACTUAL`; demo, test, and unclassified data is rejected.
- Preview checks required values, category/supplier references, prices, stock values, and duplicate SKU/OEM/barcode values against both existing products and other CSV rows.
- Review the row-level errors before continuing. Import is create-only: existing products are never overwritten.
- Confirm the preview before import. Successful and failed/not-imported counts are shown. A server-side duplicate or permission error is reported per row.
- A non-zero opening quantity uses the normal transactional stock/ledger service. Transaction-dependent operations require a MongoDB replica set or sharded cluster.

The separate [DEMO DATA sample file](sample-data/DEMO_PARTS_DATASET.csv) is fictional and labeled on every row. It includes no genuine Yamaha OEM numbers; compatibility and values are expressly unverified. It is not automatically loaded and cannot pass the actual-data import gate. Replace all sample content with verified shop records before business use.

Use **Export catalog** to download the workspace catalog; exports are limited to 20,000 records. The export includes actual/test classification and the fields needed by the product template.

## Receive stock and review inventory history

Open **Stock movements**, select stock-in, choose a product, enter the received quantity, and provide the available reference/reason. Submit and confirm the ledger entry. For a purchase-order delivery, record the receipt on the order so received quantities and stock stay linked.

Stock changes are recorded for receiving, sales, adjustments, opening stock, and purchase-order receipts. Use the movement history and **Reports → Stock movements** to review transaction type, quantity, before/after balance, date, and reference. Do not edit the database or use an unrelated stock shortcut to correct balances.

## Purchase orders

Users with the required permission can create a draft, add parts and quantities, verify supplier and costs, and mark it ordered. Authorized receiving staff can record partial or final deliveries. The system prevents over-receiving and updates the stock ledger with the receipt. Review outstanding quantities before ordering again; AI recommendations do not create or alter purchase orders.

## Record sales

Open **Sales**, select an available part, enter quantity and the supported customer/payment details, then submit once. Successful sales reduce on-hand stock and create a stock-out ledger entry in the same transaction. If a submission reports a duplicate idempotency key, refresh sales and stock before trying again; do not blindly resubmit.

## Dashboard and reports

The Dashboard displays workspace-derived product/category/supplier counts, stock quantity, inventory value at recorded purchase cost, low/out-of-stock totals, today's and current-month sales, recent sales and stock movements, and pending purchase orders when permitted. When authorized, it also shows AI purchase recommendations. Empty workspaces show zero values and informative empty states; numbers are not hardcoded.

The Reports page provides filtered inventory, stock movement, sales transaction, monthly sales, and product sales reports. Choose date, product, category, and supplier filters as available. CSV exports use Asia/Colombo date semantics, are workspace-scoped, protect spreadsheet formulas, and reject results above 20,000 rows.

## AI features

- **Demand Forecasting** uses available workspace sales history and shows forecast/quality limits.
- **Purchase Recommendations** estimate demand and net stock needs; review on-hand and on-order quantities before acting.
- **Market Price Analysis** and **Price Trend Prediction** use stored observations. Stored market prices are not live external market data.
- **Selling Price Recommendations** are review aids and do not change the saved selling price.
- **AI Inventory Assistant** answers supported questions using the active workspace's inventory, sales, and saved forecasts.

AI estimates are not guarantees. They never automatically change stock, create purchase orders, or update prices. Historical data, demo examples, and generated predictions should be treated as distinct; the sample CSV is not live business history.
