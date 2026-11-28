import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiCpu,
  FiPackage,
  FiTarget,
} from "react-icons/fi";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "react-toastify";
import EmptyState from "../components/common/EmptyState";
import PageHeader from "../components/common/PageHeader";
import { getDemandInsights } from "../services/aiService";
import { formatBusinessDate } from "../utils/formatters";

const formatUnits = (value) =>
  value === null || value === undefined
    ? "—"
    : `${Number(value).toLocaleString()} units`;
const emptyItems = [];

const ForecastPage = () => {
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");

  useEffect(() => {
    let active = true;
    getDemandInsights()
      .then((data) => {
        if (active) {
          setAnalysis(data);
          const defaultProductId =
            data.items.find(
              (item) =>
                item.forecast?.next28DayDemand !== null &&
                item.forecast?.next28DayDemand !== undefined,
            )?.id ||
            data.items[0]?.id ||
            "";
          setSelectedProductId((current) =>
            data.items.some((item) => item.id === current)
              ? current
              : defaultProductId,
          );
        }
      })
      .catch((error) => {
        if (active) {
          setLoadError(
            error.message || "Unable to load sales-based demand insights",
          );
          toast.error(
            error.message || "Unable to load sales-based demand insights",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const items = analysis?.items || emptyItems;
  const insights = useMemo(() => {
    const reorderItems = items.filter(
      (item) =>
        item.currentStock <= item.minimumStock ||
        item.recommendedPurchaseQty > 0,
    );
    const forecastItems = items
      .filter((item) => item.forecast.next28DayDemand !== null)
      .sort(
        (left, right) =>
          right.forecast.next28DayDemand - left.forecast.next28DayDemand,
      );
    const recommendedUnits = items.reduce(
      (sum, item) => sum + (item.recommendedPurchaseQty || 0),
      0,
    );
    return { reorderItems, forecastItems, recommendedUnits };
  }, [items]);
  const selectedForecast =
    items.find((item) => item.id === selectedProductId) ||
    insights.forecastItems[0] ||
    null;
  const demandChartData = [
    ...(selectedForecast?.forecast?.weeklyHistory || [])
      .slice(-12)
      .map((week) => ({
        weekLabel: formatBusinessDate(week.weekStart),
        actualDemand: week.quantity,
        predictedDemand: null,
      })),
    ...(selectedForecast?.forecast?.weeklyForecastPeriods || []).map(
      (week) => ({
        weekLabel: `${formatBusinessDate(week.startDate)}–${formatBusinessDate(week.endDate)}`,
        actualDemand: null,
        predictedDemand: week.periodDemand,
      }),
    ),
  ];

  const summary = analysis?.summary || {};
  const cards = [
    {
      title: "Products analyzed",
      value: isLoading ? "…" : summary.totalProducts || 0,
      detail: `${analysis?.historyWeeks || 26} completed weeks of workspace sales`,
      icon: FiCpu,
      tone: "cyan",
    },
    {
      title: "At or below minimum",
      value: isLoading ? "…" : summary.lowStockProducts || 0,
      detail: "Current stock at or below reorder threshold",
      icon: FiAlertTriangle,
      tone: "amber",
    },
    {
      title: "Validated forecasts",
      value: isLoading
        ? "…"
        : `${summary.forecastableProducts || 0} / ${summary.totalProducts || 0}`,
      detail: "Requires recent sales and acceptable backtest error",
      icon: FiBarChart2,
      tone: "violet",
    },
    {
      title: "Suggested reorder",
      value: isLoading ? "…" : formatUnits(insights.recommendedUnits),
      detail: "Net estimate after on-hand stock and open purchase orders",
      icon: FiPackage,
      tone: "emerald",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Demand Forecasting"
        description="Sales-based 28-day demand estimates, validated against recent sales and combined with current stock."
      />

      {loadError ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-4 text-sm text-rose-200"
        >
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, value, detail, icon: Icon, tone }) => {
          const toneClasses = {
            cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
            emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
            amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
            violet: "border-violet-500/20 bg-violet-500/10 text-violet-300",
          }[tone];
          return (
            <div
              key={title}
              className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4"
            >
              <div
                className={`inline-flex rounded-2xl border p-2 ${toneClasses}`}
              >
                <Icon size={18} />
              </div>
              <p className="mt-4 text-2xl font-semibold text-white">{value}</p>
              <p className="mt-1 text-sm font-medium text-white">{title}</p>
              <p className="mt-1 text-sm text-slate-400">{detail}</p>
            </div>
          );
        })}
      </div>

      <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Historical weekly demand and forecast
            </h2>
            <p className="text-sm text-slate-400">
              Completed weekly sales and only the future-day portions of
              intersecting forecast weeks are shown separately.
            </p>
            {analysis?.forecastPeriod ? (
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Forward window:{" "}
                {formatBusinessDate(analysis.forecastPeriod.startDate)}–
                {formatBusinessDate(analysis.forecastPeriod.endDate)} · 28 full
                calendar dates in Asia/Colombo. Today is excluded.{" "}
                {analysis.forecastPeriod.distributionAssumption}
              </p>
            ) : null}
          </div>
          <select
            aria-label="Select product for demand chart"
            value={selectedForecast?.id || ""}
            onChange={(event) => setSelectedProductId(event.target.value)}
            disabled={isLoading || !items.length}
            className="min-w-52 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {!items.length ? (
              <option value="">No active products</option>
            ) : null}
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.productName} · Part number: {item.sku || "not recorded"}
                {item.oemPartNumber ? ` · OEM: ${item.oemPartNumber}` : ""}
              </option>
            ))}
          </select>
        </div>
        {isLoading ? (
          <div
            role="status"
            className="grid h-64 place-items-center text-sm text-slate-400"
          >
            Loading weekly sales history…
          </div>
        ) : selectedForecast?.forecast?.activeWeeks ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={demandChartData}>
                <CartesianGrid
                  stroke="rgba(148,163,184,0.15)"
                  vertical={false}
                />
                <XAxis
                  dataKey="weekLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <Tooltip
                  labelFormatter={(label) => label}
                  formatter={(value, name) => [
                    formatUnits(value),
                    name === "actualDemand"
                      ? "Recorded weekly demand"
                      : "Forecast for period dates",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="actualDemand"
                  name="actualDemand"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="predictedDemand"
                  name="predictedDemand"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="grid h-64 place-items-center text-center text-sm text-slate-400">
            <p>
              {selectedForecast
                ? "No recorded sales history for this product. A demand prediction is not generated."
                : "No active products are available for demand analysis."}
            </p>
          </div>
        )}
        {selectedForecast?.forecast?.status === "insufficient_data" ||
        selectedForecast?.forecast?.status === "uncertain" ? (
          <p role="status" className="mt-2 text-sm text-amber-200">
            {selectedForecast.forecast.reason}
          </p>
        ) : null}
        {selectedForecast?.forecast?.status === "reliable" ? (
          <p className="mt-2 text-xs text-slate-500">
            Validation WAPE {selectedForecast.forecast.validationWape}% ·
            confidence {selectedForecast.forecast.confidence}% (a history- and
            error-based score, not a probability).
          </p>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="min-w-0 rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">
              Demand and reorder recommendations
            </h2>
            <p className="text-sm text-slate-400">
              Forecasts are withheld when history is insufficient or the
              heuristic quality score is below 40/100.
            </p>
          </div>
          {isLoading ? (
            <div
              role="status"
              className="grid h-40 place-items-center text-sm text-slate-400"
            >
              Analyzing workspace sales…
            </div>
          ) : insights.forecastItems.length ? (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[900px] divide-y divide-white/10 text-left text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="px-3 py-3">Part</th>
                    <th className="px-3 py-3">28-day demand</th>
                    <th className="px-3 py-3">On hand</th>
                    <th className="px-3 py-3">On order</th>
                    <th className="px-3 py-3">Purchase action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-slate-900/60 text-slate-200">
                  {insights.forecastItems.slice(0, 10).map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-3">
                        <Link
                          className="font-medium text-white hover:text-cyan-300"
                          to={`/inventory/${item.id}`}
                        >
                          {item.productName}
                        </Link>
                        <p className="text-xs text-slate-500">
                          Part number: {item.sku || "Not recorded"}
                          {item.oemPartNumber
                            ? ` · OEM: ${item.oemPartNumber}`
                            : ""}{" "}
                          · {item.forecast.model}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        {formatUnits(item.forecast.next28DayDemand)}
                      </td>
                      <td className="px-3 py-3">
                        {formatUnits(item.currentStock)}
                      </td>
                      <td className="px-3 py-3">
                        {formatUnits(item.outstandingQuantity)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            item.purchaseRecommendation?.action === "Buy Now"
                              ? "text-amber-200"
                              : "text-cyan-200"
                          }
                        >
                          {item.purchaseRecommendation?.action || "Review"}
                          {item.recommendedPurchaseQty > 0
                            ? ` · ${formatUnits(item.recommendedPurchaseQty)} net units`
                            : ""}
                        </span>
                        <p className="mt-1 max-w-md text-xs text-slate-400">
                          {item.purchaseRecommendation?.explanation ||
                            "Review the forecast and current inventory before purchasing."}
                        </p>
                        {item.purchaseRecommendation?.warning ? (
                          <p className="mt-1 max-w-md text-xs text-amber-300">
                            {item.purchaseRecommendation.warning}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-slate-500">
                          Validation quality score {item.forecast.confidence}% ·
                          not a probability
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={
                items.length
                  ? "No validated demand forecasts yet"
                  : "No active products to forecast"
              }
              description={
                items.length
                  ? "Record sales in at least 6 different weeks, including 3 of the last 13 weeks, to start evaluating demand. Purchase quantities remain withheld until the history is reliable."
                  : "Add or activate products in this workspace to see demand analysis."
              }
            />
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
            <div className="flex items-center gap-2 text-amber-200">
              <FiAlertTriangle size={18} />
              <h2 className="text-lg font-semibold text-white">
                Priority stock actions
              </h2>
            </div>
            <div className="mt-4 space-y-3">
              {insights.reorderItems.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        className="truncate font-medium text-white hover:text-cyan-300"
                        to={`/inventory/${item.id}`}
                      >
                        {item.productName}
                      </Link>
                      <p className="text-xs text-slate-500">
                        Part number: {item.sku || "Not recorded"}
                        {item.oemPartNumber
                          ? ` · OEM: ${item.oemPartNumber}`
                          : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm text-cyan-300">
                      {item.purchaseRecommendation?.action === "Wait"
                        ? `Wait · ${item.outstandingQuantity} on order`
                        : item.recommendedPurchaseQty === null
                          ? item.currentStock === item.minimumStock
                            ? "At minimum · monitor"
                            : `${item.stockGap} below min · monitor`
                          : item.recommendedPurchaseQty > 0
                            ? `${item.recommendedPurchaseQty} net units · buy`
                            : "Monitor"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    {item.currentStock} on hand · minimum {item.minimumStock}
                    {item.purchaseRecommendation?.projected28DayDemand !==
                      null &&
                    item.purchaseRecommendation?.projected28DayDemand !==
                      undefined
                      ? ` · ${formatUnits(item.purchaseRecommendation.projected28DayDemand)} projected 28-day demand`
                      : ""}
                    {item.estimatedDaysUntilStockout !== null
                      ? ` · estimated ${item.estimatedDaysUntilStockout} days of stock`
                      : ""}
                  </p>
                  {item.purchaseRecommendation?.warning ? (
                    <p className="mt-1 text-xs text-amber-300">
                      {item.purchaseRecommendation.warning}
                    </p>
                  ) : null}
                </div>
              ))}
              {!isLoading && !insights.reorderItems.length ? (
                <p className="text-sm text-slate-400">
                  No products currently need a reorder.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-[24px] border border-cyan-500/20 bg-cyan-500/5 p-5">
            <div className="flex items-center gap-2 text-cyan-300">
              <FiTarget size={18} />
              <h2 className="text-lg font-semibold text-white">
                How this forecast works
              </h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Three local models are compared using six rolling weeks of
              historical validation. The best-performing model predicts the
              calendar weeks intersecting the next 28 full Colombo dates from
              the last 26 completed weeks of sales. Each weekly estimate is
              distributed evenly across its seven days, and only dates in the
              forward window contribute to 28-day demand.
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Validation score is an error-based quality indicator, not a
              probability. Reorder quantities are planning estimates; confirm
              supplier lead times and current stock before purchasing.
            </p>
            <Link
              to="/ai-assistant"
              className="mt-4 inline-flex rounded-xl border border-cyan-400/20 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10"
            >
              Ask the local inventory assistant
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ForecastPage;
