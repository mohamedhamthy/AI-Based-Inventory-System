import AppError from "../utils/AppError.js";
import { env } from "../config/env.js";
import { isDemoUser } from "./authMiddleware.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const predictionHorizons = new Set([7, 30, 60]);
const priceTypes = new Set(["Retail", "Wholesale", "Online", "Other"]);

export const preventDemoWrites = (req, res, next) => {
  const requestPath = `${req.baseUrl || ""}${req.path}`;
  const isReadOnlyPrediction =
    req.method === "POST" &&
    /^\/api\/market-prices\/[a-f\d]{24}\/forecast$/i.test(requestPath) &&
    req.body &&
    typeof req.body === "object" &&
    !Array.isArray(req.body) &&
    Object.keys(req.body).every((key) => ["days", "priceType"].includes(key)) &&
    Object.keys(req.body).length === 2 &&
    predictionHorizons.has(Number(req.body.days)) &&
    priceTypes.has(req.body.priceType);
  if (
    isDemoUser(req.user) &&
    !safeMethods.has(req.method) &&
    !isReadOnlyPrediction
  ) {
    return next(new AppError("Demo accounts have read-only access", 403));
  }
  next();
};

export const requireTrustedOrigin = (req, res, next) => {
  const origin = req.get("origin");
  if (!origin || !env.allowedOrigins.includes(origin)) {
    return next(new AppError("Request origin is not allowed", 403));
  }
  next();
};

export const verifyCsrfToken = (req, res, next) => {
  if (safeMethods.has(req.method)) return next();

  const origin = req.get("origin");
  if (!origin || !env.allowedOrigins.includes(origin)) {
    return next(new AppError("Request origin is not allowed", 403));
  }

  if (
    req.cookies?.inventory_session &&
    req.get("x-csrf-token") !== req.authSession?.csrfToken
  ) {
    return next(new AppError("Invalid or missing CSRF token", 403));
  }

  next();
};
