import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import AppError from "../utils/AppError.js";

const pythonScript = fileURLToPath(
  new URL("../ai/market_price_forecast.py", import.meta.url),
);

export const runPriceForecast = (records, horizon) =>
  new Promise((resolve, reject) => {
    const command =
      process.env.AI_PYTHON_EXECUTABLE ||
      (process.platform === "win32" ? "python" : "python3");
    const child = spawn(command, [pythonScript], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill();
      settled = true;
      reject(new AppError("Price prediction timed out", 503));
    }, 15000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdin.on("error", (error) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      reject(
        new AppError(
          `Could not send market data to Python prediction: ${error.message}`,
          503,
        ),
      );
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      reject(
        new AppError(
          `Could not start Python price prediction: ${error.message}`,
          503,
        ),
      );
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      if (code !== 0) {
        reject(
          new AppError(
            `Python price prediction failed: ${stderr.trim() || `exit code ${code}`}`,
            503,
          ),
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(
          new AppError(
            `Python price prediction returned invalid output: ${error.message}`,
            503,
          ),
        );
      }
    });

    child.stdin.end(JSON.stringify({ records, horizon }));
  });

export const buildPriceForecastSummary = ({
  product,
  currentPrice,
  result,
  priceType,
  forecastPeriod,
  generatedBy,
  workspaceId,
  generatedAt = new Date(),
}) => {
  const forecastPoints = result.forecastPoints || [];
  const predictedPrice =
    result.status === "reliable"
      ? (forecastPoints[forecastPeriod - 1]?.predictedPrice ?? null)
      : null;
  const changeAmount =
    predictedPrice !== null && currentPrice !== null
      ? Number((predictedPrice - currentPrice).toFixed(2))
      : null;
  const percentageChange =
    changeAmount !== null && currentPrice > 0
      ? Number(((changeAmount / currentPrice) * 100).toFixed(2))
      : null;
  let trend = "Stable";
  let recommendation = "Monitor Price";
  if (percentageChange !== null && percentageChange > 2) trend = "Increasing";
  if (percentageChange !== null && percentageChange < -2) trend = "Decreasing";
  const stockNeedsReorder = product.currentStock <= product.minimumStock;
  const supplierQuoteSupportsPurchase =
    product.costPrice > 0 &&
    predictedPrice !== null &&
    product.costPrice <= predictedPrice;
  if (
    result.status === "reliable" &&
    result.metrics.confidence >= 60 &&
    percentageChange >= 5 &&
    stockNeedsReorder &&
    supplierQuoteSupportsPurchase
  ) {
    recommendation = "Buy Now";
  }
  if (
    result.status === "reliable" &&
    result.metrics.confidence >= 60 &&
    percentageChange <= -5 &&
    !stockNeedsReorder
  ) {
    recommendation = "Wait";
  }

  return {
    workspaceId,
    product: product._id,
    productName: product.productName,
    priceType,
    forecastPeriod,
    status: result.status,
    predictedPrice,
    trend,
    changeAmount,
    percentageChange,
    recommendation,
    metrics: result.metrics,
    dataQualityWarnings: result.dataQualityWarnings || [],
    forecastPoints,
    generatedAt,
    generatedBy,
  };
};
