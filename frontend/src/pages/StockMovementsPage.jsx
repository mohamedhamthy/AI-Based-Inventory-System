import { useEffect, useRef, useState } from "react";
import {
  FiArrowDownLeft,
  FiArrowUpRight,
  FiPackage,
  FiPlus,
  FiRefreshCw,
} from "react-icons/fi";
import { toast } from "react-toastify";
import EmptyState from "../components/common/EmptyState";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import PageHeader from "../components/common/PageHeader";
import Pagination from "../components/common/Pagination";
import SearchInput from "../components/common/SearchInput";
import { useAuth } from "../contexts/AuthContext";
import { getAllProducts } from "../services/productService";
import {
  getStockMovements,
  receiveStock,
} from "../services/stockMovementService";
import { hasPermission } from "../utils/permissions";
import { formatBusinessDateTime } from "../utils/formatters";

const pageSize = 10;

const StockMovementsPage = () => {
  const { user } = useAuth();
  const canReceiveStock = hasPermission(user, "stock:manage");
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({
    totalUnits: 0,
    inbound: 0,
    outbound: 0,
    adjustments: 0,
  });
  const [pagination, setPagination] = useState({
    totalPages: 1,
    totalItems: 0,
  });
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productError, setProductError] = useState("");
  const [productsReloadKey, setProductsReloadKey] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const idempotencyKeyRef = useRef(null);
  const idempotencyFingerprintRef = useRef(null);
  const [form, setForm] = useState({
    productId: "",
    quantity: "1",
    reference: "",
    reason: "",
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(search);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let isCurrent = true;

    getStockMovements({
      page,
      limit: pageSize,
      type: type || undefined,
      search: searchQuery || undefined,
    })
      .then((data) => {
        if (!isCurrent) return;
        setMovements(data.movements || []);
        setSummary(
          data.summary || {
            totalUnits: 0,
            inbound: 0,
            outbound: 0,
            adjustments: 0,
          },
        );
        setPagination(data.pagination || { totalPages: 1, totalItems: 0 });
      })
      .catch((error) => {
        if (isCurrent)
          setLoadError(error.message || "Unable to load stock movements.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [page, type, searchQuery, reloadKey]);

  useEffect(() => {
    if (!canReceiveStock) return undefined;
    let isCurrent = true;
    getAllProducts()
      .then((items) => {
        if (!isCurrent) return;
        setProducts(items);
        setProductError("");
        setForm((current) => ({
          ...current,
          productId: current.productId || items[0]?.id || "",
        }));
      })
      .catch((error) => {
        if (isCurrent)
          setProductError(
            error.message || "Unable to load products for stock-in.",
          );
      })
      .finally(() => {
        if (isCurrent) setIsLoadingProducts(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [canReceiveStock, productsReloadKey]);

  const handleStockIn = async (event) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const requestData = {
        productId: form.productId,
        quantity: Number(form.quantity),
        reference: form.reference,
        reason: form.reason,
      };
      const fingerprint = JSON.stringify(requestData);
      if (fingerprint !== idempotencyFingerprintRef.current) {
        idempotencyFingerprintRef.current = fingerprint;
        idempotencyKeyRef.current = crypto.randomUUID();
      }
      const result = await receiveStock(requestData, idempotencyKeyRef.current);
      setProducts((current) =>
        current.map((product) =>
          product.id === result.product.id
            ? { ...product, ...result.product }
            : product,
        ),
      );
      setForm((current) => ({
        ...current,
        quantity: "1",
        reference: "",
        reason: "",
      }));
      idempotencyKeyRef.current = null;
      idempotencyFingerprintRef.current = null;
      setPage(1);
      setIsLoading(true);
      setLoadError("");
      setReloadKey((current) => current + 1);
      toast.success(
        `${result.product.productName} received; stock is now ${result.product.currentStock}.`,
      );
    } catch (error) {
      toast.error(error.message || "Unable to receive stock.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setIsLoading(true);
    setLoadError("");
  };
  const retryProducts = () => {
    setProductError("");
    setIsLoadingProducts(true);
    setProductsReloadKey((current) => current + 1);
  };
  const retryLoad = () => {
    setIsLoading(true);
    setLoadError("");
    setReloadKey((current) => current + 1);
  };
  const cards = [
    {
      label: "Units moved",
      value: summary.totalUnits,
      icon: <FiPackage size={18} />,
      tone: "text-cyan-300 bg-cyan-500/10",
    },
    {
      label: "Inbound",
      value: summary.inbound,
      icon: <FiArrowDownLeft size={18} />,
      tone: "text-emerald-300 bg-emerald-500/10",
    },
    {
      label: "Sold",
      value: summary.outbound,
      icon: <FiArrowUpRight size={18} />,
      tone: "text-amber-300 bg-amber-500/10",
    },
    {
      label: "Adjustments",
      value: summary.adjustments,
      icon: <FiRefreshCw size={18} />,
      tone: "text-violet-300 bg-violet-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock movements"
        description="Review stock receipts, sales, and adjustments for the active workspace."
        action={
          canReceiveStock ? (
            <button
              type="button"
              onClick={() => setIsFormOpen((open) => !open)}
              className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950"
            >
              <FiPlus size={16} />{" "}
              {isFormOpen ? "Close stock-in" : "Receive stock"}
            </button>
          ) : null
        }
      />

      {canReceiveStock && isFormOpen ? (
        <form
          onSubmit={handleStockIn}
          className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5"
        >
          <h2 className="text-lg font-semibold text-white">Receive stock</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Part</span>
              <select
                required
                value={form.productId}
                disabled={
                  isSubmitting || isLoadingProducts || products.length === 0
                }
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    productId: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white disabled:opacity-60"
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.productName} · Part number:{" "}
                    {product.sku || "not recorded"}
                    {product.oemPartNumber
                      ? ` · OEM ${product.oemPartNumber}`
                      : ""}{" "}
                    · stock {product.currentStock}
                    {product.compatibleModels
                      ? ` · ${product.compatibleModels}`
                      : ""}
                  </option>
                ))}
              </select>
              {productError ? (
                <span role="alert" className="mt-2 block text-xs text-rose-300">
                  {productError}
                  <button
                    type="button"
                    onClick={retryProducts}
                    className="ml-2 underline"
                  >
                    Retry
                  </button>
                </span>
              ) : null}
              {isLoadingProducts ? (
                <span className="mt-2 block text-xs text-slate-400">
                  Loading products...
                </span>
              ) : null}
              {!isLoadingProducts && !productError && products.length === 0 ? (
                <span className="mt-2 block text-xs text-slate-400">
                  Create a product before receiving stock.
                </span>
              ) : null}
            </label>
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Quantity</span>
              <input
                required
                type="number"
                disabled={isSubmitting}
                min="0.01"
                step="0.01"
                value={form.quantity}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    quantity: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
              />
            </label>
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Reference (optional)</span>
              <input
                maxLength="120"
                disabled={isSubmitting}
                value={form.reference}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reference: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
              />
            </label>
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Reason or notes (optional)</span>
              <input
                maxLength="500"
                disabled={isSubmitting}
                value={form.reason}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={
              isSubmitting ||
              isLoadingProducts ||
              products.length === 0 ||
              Boolean(productError)
            }
            className="mt-4 rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Receiving stock..." : "Save stock receipt"}
          </button>
        </form>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {Number(card.value).toLocaleString()}
                </p>
              </div>
              <div className={`rounded-2xl p-3 ${card.tone}`}>{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search product, SKU, reference or notes"
          />
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
              setIsLoading(true);
              setLoadError("");
            }}
            className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white"
            aria-label="Filter movement type"
          >
            <option value="">All movement types</option>
            <option value="stock_in">Stock in</option>
            <option value="sale">Sale</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </div>

        {loadError ? (
          <div
            role="alert"
            className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200"
          >
            <p>{loadError}</p>
            <button
              type="button"
              onClick={retryLoad}
              className="mt-3 rounded-xl border border-rose-300/20 px-3 py-2 text-rose-100"
            >
              Retry
            </button>
          </div>
        ) : null}
        {isLoading ? <LoadingSkeleton /> : null}
        {!isLoading && !loadError && movements.length === 0 ? (
          <EmptyState
            title="No stock movements found"
            description="Stock receipts, sales, and adjustments will appear here."
          />
        ) : null}
        {!isLoading && !loadError && movements.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[1000px] divide-y divide-white/10 text-left text-sm">
              <thead className="bg-slate-950/70 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Before → After</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-900/60 text-slate-200">
                {movements.map((movement) => {
                  const movementLabel =
                    movement.movementType === "stock_in"
                      ? "Stock in"
                      : movement.movementType === "sale"
                        ? "Sale"
                        : "Adjustment";
                  const typeTone =
                    movement.movementType === "stock_in"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : movement.movementType === "sale"
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-violet-500/15 text-violet-300";
                  return (
                    <tr key={movement.id || movement._id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">
                          {movement.product?.productName ||
                            "Product unavailable"}
                        </p>
                        <p className="text-xs text-cyan-200">
                          Part number: {movement.product?.sku || "Not recorded"}
                        </p>
                        {movement.product?.oemPartNumber ? (
                          <p className="text-xs text-slate-500">
                            OEM: {movement.product.oemPartNumber}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${typeTone}`}
                        >
                          {movementLabel}
                        </span>
                        {movement.reason ? (
                          <p className="mt-1 max-w-xs truncate text-xs text-slate-400">
                            {movement.reason}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {Number(movement.quantity).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {Number(movement.stockBefore).toLocaleString()} →{" "}
                        {Number(movement.stockAfter).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{movement.reference || "—"}</td>
                      <td className="px-4 py-3">
                        {movement.performedBy?.name ||
                          movement.performedBy?.email ||
                          "—"}
                      </td>
                      <td className="px-4 py-3">
                        {formatBusinessDateTime(movement.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        <Pagination
          currentPage={page}
          totalPages={Math.max(1, pagination.totalPages)}
          onPageChange={(nextPage) => {
            setIsLoading(true);
            setPage(nextPage);
          }}
        />
      </div>
    </div>
  );
};

export default StockMovementsPage;
