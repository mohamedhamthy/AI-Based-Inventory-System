import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  FiEye,
  FiEdit2,
  FiMinus,
  FiPackage,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import StockStatusBadge from "./StockStatusBadge";
import { adjustProductStock } from "../../services/stockMovementService";
import { formatLkr } from "../../utils/formatters";

const ProductTable = ({
  products,
  onDelete,
  onStockUpdate,
  canUpdate = false,
  canManageStock = false,
  canDelete = false,
}) => {
  const rows = useMemo(() => products, [products]);
  const [updatingId, setUpdatingId] = useState(null);
  const updatingRef = useRef(new Set());
  const idempotencyKeysRef = useRef(new Map());

  const handleStockChange = useCallback(
    async (product, delta) => {
      const availableStock = Number(product.currentStock || 0);
      const quantity =
        delta < 0 ? Math.min(Math.abs(delta), availableStock) : Math.abs(delta);
      if (quantity <= 0 || updatingRef.current.has(product.id)) return;
      const direction = delta > 0 ? "increase" : "decrease";
      const operationKey = `${product.id}:${direction}:${quantity}`;
      const idempotencyKey =
        idempotencyKeysRef.current.get(operationKey) || crypto.randomUUID();
      idempotencyKeysRef.current.set(operationKey, idempotencyKey);
      updatingRef.current.add(product.id);
      setUpdatingId(product.id);

      try {
        const result = await adjustProductStock(
          {
            productId: product.id,
            quantity,
            direction,
            reason: "Quick stock adjustment",
          },
          idempotencyKey,
        );
        idempotencyKeysRef.current.delete(operationKey);
        onStockUpdate?.(result.product, product);
        toast.success(`${product.productName} stock updated`);
      } catch (error) {
        toast.error(error.message || "Unable to update stock");
      } finally {
        updatingRef.current.delete(product.id);
        setUpdatingId(null);
      }
    },
    [onStockUpdate],
  );

  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/70">
      <div className="overflow-x-auto">
        <div className="md:min-w-[900px]">
          <div className="hidden grid-cols-[1.6fr_0.8fr_0.8fr_0.6fr_0.8fr_0.6fr_0.6fr] gap-4 border-b border-white/10 px-4 py-3 text-sm font-medium text-slate-400 md:grid">
            <div>Product</div>
            <div>Category</div>
            <div>Supplier</div>
            <div>Stock</div>
            <div>Price</div>
            <div>Status</div>
            <div>Actions</div>
          </div>

          <div className="space-y-3 p-3 md:space-y-0 md:divide-y md:divide-white/10 md:p-0">
            {rows.map((product) => (
              <div
                key={product.id}
                className="grid gap-3 rounded-2xl border border-white/5 bg-slate-950/40 p-4 transition duration-200 hover:bg-white/[0.03] sm:grid-cols-2 md:grid-cols-[1.6fr_0.8fr_0.8fr_0.6fr_0.8fr_0.6fr_0.6fr] md:items-center md:gap-4 md:rounded-none md:border-x-0 md:border-b md:border-t-0 md:bg-transparent md:px-4 md:py-4"
              >
                <div className="flex min-w-0 items-center gap-3 sm:col-span-2 md:col-span-1">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width="48"
                      height="48"
                      className="h-12 w-12 shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-800 text-cyan-200"
                    >
                      <FiPackage size={18} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      {product.productName}
                    </p>
                    <p className="text-sm font-medium text-cyan-200">
                      Part number: {product.sku || "Not recorded"}
                    </p>
                    {product.oemPartNumber ? (
                      <p className="truncate text-xs text-slate-400">
                        OEM number: {product.oemPartNumber}
                      </p>
                    ) : null}
                    {product.compatibleModels ? (
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        Models: {product.compatibleModels}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="text-sm text-slate-300">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                    Category
                  </p>
                  {product.category?.name || product.category || "—"}
                </div>
                <div className="min-w-0 text-sm text-slate-300">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                    Supplier
                  </p>
                  <span className="block truncate">
                    {product.supplier?.name || product.supplier || "—"}
                  </span>
                </div>
                <div className="text-sm text-slate-300">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                    Stock
                  </p>
                  {product.currentStock}
                </div>
                <div className="text-sm text-slate-300">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                    Price
                  </p>
                  {formatLkr(product.sellingPrice)}
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                    Status
                  </p>
                  <StockStatusBadge
                    status={product.status || product.stockStatus}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 md:hidden">
                    Actions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {canManageStock && (
                      <>
                        <button
                          type="button"
                          aria-label={`Decrease ${product.productName} stock`}
                          onClick={() => handleStockChange(product, -1)}
                          disabled={
                            updatingId === product.id ||
                            Number(product.currentStock || 0) <= 0
                          }
                          className="rounded-xl border border-white/10 p-2 text-slate-300"
                        >
                          <FiMinus size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Increase ${product.productName} stock`}
                          onClick={() => handleStockChange(product, 1)}
                          disabled={updatingId === product.id}
                          className="rounded-xl border border-white/10 p-2 text-slate-300"
                        >
                          <FiPlus size={16} />
                        </button>
                      </>
                    )}
                    <Link
                      aria-label={`View ${product.productName} details`}
                      to={`/inventory/${product.id}`}
                      className="rounded-xl border border-white/10 p-2 text-slate-300"
                    >
                      <FiEye size={16} />
                    </Link>
                    {canUpdate && (
                      <Link
                        aria-label={`Edit ${product.productName}`}
                        to={`/inventory/${product.id}/edit`}
                        className="rounded-xl border border-white/10 p-2 text-slate-300"
                      >
                        <FiEdit2 size={16} />
                      </Link>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        aria-label={`Delete ${product.productName}`}
                        onClick={() => onDelete(product)}
                        className="rounded-xl border border-rose-500/20 p-2 text-rose-300"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(ProductTable);
