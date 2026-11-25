# Synthetic Sri Lankan Motorcycle-Parts Dataset

The sample generator creates **synthetic data simulating realistic shop operations** for development and project demonstration. None of the generated customers, suppliers, prices, sales, purchase orders, stock balances, or fitment descriptions are genuine or verified AHS Motors records. Phone numbers use reserved-looking `077 000 xxxx` placeholders and must not be used to contact anyone. Yamaha model compatibility is illustrative and must be checked against authoritative fitment information before any real-world use. No genuine OEM part numbers are asserted.

## Planned dataset

The reviewed plan is anchored to **2026-11-18** and spans 2025-11-19 through 2026-11-18:

| Record type | Additions | Main workspace total after generation |
| --- | ---: | ---: |
| Categories | 3 | 8 |
| Suppliers | 2 | 7 |
| Customers (15 workshops, 5 individuals) | 20 | 20 |
| Products | 140 | 150 |
| Purchase orders | 12 | 12 |
| Sales invoices | 163 | 163 |
| Sale lines | 1,464 | 1,464 |
| Stock movements | 1,600 | 1,600 |
| Weekly retail-price observations | 7,420 (53 per new product) | 7,420 |
| Market-price forecast records | 420 (140 products × 3 horizons) | 420 |

The generator preserves the ten existing Main-workspace products, five categories, and five suppliers. It adds 140 catalog products with LKR cost/selling prices, barcodes, stock thresholds, units, shelf locations, and synthetic model-fitment descriptions. Every generated product has cost below selling price, with a gross margin between 15% and 40%. The 100 added catalog parts cover five Yamaha model families and 20 component types; they are inventory-only examples and are not represented as historical sales.

When the original 40-product sample dataset is already present, the guarded preflight recognizes that exact dataset and plans only the 100 added products, their opening-stock movements, and their retail-price observations. Existing records are not modified or recreated.

The preserved legacy products predate stock-movement tracking. `npm run record:legacy-openings -- --database ai_inventory_system --workspace-id <id> --member-id <id>` offers a separate dry-run to record their existing stock as opening balances without changing product quantities. This is a ledger baseline, not a claim that a real purchase or sale occurred; apply requires a separate plan-token confirmation.

Browser workflow validation also added one explicitly labeled UI-test purchase order (fully received) and one explicitly labeled UI-test sale after the planned dataset was generated. They are additional test-only records, not genuine supplier or customer transactions, and are not included in the planned counts above.

The order plan includes draft, ordered, partially received, received, and cancelled statuses. Every sale line has a matching stock-out movement; each received purchase-order line has a matching stock-in movement. Product opening balances are recorded as opening movements. The pure plan validator checks that stock never becomes negative and that opening stock plus receipts minus sales equals each planned closing balance. Four products finish below their minimum-stock threshold to exercise low-stock alerts.

Sales are weighted toward eight fast-moving products (approximately 80% of planned units), with weekend and month-end effects, April and December uplifts, and deterministic variation. Synthetic sales use 0% tax and no discounts, matching the selected demonstration policy. Market-price forecasts are not embedded in the operational-data plan: after the synthetic market observations are applied, `npm run sample-price-forecasts -- --database ai_inventory_system --workspace-id <id> --member-id <id>` runs the backend's Python price-forecast pipeline for 7-, 30-, and 60-day horizons. Its first run is a read-only preflight; applying the displayed plan token stores the model output transactionally. Demand forecasts use the backend demand model and the recorded sales history.

All generated operational documents carry `dataOrigin: "sample"`, the dataset ID, and a stable record key so the preflight can report exact additions and reruns can safely become no-ops. The generator is dry-run by default; applying data requires the reviewed plan confirmation token and runs in a MongoDB transaction. See the generator header and `npm run sample-data --workspace backend -- --help` for the guarded workflow.
