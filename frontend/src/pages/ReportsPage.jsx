import { useEffect, useMemo, useState } from "react";
import { FiDownload, FiRefreshCw } from "react-icons/fi";
import EmptyState from "../components/common/EmptyState";
import PageHeader from "../components/common/PageHeader";
import Pagination from "../components/common/Pagination";
import { getCategories } from "../services/categoryService";
import { getAllProducts } from "../services/productService";
import { getSuppliers } from "../services/supplierService";
import {
  downloadReportCsv,
  getInventoryReport,
  getMovementReport,
  getSalesReport,
} from "../services/reportService";
import { formatBusinessDateTime, formatLkr } from "../utils/formatters";

const pageSize = 25;
const tabOptions = [
  { id: "inventory", label: "Current inventory" },
  { id: "movements", label: "Stock movements" },
  { id: "sales", label: "Sales reports" },
];
const initialFilters = {
  from: "",
  to: "",
  productId: "",
  categoryId: "",
  supplierId: "",
  status: "all",
  type: "",
};
const formatNumber = (value) => Number(value || 0).toLocaleString("en-LK");
const formatMoney = formatLkr;
const formatDate = formatBusinessDateTime;

const ReportTable = ({ columns, rows, emptyMessage }) => (
  <div className="overflow-x-auto rounded-2xl border border-white/10">
    <table className="w-full min-w-max divide-y divide-white/10 text-left text-sm">
      <thead className="bg-slate-950/70 text-slate-400">
        <tr>
          {columns.map((column) => (
            <th key={column.key} className="px-4 py-3">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/10 bg-slate-900/60 text-slate-200">
        {rows.map((row, index) => (
          <tr key={row.id || row._id || `${row._id}-${index}`}>
            {columns.map((column) => (
              <td key={column.key} className="px-4 py-3">
                {column.render ? column.render(row) : (row[column.key] ?? "—")}
              </td>
            ))}
          </tr>
        ))}
        {rows.length === 0 ? (
          <tr>
            <td className="px-4 py-5 text-slate-400" colSpan={columns.length}>
              {emptyMessage}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  </div>
);

const SummaryCard = ({ label, value, detail }) => (
  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
    <p className="text-sm text-slate-400">{label}</p>
    <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
  </div>
);

const ReportsPage = () => {
  const [reportType, setReportType] = useState("inventory");
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [report, setReport] = useState(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const queryFilters = useMemo(
    () => ({
      ...filters,
      page,
      limit: pageSize,
    }),
    [filters, page],
  );

  useEffect(() => {
    let isCurrent = true;
    Promise.all([
      getAllProducts({ includeInactive: true }),
      getCategories({ includeInactive: true }),
      getSuppliers({ includeInactive: true }),
    ])
      .then(([productRows, categoryRows, supplierRows]) => {
        if (!isCurrent) return;
        setProducts(productRows);
        setCategories(categoryRows);
        setSuppliers(supplierRows);
        setFilterError("");
      })
      .catch((error) => {
        if (isCurrent)
          setFilterError(error.message || "Unable to load report filters.");
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const load =
      reportType === "inventory"
        ? getInventoryReport(queryFilters)
        : reportType === "movements"
          ? getMovementReport(queryFilters)
          : getSalesReport(queryFilters);
    load
      .then((data) => {
        if (isCurrent) setReport(data);
      })
      .catch((error) => {
        if (isCurrent)
          setLoadError(error.message || "Unable to load report data.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [reportType, queryFilters, reloadKey]);

  const updateDraft = (field, value) =>
    setDraftFilters((current) => ({ ...current, [field]: value }));
  const applyFilters = (event) => {
    event.preventDefault();
    if (
      draftFilters.from &&
      draftFilters.to &&
      draftFilters.from > draftFilters.to
    ) {
      setLoadError("The start date must be on or before the end date.");
      return;
    }
    setIsLoading(true);
    setLoadError("");
    setFilters({ ...draftFilters });
    setPage(1);
  };
  const clearFilters = () => {
    setIsLoading(true);
    setDraftFilters({ ...initialFilters });
    setFilters({ ...initialFilters });
    setPage(1);
    setLoadError("");
  };
  const exportCsv = async (type) => {
    setIsExporting(true);
    try {
      await downloadReportCsv(type, filters);
    } catch (error) {
      setLoadError(error.message || "Unable to export report.");
    } finally {
      setIsExporting(false);
    }
  };
  const retryLoad = () => {
    setIsLoading(true);
    setLoadError("");
    setReloadKey((key) => key + 1);
  };
  const changePage = (nextPage) => {
    setIsLoading(true);
    setPage(nextPage);
  };
  const pagination = report?.pagination || { totalPages: 0, totalItems: 0 };

  const inventoryColumns = [
    { key: "productName", label: "Product" },
    { key: "sku", label: "Part number (SKU)" },
    {
      key: "category",
      label: "Category",
      render: (row) => row.category?.name || "—",
    },
    {
      key: "supplier",
      label: "Supplier",
      render: (row) => row.supplier?.name || "—",
    },
    { key: "currentStock", label: "Current stock" },
    { key: "minimumStock", label: "Reorder threshold" },
    {
      key: "costPrice",
      label: "Unit cost",
      render: (row) => formatMoney(row.costPrice),
    },
  ];
  const movementColumns = [
    {
      key: "createdAt",
      label: "Date (Asia/Colombo)",
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: "movementType",
      label: "Type",
      render: (row) => row.movementType?.replace("_", " "),
    },
    {
      key: "product",
      label: "Product",
      render: (row) => (
        <>
          {row.product?.productName || "Product unavailable"}
          {row.product?.sku ? (
            <p className="text-xs text-slate-400">
              Part number: {row.product.sku}
            </p>
          ) : null}
          {row.product?.oemPartNumber ? (
            <p className="text-xs text-slate-500">
              OEM: {row.product.oemPartNumber}
            </p>
          ) : null}
        </>
      ),
    },
    { key: "quantity", label: "Quantity" },
    { key: "stockBefore", label: "Before" },
    { key: "stockAfter", label: "After" },
    { key: "reference", label: "Reference" },
  ];
  const salesColumns = [
    {
      key: "saleDate",
      label: "Date (Asia/Colombo)",
      render: (row) => formatDate(row.saleDate),
    },
    {
      key: "product",
      label: "Product",
      render: (row) => (
        <>
          {row.product?.productName || "Product unavailable"}
          {row.product?.sku ? (
            <p className="text-xs text-slate-400">
              Part number: {row.product.sku}
            </p>
          ) : null}
          {row.product?.oemPartNumber ? (
            <p className="text-xs text-slate-500">
              OEM: {row.product.oemPartNumber}
            </p>
          ) : null}
        </>
      ),
    },
    { key: "quantity", label: "Quantity" },
    {
      key: "unitPrice",
      label: "Unit price",
      render: (row) => formatMoney(row.unitPrice),
    },
    {
      key: "totalAmount",
      label: "Total",
      render: (row) => formatMoney(row.totalAmount),
    },
    { key: "paymentStatus", label: "Payment" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory & sales reports"
        description="Review current inventory, stock ledger activity, and workspace sales with filterable CSV exports."
        action={
          <button
            type="button"
            disabled={isLoading || isExporting}
            onClick={() => exportCsv(reportType)}
            className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiDownload size={16} />{" "}
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
        }
      />

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Report type"
      >
        {tabOptions.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={reportType === tab.id}
            onClick={() => {
              if (reportType === tab.id) return;
              setIsLoading(true);
              setReportType(tab.id);
              setPage(1);
              setLoadError("");
            }}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${reportType === tab.id ? "bg-cyan-500/20 text-cyan-200" : "border border-white/10 text-slate-300 hover:bg-white/5"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={applyFilters}
        className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {reportType !== "inventory" ? (
            <>
              <label className="text-xs text-slate-400">
                From (Sri Lanka date)
                <input
                  type="date"
                  value={draftFilters.from}
                  onChange={(event) => updateDraft("from", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-xs text-slate-400">
                To (inclusive, Sri Lanka date)
                <input
                  type="date"
                  value={draftFilters.to}
                  onChange={(event) => updateDraft("to", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
            </>
          ) : null}
          <label className="text-xs text-slate-400">
            Product
            <select
              value={draftFilters.productId}
              onChange={(event) => updateDraft("productId", event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="">All products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.productName} · {product.sku}
                  {product.oemPartNumber
                    ? ` · OEM ${product.oemPartNumber}`
                    : ""}
                  {product.isActive === false ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Category
            <select
              value={draftFilters.categoryId}
              onChange={(event) =>
                updateDraft("categoryId", event.target.value)
              }
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.isActive === false ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Supplier
            <select
              value={draftFilters.supplierId}
              onChange={(event) =>
                updateDraft("supplierId", event.target.value)
              }
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              <option value="">All suppliers</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                  {supplier.isActive === false ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </label>
          {reportType === "inventory" ? (
            <label className="text-xs text-slate-400">
              Stock status
              <select
                value={draftFilters.status}
                onChange={(event) => updateDraft("status", event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="all">All active stock</option>
                <option value="in_stock">In stock</option>
                <option value="low_stock">Low stock</option>
                <option value="out_of_stock">Out of stock</option>
              </select>
            </label>
          ) : null}
          {reportType === "movements" ? (
            <label className="text-xs text-slate-400">
              Movement type
              <select
                value={draftFilters.type}
                onChange={(event) => updateDraft("type", event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="">All movements</option>
                <option value="stock_in">Stock-In</option>
                <option value="sale">Sales</option>
                <option value="adjustment">Adjustments</option>
              </select>
            </label>
          ) : null}
        </div>
        {filterError ? (
          <p role="alert" className="mt-3 text-sm text-amber-200">
            {filterError}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
          >
            Clear filters
          </button>
        </div>
      </form>

      {loadError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/5 p-4 text-sm text-rose-200"
        >
          {loadError}
          <button
            type="button"
            onClick={retryLoad}
            className="flex items-center gap-2 underline"
          >
            <FiRefreshCw /> Retry
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div
          role="status"
          className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 text-center text-sm text-slate-400"
        >
          Loading report...
        </div>
      ) : null}

      {!isLoading && reportType === "inventory" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              label="Active products"
              value={formatNumber(report?.summary?.totalProducts)}
            />
            <SummaryCard
              label="Units on hand"
              value={formatNumber(report?.summary?.totalStockQuantity)}
            />
            <SummaryCard
              label="Low stock"
              value={formatNumber(report?.summary?.lowStockProducts)}
              detail="Above zero, at or below threshold"
            />
            <SummaryCard
              label="Out of stock"
              value={formatNumber(report?.summary?.outOfStockProducts)}
            />
            <SummaryCard
              label="Inventory cost value"
              value={formatMoney(report?.summary?.inventoryValue)}
              detail="Current stock × unit cost"
            />
          </div>
          {(report?.products || []).length === 0 ? (
            <EmptyState
              title="No inventory records"
              description="No active products match the selected filters."
            />
          ) : (
            <ReportTable
              columns={inventoryColumns}
              rows={report.products}
              emptyMessage="No products match these filters."
            />
          )}
        </>
      ) : null}

      {!isLoading && reportType === "movements" ? (
        (report?.movements || []).length === 0 ? (
          <EmptyState
            title="No stock movements"
            description="No ledger entries match the selected filters."
          />
        ) : (
          <ReportTable
            columns={movementColumns}
            rows={report.movements}
            emptyMessage="No movements match these filters."
          />
        )
      ) : null}

      {!isLoading && reportType === "sales" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Sales total"
              value={formatMoney(report?.summary?.totalSales)}
            />
            <SummaryCard
              label="Transactions"
              value={formatNumber(report?.summary?.transactions)}
            />
            <SummaryCard
              label="Quantity sold"
              value={formatNumber(report?.summary?.quantitySold)}
            />
          </div>
          <section className="space-y-3 rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold text-white">Sales by date</h2>
            {report?.summaryTruncation?.byDate ? (
              <p role="status" className="text-sm text-amber-200">
                Showing the first {report.summaryTruncation.limit} daily
                summaries. Narrow the date range to see a complete daily
                breakdown.
              </p>
            ) : null}
            <ReportTable
              columns={[
                { key: "_id", label: "Date (Asia/Colombo)" },
                {
                  key: "totalSales",
                  label: "Sales",
                  render: (row) => formatMoney(row.totalSales),
                },
                { key: "quantitySold", label: "Quantity sold" },
                { key: "transactions", label: "Transactions" },
              ]}
              rows={report?.byDate || []}
              emptyMessage="No daily sales exist in the selected date range."
            />
          </section>
          <section className="space-y-3 rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Monthly sales summary
                </h2>
                <p className="text-sm text-slate-400">
                  Based on sale dates grouped by Sri Lankan calendar month
                </p>
                {report?.summaryTruncation?.monthlySales ? (
                  <p role="status" className="mt-1 text-sm text-amber-200">
                    Showing the first {report.summaryTruncation.limit} monthly
                    summaries.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => exportCsv("monthlySales")}
                className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
              >
                <FiDownload /> Monthly CSV
              </button>
            </div>
            <ReportTable
              columns={[
                { key: "_id", label: "Month (Asia/Colombo)" },
                {
                  key: "totalSales",
                  label: "Sales",
                  render: (row) => formatMoney(row.totalSales),
                },
                { key: "quantitySold", label: "Quantity sold" },
                { key: "transactions", label: "Transactions" },
              ]}
              rows={report?.monthlySales || []}
              emptyMessage="No sales exist in the selected date range."
            />
          </section>
          <section className="space-y-3 rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold text-white">
              Product sales summary
            </h2>
            {report?.summaryTruncation?.byProduct ? (
              <p role="status" className="text-sm text-amber-200">
                Showing the top {report.summaryTruncation.limit} products by
                sales.
              </p>
            ) : null}
            <ReportTable
              columns={[
                { key: "productName", label: "Product" },
                { key: "sku", label: "Part number (SKU)" },
                { key: "quantitySold", label: "Quantity sold" },
                {
                  key: "totalSales",
                  label: "Sales",
                  render: (row) => formatMoney(row.totalSales),
                },
                { key: "transactions", label: "Transactions" },
              ]}
              rows={report?.byProduct || []}
              emptyMessage="No product sales match the selected filters."
            />
          </section>
          <section className="space-y-3 rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Sales by customer
                </h2>
                <p className="text-sm text-slate-400">
                  Customer totals for the selected date and parts filters
                </p>
                {report?.summaryTruncation?.byCustomer ? (
                  <p role="status" className="mt-1 text-sm text-amber-200">
                    Showing the top {report.summaryTruncation.limit} customers
                    by sales.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => exportCsv("customerSales")}
                className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
              >
                <FiDownload /> Customer CSV
              </button>
            </div>
            <ReportTable
              columns={[
                { key: "customerName", label: "Customer" },
                {
                  key: "totalSales",
                  label: "Sales",
                  render: (row) => formatMoney(row.totalSales),
                },
                { key: "quantitySold", label: "Quantity sold" },
                { key: "transactions", label: "Transactions" },
              ]}
              rows={report?.byCustomer || []}
              emptyMessage="No customer sales match the selected filters."
            />
          </section>
          <section className="space-y-3 rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold text-white">
              Sales transactions
            </h2>
            {(report?.sales || []).length === 0 ? (
              <EmptyState
                title="No sales transactions"
                description="No sales match the selected filters."
              />
            ) : (
              <ReportTable
                columns={salesColumns}
                rows={report.sales}
                emptyMessage="No sales match these filters."
              />
            )}
          </section>
        </>
      ) : null}

      {!isLoading && report && pagination.totalItems > pageSize ? (
        <Pagination
          currentPage={page}
          totalPages={Math.max(1, pagination.totalPages)}
          onPageChange={changePage}
        />
      ) : null}
      {!isLoading && report && pagination.totalItems === 0 ? (
        <p className="text-center text-xs text-slate-500">
          Empty exports include the selected report headers.
        </p>
      ) : null}
    </div>
  );
};

export default ReportsPage;
