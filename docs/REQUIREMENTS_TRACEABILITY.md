# Requirements Traceability

This table distinguishes implemented behavior from evidence collected during automated or manual review.

| Requirement or feature | Implementation location | Verification method | Result | Limitation |
|---|---|---|---|---|
| Authentication, sessions, CSRF, logout | `backend/src/routes/authRoutes.js`, `backend/src/middleware/authMiddleware.js`, `frontend/src/contexts/AuthContext.jsx` | Backend auth middleware/controller tests; code review | Implemented; automated coverage exists | Browser/session validation remains manual |
| Secure first-admin bootstrap | `backend/src/scripts/bootstrapAdmin.js`, `backend/src/services/bootstrapAdmin.js`, `backend/src/config/bootstrapSafety.js` | Bootstrap unit tests and local-code review | Implemented; not executed | Live isolated fresh-database bootstrap not run |
| Role and permission matrix | `backend/src/constants/permissions.js`, `frontend/src/utils/permissions.js` | Permission and middleware tests | Implemented | Browser role flows require manual verification |
| Workspace isolation | Workspace middleware/models/controllers | Middleware unit tests; code review | Implemented | Cross-workspace live integration not run |
| Product/SKU/Yamaha fields | `backend/src/models/Product.js`, product controllers/services/forms | Product unit and schema tests | Implemented | Compatibility is stored user data only; no OEM knowledge |
| Part-number search | `backend/src/controllers/productController.js`, `backend/src/services/productService.js` | Product controller/unit tests | Implemented | No real database search integration run |
| Barcode normalization and uniqueness | `backend/src/utils/productBarcode.js`, `backend/src/models/Product.js` | Schema/controller/service tests; opt-in Mongo suite | Implemented; real uniqueness pending isolated replica set | No live MongoDB integration run |
| Category/supplier management | Category/supplier controllers/pages | Backend tests and frontend build; code review | Implemented | Load/retry UI no browser test suite |
| Stock ledger and transactions | `backend/src/services/inventoryService.js`, stock movement model | Service unit tests; opt-in Mongo suite | Implemented | Real transaction rollback integration pending |
| Sales and idempotency | `backend/src/services/salesService.js`, Sale model/routes | Service/schema tests; opt-in suite design | Implemented | Live duplicate-sale integration pending |
| Purchase Orders and receipts | `backend/src/services/purchaseOrderService.js`, PO model | Unit tests; opt-in suite design | Implemented | Live receipt transaction pending |
| Dashboard and low stock | Dashboard service/controller | Dashboard unit tests | Implemented | Live browser verification pending |
| Inventory/sales reports and CSV | Report service/controller | Report unit tests | Implemented | Export browser verification pending |
| Demand 28-day forecast | `backend/src/services/demandService.js`, `demandForecast.js` | Deterministic JS/Python tests | Implemented | Statistical confidence limitations documented |
| Market-price analysis/prediction | `backend/src/services/marketPriceAnalysis.js`, `backend/src/ai/market_price_forecast.py` | Analysis and Python tests | Implemented | No live external market data |
| Purchase/selling recommendations | `backend/src/services/aiRecommendations.js` | AI recommendation unit tests | Implemented | Heuristic only; no lead-time/safety-stock model |
| Inventory Assistant | `backend/src/services/assistantResponse.js`, AI Assistant page | Service tests/code review | Implemented | Rule-based, not an external LLM |
| Navigation and responsive UI | Frontend routes/layout/pages | Frontend lint/build | Implemented | Manual responsive/browser review pending |
| Accessible labels/error states | Frontend forms/pages/common components | Lint/build; code review | Improved | Automated accessibility tests not configured |
