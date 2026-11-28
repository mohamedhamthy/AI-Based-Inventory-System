import assert from "node:assert/strict";
import { test } from "node:test";

process.env.PORT ||= "5000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ai_inventory_test_demo";
process.env.JWT_SECRET ||=
  "test-only-secret-that-is-long-enough-for-validation";
process.env.JWT_EXPIRES_IN ||= "1d";
process.env.CLIENT_URL ||= "http://localhost:5173";
process.env.DEMO_MODE ||= "false";

const [{ preventDemoWrites }, { hasPermission }] = await Promise.all([
  import("../src/middleware/demoAccessMiddleware.js"),
  import("../src/constants/permissions.js"),
]);

const callMiddleware = (request) => {
  let error;
  let continued = false;
  preventDemoWrites(request, {}, (nextError) => {
    error = nextError;
    continued = !nextError;
  });
  return { error, continued };
};

test("demo viewer can read showcase features but cannot manage system data", () => {
  const role = "demo_viewer";
  for (const permission of [
    "dashboard:read",
    "products:read",
    "reports:read",
    "forecast:read",
    "ai:use",
    "marketPrices:read",
  ]) {
    assert.equal(hasPermission(role, permission), true);
  }
  for (const permission of [
    "products:create",
    "products:update",
    "products:delete",
    "stock:manage",
    "marketPrices:manage",
    "users:manage",
    "system:manage",
  ]) {
    assert.equal(hasPermission(role, permission), false);
  }
});

test("demo write guard allows only a validated market-price prediction request", () => {
  const demoUser = { role: "demo_viewer" };
  const allowed = callMiddleware({
    user: demoUser,
    method: "POST",
    baseUrl: "/api/market-prices",
    path: "/507f1f77bcf86cd799439011/forecast",
    body: { days: 30, priceType: "Retail" },
  });
  assert.equal(allowed.continued, true);
  assert.equal(allowed.error, undefined);

  for (const request of [
    {
      method: "POST",
      baseUrl: "/api/market-prices",
      path: "/507f1f77bcf86cd799439011/forecast",
      body: { days: 30, priceType: "Retail", persist: true },
    },
    {
      method: "POST",
      baseUrl: "/api/market-prices",
      path: "/507f1f77bcf86cd799439011/forecast",
      body: { days: 14, priceType: "Retail" },
    },
    {
      method: "POST",
      path: "/api/products",
      body: {},
    },
  ]) {
    const result = callMiddleware({ ...request, user: demoUser });
    assert.equal(result.continued, false);
    assert.equal(result.error.statusCode, 403);
  }
});
