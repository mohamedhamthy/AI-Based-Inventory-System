import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiPackage,
  FiPlus,
  FiShoppingCart,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import { toast } from "react-toastify";
import PageHeader from "../components/common/PageHeader";
import Pagination from "../components/common/Pagination";
import { getAllProducts } from "../services/productService";
import { createSale, getSales } from "../services/saleService";
import { getCustomers } from "../services/customerService";
import { useAuth } from "../contexts/AuthContext";
import { hasPermission, isDemoUser } from "../utils/permissions";
import { formatLkr } from "../utils/formatters";

const initialForm = {
  customerId: "",
  customerName: "",
  phone: "",
  items: [{ productId: "", quantity: "1", unitPrice: "" }],
  discountAmount: "0",
  taxRate: "0",
  paymentStatus: "Paid",
  notes: "",
};

const duplicateSaleMessage =
  "This sale may already have been recorded. Refresh sales and stock information before attempting another sale.";

const SalesPage = () => {
  const { user } = useAuth();
  const canCreateSales = hasPermission(user, "sales:create");
  const isDemo = isDemoUser(user);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    totalPages: 1,
    totalItems: 0,
  });
  const [summaryData, setSummaryData] = useState({
    totalSales: 0,
    totalQty: 0,
    transactions: 0,
  });
  const [isLoadingSales, setIsLoadingSales] = useState(true);
  const [salesError, setSalesError] = useState("");
  const [reloadSales, setReloadSales] = useState(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState(canCreateSales);
  const [productsError, setProductsError] = useState("");
  const [reloadProducts, setReloadProducts] = useState(0);
  const [customersError, setCustomersError] = useState("");
  const [duplicateRetryWarning, setDuplicateRetryWarning] = useState("");
  const idempotencyKey = useRef(null);
  const idempotencyFingerprint = useRef(null);
  const submittingRef = useRef(false);

  const invoiceTotals = useMemo(() => {
    const subtotal = form.items.reduce((total, item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      return (
        total +
        (Number.isFinite(quantity) && Number.isFinite(unitPrice)
          ? quantity * unitPrice
          : 0)
      );
    }, 0);
    const discountAmount = Number(form.discountAmount) || 0;
    const taxRate = Number(form.taxRate) || 0;
    const taxableSubtotal = Math.max(0, subtotal - discountAmount);
    const taxAmount =
      Math.round(((taxableSubtotal * taxRate) / 100 + Number.EPSILON) * 100) /
      100;
    return {
      subtotal,
      discountAmount,
      taxAmount,
      total:
        Math.round((taxableSubtotal + taxAmount + Number.EPSILON) * 100) / 100,
    };
  }, [form.items, form.discountAmount, form.taxRate]);

  useEffect(() => {
    let isCurrent = true;
    const loadData = async () => {
      try {
        const saleData = await getSales({ page, limit: 10 });
        if (!isCurrent) return;
        setSales(saleData.sales || []);
        setPagination(saleData.pagination || { totalPages: 1, totalItems: 0 });
        setSummaryData(
          saleData.summary || { totalSales: 0, totalQty: 0, transactions: 0 },
        );
        setSalesError("");
      } catch (error) {
        if (isCurrent)
          setSalesError(error.message || "Unable to load sales data.");
      } finally {
        if (isCurrent) setIsLoadingSales(false);
      }
    };
    loadData();

    return () => {
      isCurrent = false;
    };
  }, [page, reloadSales]);

  useEffect(() => {
    if (!canCreateSales) return undefined;
    let isCurrent = true;
    getAllProducts()
      .then((items) => {
        if (!isCurrent) return;
        setProducts(items);
        setProductsError("");
      })
      .catch((error) => {
        if (isCurrent)
          setProductsError(error.message || "Unable to load parts for sale.");
      })
      .finally(() => {
        if (isCurrent) setIsLoadingProducts(false);
      });
    getCustomers({ limit: 100 })
      .then((customerData) => {
        if (isCurrent) {
          setCustomers(customerData.customers || []);
          setCustomersError("");
        }
      })
      .catch((error) => {
        if (isCurrent)
          setCustomersError(error.message || "Unable to load saved customers.");
      });
    return () => {
      isCurrent = false;
    };
  }, [canCreateSales, reloadProducts]);

  const summary = summaryData;
  const retryProducts = () => {
    setProductsError("");
    setIsLoadingProducts(true);
    setReloadProducts((key) => key + 1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    if (
      new Set(form.items.map((item) => item.productId).filter(Boolean)).size !==
      form.items.length
    ) {
      toast.error("Each product can only appear once on an invoice.");
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const requestData = {
        ...(form.customerId ? { customerId: form.customerId } : {}),
        customerName: form.customerName,
        phone: form.phone,
        items: form.items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
        paymentStatus: form.paymentStatus,
        notes: form.notes,
        discountAmount: Number(form.discountAmount),
        taxRate: Number(form.taxRate),
      };
      const fingerprint = JSON.stringify(requestData);
      if (fingerprint !== idempotencyFingerprint.current) {
        idempotencyFingerprint.current = fingerprint;
        idempotencyKey.current = crypto.randomUUID();
      }
      const result = await createSale(requestData, idempotencyKey.current);
      idempotencyKey.current = null;
      idempotencyFingerprint.current = null;
      const invoiceLines = result.invoice?.items || [result.sale];
      setSales((prev) => [...invoiceLines, ...prev].slice(0, 10));
      if (page !== 1) {
        setIsLoadingSales(true);
        setPage(1);
      }
      setSummaryData((prev) => ({
        totalSales: prev.totalSales + result.invoice.invoiceTotal,
        totalQty:
          prev.totalQty +
          invoiceLines.reduce((total, sale) => total + sale.quantity, 0),
        transactions: prev.transactions + 1,
      }));
      setForm(initialForm);
      setDuplicateRetryWarning("");
      toast.success("Sale recorded successfully");
    } catch (error) {
      if (error.code === "IDEMPOTENCY_KEY_ALREADY_USED") {
        setDuplicateRetryWarning(duplicateSaleMessage);
        toast.error(duplicateSaleMessage);
      } else {
        toast.error(error.message || "Unable to save sale");
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description="Record spare-parts sales and review the sales-linked stock and revenue history."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total sales</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {formatLkr(summary.totalSales)}
              </p>
            </div>
            <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300">
              <FiShoppingCart size={18} />
            </div>
          </div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Quantity sold</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {summary.totalQty}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-300">
              <FiPackage size={18} />
            </div>
          </div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Transactions</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {summary.transactions}
              </p>
            </div>
            <div className="rounded-2xl bg-violet-500/10 p-3 text-violet-300">
              <FiUsers size={18} />
            </div>
          </div>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-6 ${!canCreateSales ? "" : "xl:grid-cols-[0.9fr_1.1fr]"}`}
      >
        {!canCreateSales ? (
          <section className="rounded-[24px] border border-amber-400/20 bg-amber-400/5 p-5">
            <h2 className="font-semibold text-amber-100">
              {isDemo ? "Read-only sample sales" : "Read-only sales access"}
            </h2>
            <p className="mt-2 text-sm text-amber-100/70">
              {isDemo
                ? "Sales creation is disabled in demo mode. The transactions shown here use fictional sample records."
                : "Your current role can review sales but cannot record a sale."}
            </p>
          </section>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="min-w-0 rounded-[24px] border border-white/10 bg-slate-900/70 p-5"
          >
            <h2 className="text-lg font-semibold text-white">New sale</h2>
            {duplicateRetryWarning ? (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-100"
              >
                {duplicateRetryWarning}
              </p>
            ) : null}
            <div className="mt-4 space-y-4">
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Saved customer</span>
                <select
                  value={form.customerId}
                  onChange={(event) => {
                    const customer = customers.find(
                      (item) => (item.id || item._id) === event.target.value,
                    );
                    setForm((prev) => ({
                      ...prev,
                      customerId: event.target.value,
                      customerName: customer?.name || "",
                      phone: customer?.phone || "",
                    }));
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
                >
                  <option value="">Walk-in / enter customer details</option>
                  {customers.map((customer) => (
                    <option
                      key={customer.id || customer._id}
                      value={customer.id || customer._id}
                    >
                      {customer.name}
                      {customer.phone ? ` · ${customer.phone}` : ""}
                    </option>
                  ))}
                </select>
                {customersError ? (
                  <span
                    role="alert"
                    className="mt-2 block text-xs text-rose-300"
                  >
                    {customersError}
                  </span>
                ) : null}
              </label>
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">
                  {form.customerId ? "Customer" : "Customer name"}
                </span>
                <input
                  required={!form.customerId}
                  disabled={Boolean(form.customerId)}
                  value={form.customerName}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      customerName: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white disabled:opacity-70"
                />
              </label>
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Phone</span>
                <input
                  disabled={Boolean(form.customerId)}
                  value={form.phone}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white disabled:opacity-70"
                />
              </label>
              <section aria-label="Invoice items" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-200">
                    Invoice items
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        items: [
                          ...prev.items,
                          { productId: "", quantity: "1", unitPrice: "" },
                        ],
                      }))
                    }
                    className="flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-cyan-200"
                  >
                    <FiPlus /> Add item
                  </button>
                </div>
                {form.items.map((item, index) => (
                  <div
                    key={`invoice-line-${index}`}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400">
                        Line {index + 1}
                      </span>
                      {form.items.length > 1 ? (
                        <button
                          type="button"
                          aria-label={`Remove invoice line ${index + 1}`}
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              items: prev.items.filter(
                                (_, lineIndex) => lineIndex !== index,
                              ),
                            }))
                          }
                          className="p-1 text-rose-300"
                        >
                          <FiTrash2 />
                        </button>
                      ) : null}
                    </div>
                    <label className="mt-2 block text-sm text-slate-300">
                      <span className="mb-2 block">Part</span>
                      <select
                        aria-label={`Select part for invoice line ${index + 1}`}
                        required
                        value={item.productId}
                        disabled={
                          isLoadingProducts ||
                          products.length === 0 ||
                          Boolean(productsError)
                        }
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            items: prev.items.map((line, lineIndex) =>
                              lineIndex === index
                                ? {
                                    ...line,
                                    productId: event.target.value,
                                    unitPrice:
                                      products.find(
                                        (product) =>
                                          product.id === event.target.value,
                                      )?.sellingPrice ?? "",
                                  }
                                : line,
                            ),
                          }))
                        }
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white disabled:opacity-60"
                      >
                        <option value="">Select part</option>
                        {products.map((product) => (
                          <option
                            key={product.id}
                            value={product.id}
                            disabled={
                              Number(product.currentStock) <= 0 ||
                              form.items.some(
                                (line, lineIndex) =>
                                  lineIndex !== index &&
                                  line.productId === product.id,
                              )
                            }
                          >
                            {product.productName} · {product.sku || "no SKU"}
                            {product.oemPartNumber
                              ? ` · OEM ${product.oemPartNumber}`
                              : ""}{" "}
                            · stock {product.currentStock}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm text-slate-300">
                        <span className="mb-2 block">Quantity</span>
                        <input
                          type="number"
                          min="1"
                          max={
                            products.find(
                              (product) => product.id === item.productId,
                            )?.currentStock || undefined
                          }
                          required
                          value={item.quantity}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              items: prev.items.map((line, lineIndex) =>
                                lineIndex === index
                                  ? { ...line, quantity: event.target.value }
                                  : line,
                              ),
                            }))
                          }
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
                        />
                      </label>
                      <label className="block text-sm text-slate-300">
                        <span className="mb-2 block">Unit price (LKR)</span>
                        <input
                          type="number"
                          min="0"
                          required
                          value={item.unitPrice}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              items: prev.items.map((line, lineIndex) =>
                                lineIndex === index
                                  ? { ...line, unitPrice: event.target.value }
                                  : line,
                              ),
                            }))
                          }
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
                        />
                      </label>
                    </div>
                  </div>
                ))}
                {isLoadingProducts ? (
                  <span role="status" className="block text-xs text-slate-400">
                    Loading parts…
                  </span>
                ) : null}
                {productsError ? (
                  <span role="alert" className="block text-xs text-rose-300">
                    {productsError}
                    <button
                      type="button"
                      onClick={retryProducts}
                      className="ml-2 underline"
                    >
                      Retry
                    </button>
                  </span>
                ) : null}
                {!isLoadingProducts &&
                !productsError &&
                products.length === 0 ? (
                  <span className="block text-xs text-slate-400">
                    No active parts are available.
                  </span>
                ) : null}
              </section>
              <section
                aria-label="Invoice totals"
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm text-slate-300">
                    <span className="mb-2 block">Discount (LKR)</span>
                    <input
                      type="number"
                      min="0"
                      max={invoiceTotals.subtotal}
                      step="0.01"
                      value={form.discountAmount}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          discountAmount: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
                    />
                  </label>
                  <label className="block text-sm text-slate-300">
                    <span className="mb-2 block">Tax rate (%)</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.taxRate}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          taxRate: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
                    />
                  </label>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-slate-400">Subtotal</dt>
                  <dd className="text-right">
                    {formatLkr(invoiceTotals.subtotal)}
                  </dd>
                  <dt className="text-slate-400">Discount</dt>
                  <dd className="text-right">
                    −{formatLkr(invoiceTotals.discountAmount)}
                  </dd>
                  <dt className="text-slate-400">Tax</dt>
                  <dd className="text-right">
                    {formatLkr(invoiceTotals.taxAmount)}
                  </dd>
                  <dt className="font-semibold text-white">Invoice total</dt>
                  <dd className="text-right font-semibold text-white">
                    {formatLkr(invoiceTotals.total)}
                  </dd>
                </dl>
              </section>
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Payment status</span>
                <select
                  value={form.paymentStatus}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      paymentStatus: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
                >
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Partial">Partial</option>
                </select>
              </label>
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
                  rows="3"
                />
              </label>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  isLoadingProducts ||
                  products.length === 0 ||
                  Boolean(productsError)
                }
                className="rounded-2xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Saving invoice..." : "Save invoice"}
              </button>
            </div>
          </form>
        )}

        <div
          className={`min-w-0 rounded-[24px] border border-white/10 bg-slate-900/70 p-5 ${!canCreateSales ? "xl:col-span-1" : ""}`}
        >
          <div className="mb-4 flex items-center gap-2 text-cyan-300">
            <FiPackage size={18} />
            <h2 className="text-lg font-semibold text-white">Recent sales</h2>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            {salesError ? (
              <p role="alert" className="p-3 text-sm text-rose-300">
                {salesError}
                <button
                  type="button"
                  onClick={() => {
                    setIsLoadingSales(true);
                    setReloadSales((key) => key + 1);
                  }}
                  className="ml-2 underline"
                >
                  Retry
                </button>
              </p>
            ) : null}
            <table className="w-full min-w-max divide-y divide-white/10 text-left text-sm">
              <thead className="bg-slate-950/70 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Part</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-900/60 text-slate-200">
                {isLoadingSales ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-400" colSpan="5">
                      Loading sales...
                    </td>
                  </tr>
                ) : (
                  sales.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium text-white">
                        {row.customer?.name || row.customerName}
                        <p className="text-xs text-slate-500">
                          {row.invoiceNumber || row.id}
                        </p>
                        <p className="text-xs text-slate-500">
                          Invoice total{" "}
                          {formatLkr(row.invoiceTotal || row.totalAmount)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {row.product?.productName || row.product || "—"}
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
                      </td>
                      <td className="px-4 py-3">{row.quantity}</td>
                      <td className="px-4 py-3">
                        {formatLkr(row.totalAmount)}
                      </td>
                      <td className="px-4 py-3">{row.paymentStatus}</td>
                    </tr>
                  ))
                )}
                {!isLoadingSales && !salesError && sales.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-400" colSpan="5">
                      No sales recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={page}
            totalPages={Math.max(1, pagination.totalPages)}
            onPageChange={(nextPage) => {
              setIsLoadingSales(true);
              setPage(nextPage);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default SalesPage;
