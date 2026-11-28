import dotenv from "dotenv";
import { randomBytes } from "node:crypto";

dotenv.config();

const requiredEnvVars = [
  "PORT",
  "MONGODB_URI",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "CLIENT_URL",
];

const trustProxySetting = process.env.TRUST_PROXY || "0";

const trustProxy =
  trustProxySetting === "true"
    ? true
    : trustProxySetting === "false"
      ? false
      : Number(trustProxySetting);

const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`,
  );
}

if (
  typeof trustProxy !== "boolean" &&
  (!Number.isInteger(trustProxy) || trustProxy < 0)
) {
  throw new Error(
    "TRUST_PROXY must be true, false, or a non-negative proxy hop count",
  );
}

if (
  process.env.JWT_SECRET.length < 32 ||
  process.env.JWT_SECRET.includes("replace-with")
) {
  throw new Error(
    "JWT_SECRET must be a private random value with at least 32 characters",
  );
}

// CORS allowed origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL)
  .split(",")
  .map((url) => url.trim().replace(/\/$/, ""))
  .filter(Boolean);

// Demo configuration
const demoModeSetting =
  process.env.DEMO_MODE ||
  (process.env.NODE_ENV === "production" ? "false" : "true");

if (!["true", "false"].includes(demoModeSetting)) {
  throw new Error("DEMO_MODE must be true or false");
}

const demoMode = demoModeSetting === "true";

const demoAccountEmail =
  process.env.DEMO_ACCOUNT_EMAIL?.trim().toLowerCase() ||
  "public-demo@demo.invalid";

const demoAccountPassword =
  process.env.DEMO_ACCOUNT_PASSWORD || randomBytes(32).toString("hex");

const demoWorkspaceId = process.env.DEMO_WORKSPACE_ID?.trim() || "";

if (demoMode) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(demoAccountEmail)) {
    throw new Error(
      "DEMO_ACCOUNT_EMAIL must be a valid email address when DEMO_MODE is enabled",
    );
  }

  if (demoAccountPassword.length < 12 || demoAccountPassword.length > 128) {
    throw new Error(
      "DEMO_ACCOUNT_PASSWORD must be between 12 and 128 characters",
    );
  }

  if (demoWorkspaceId && !/^[a-f\d]{24}$/i.test(demoWorkspaceId)) {
    throw new Error("DEMO_WORKSPACE_ID must be a valid workspace ObjectId");
  }
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",

  mongoUri: process.env.MONGODB_URI,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",

  allowedOrigins,

  trustProxy,

  demoMode,
  demoAccountEmail,
  demoAccountPassword,
  demoWorkspaceId,
};
