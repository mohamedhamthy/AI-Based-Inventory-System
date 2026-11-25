import { useEffect, useMemo, useRef, useState } from 'react';
import { FiPlus, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import EmptyState from '../components/common/EmptyState';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import PageHeader from '../components/common/PageHeader';
import Pagination from '../components/common/Pagination';
import SearchInput from '../components/common/SearchInput';
import { useAuth } from '../contexts/AuthContext';
import { getAllProducts } from '../services/productService';
import { getSuppliers } from '../services/supplierService';
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrder,
  getPurchaseOrders,
  orderPurchaseOrder,
  receivePurchaseOrder,
  updatePurchaseOrder,
} from '../services/purchaseOrderService';
import { hasPermission } from '../utils/permissions';
import { formatBusinessDate, formatLkr, toBusinessDateInputValue } from '../utils/formatters';

const pageSize = 10;
const emptyForm = () => ({
  supplierId: '',
  orderDate: toBusinessDateInputValue(),
  expectedDeliveryDate: '',
  notes: '',
  items: [{ productId: '', orderedQuantity: '1', unitCost: '0' }],
});

const formatDate = formatBusinessDate;
const formatMoney = (value) => formatLkr(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getId = (value) => (typeof value === 'string' ? value : value?._id || value?.id || '');

const PurchaseOrdersPage = () => {
  const { user } = useAuth();
  const canCreate = hasPermission(user, 'purchaseOrders:create');
  const canManage = hasPermission(user, 'purchaseOrders:manage');
  const canReceive = hasPermission(user, 'purchaseOrders:receive');
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ totalPages: 1, totalItems: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(canCreate);
  const [optionsError, setOptionsError] = useState('');
  const [optionsReloadKey, setOptionsReloadKey] = useState(0);
  const [receiptQuantities, setReceiptQuantities] = useState({});
  const [receiptError, setReceiptError] = useState('');
  const [isReceiving, setIsReceiving] = useState(false);
  const receiptKeyRef = useRef(null);
  const receiptFingerprintRef = useRef(null);

  const totals = useMemo(() => form.items.reduce((result, item) => {
    const quantity = Number(item.orderedQuantity) || 0;
    const unitCost = Number(item.unitCost) || 0;
    return {
      subtotal: result.subtotal + quantity * unitCost,
      units: result.units + quantity,
    };
  }, { subtotal: 0, units: 0 }), [form.items]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(search);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    getPurchaseOrders({
      page,
      limit: pageSize,
      status: status || undefined,
      search: searchQuery || undefined,
    })
      .then((data) => {
        if (!active) return;
        setOrders(data.purchaseOrders || []);
        setPagination(data.pagination || { totalPages: 1, totalItems: 0 });
        setLoadError('');
      })
      .catch((error) => {
        if (active) setLoadError(error.message || 'Unable to load purchase orders.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [page, status, searchQuery, reloadKey]);

  useEffect(() => {
    if (!canCreate) return undefined;
    let active = true;
    Promise.all([getSuppliers(), getAllProducts()])
      .then(([supplierItems, productItems]) => {
        if (!active) return;
        setSuppliers(supplierItems.filter((supplier) => supplier.status === 'active' && supplier.isActive !== false));
        setProducts(productItems.filter((product) => product.isActive !== false));
        setOptionsError('');
      })
      .catch((error) => {
        if (active) setOptionsError(error.message || 'Unable to load suppliers and products.');
      })
      .finally(() => {
        if (active) setIsLoadingOptions(false);
      });
    return () => { active = false; };
  }, [canCreate, optionsReloadKey]);

  const refreshOrders = (selectedId = getId(selectedOrder)) => {
    setIsLoading(true);
    setReloadKey((value) => value + 1);
    if (!selectedId) return;
    setIsLoadingDetail(true);
    getPurchaseOrder(selectedId)
      .then(setSelectedOrder)
      .catch((error) => {
        setSelectedOrder(null);
        toast.error(error.message || 'Unable to refresh purchase order details.');
      })
      .finally(() => setIsLoadingDetail(false));
  };

  const openOrder = async (id) => {
    setSelectedOrder(null);
    setIsLoadingDetail(true);
    setReceiptError('');
    setReceiptQuantities({});
    receiptKeyRef.current = null;
    receiptFingerprintRef.current = null;
    try {
      setSelectedOrder(await getPurchaseOrder(id));
    } catch (error) {
      toast.error(error.message || 'Unable to load purchase order details.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const beginCreate = () => {
    setEditingId('');
    setForm(emptyForm());
    setFormError('');
    setIsFormOpen(true);
  };

  const beginEdit = (purchaseOrder) => {
    setEditingId(getId(purchaseOrder));
    setForm({
      supplierId: getId(purchaseOrder.supplier),
      orderDate: toBusinessDateInputValue(purchaseOrder.orderDate),
      expectedDeliveryDate: purchaseOrder.expectedDeliveryDate
        ? toBusinessDateInputValue(purchaseOrder.expectedDeliveryDate)
        : '',
      notes: purchaseOrder.notes || '',
      items: purchaseOrder.items.map((item) => ({
        productId: getId(item.product),
        orderedQuantity: String(item.orderedQuantity),
        unitCost: String(item.unitCost),
      })),
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const updateItem = (index, field, value) => setForm((current) => ({
    ...current,
    items: current.items.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )),
  }));

  const submitPurchaseOrder = async (event) => {
    event.preventDefault();
    if (isSaving) return;
    setFormError('');
    setIsSaving(true);
    const payload = {
      supplierId: form.supplierId,
      orderDate: form.orderDate,
      expectedDeliveryDate: form.expectedDeliveryDate || undefined,
      notes: form.notes,
      items: form.items.map((item) => ({
        productId: item.productId,
        orderedQuantity: Number(item.orderedQuantity),
        unitCost: Number(item.unitCost),
      })),
    };
    try {
      const saved = editingId
        ? await updatePurchaseOrder(editingId, payload)
        : await createPurchaseOrder(payload);
      setIsFormOpen(false);
      setEditingId('');
      setForm(emptyForm());
      toast.success(editingId ? 'Draft purchase order updated.' : 'Draft purchase order created.');
      if (selectedOrder && getId(selectedOrder) === getId(saved)) refreshOrders(getId(saved));
      else refreshOrders('');
    } catch (error) {
      setFormError(error.message || 'Unable to save purchase order.');
    } finally {
      setIsSaving(false);
    }
  };

  const runOrderAction = async (action, successMessage) => {
    try {
      await action(getId(selectedOrder));
      toast.success(successMessage);
      refreshOrders();
    } catch (error) {
      toast.error(error.message || 'Unable to update purchase order.');
    }
  };

  const handleReceipt = async (event) => {
    event.preventDefault();
    if (isReceiving || !selectedOrder) return;
    const items = selectedOrder.items
      .map((item) => ({
        productId: getId(item.product),
        quantity: Number(receiptQuantities[getId(item.product)] || 0),
      }))
      .filter((item) => item.quantity > 0);
    if (items.length === 0) {
      setReceiptError('Enter a positive receiving quantity for at least one item.');
      return;
    }
    const fingerprint = JSON.stringify({ purchaseOrderId: getId(selectedOrder), items });
    if (fingerprint !== receiptFingerprintRef.current) {
      receiptFingerprintRef.current = fingerprint;
      receiptKeyRef.current = crypto.randomUUID();
    }
    setReceiptError('');
    setIsReceiving(true);
    try {
      await receivePurchaseOrder(getId(selectedOrder), items, receiptKeyRef.current);
      setReceiptQuantities({});
      receiptFingerprintRef.current = null;
      receiptKeyRef.current = null;
      toast.success('Purchase order receipt recorded and stock updated.');
      refreshOrders();
    } catch (error) {
      if (error.code === 'PURCHASE_ORDER_RECEIPT_KEY_ALREADY_USED') {
        setReceiptError('This receipt key was already processed or used with different details. Refresh the purchase order and stock information before attempting another receipt.');
      } else {
        setReceiptError(error.message || 'Unable to record this receipt. Retrying unchanged details will reuse the same request key.');
      }
    } finally {
      setIsReceiving(false);
    }
  };

  const retryLoad = () => {
    setLoadError('');
    setIsLoading(true);
    setReloadKey((value) => value + 1);
  };

  const retryOptions = () => {
    setOptionsError('');
    setIsLoadingOptions(true);
    setOptionsReloadKey((value) => value + 1);
  };

  const startCancel = () => {
    if (!window.confirm(`Cancel purchase order ${selectedOrder.poNumber}?`)) return;
    runOrderAction(cancelPurchaseOrder, 'Purchase order cancelled.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase orders"
        description="Create purchase orders, track deliveries, and receive stock into the active workspace."
        action={canCreate ? (
          <button type="button" onClick={isFormOpen ? () => setIsFormOpen(false) : beginCreate} className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950">
            <FiPlus size={16} /> {isFormOpen ? 'Close form' : 'New purchase order'}
          </button>
        ) : null}
      />

      {canCreate && isFormOpen ? (
        <form onSubmit={submitPurchaseOrder} className="space-y-5 rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold text-white">{editingId ? 'Edit draft purchase order' : 'Create draft purchase order'}</h2>
          {optionsError ? <p role="alert" className="text-sm text-rose-300">{optionsError}<button type="button" onClick={retryOptions} className="ml-2 underline">Retry</button></p> : null}
          {formError ? <p role="alert" className="text-sm text-rose-300">{formError}</p> : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Supplier</span>
              <select aria-label="Purchase order supplier" required value={form.supplierId} disabled={isLoadingOptions || isSaving} onChange={(event) => updateForm('supplierId', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white">
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => <option key={getId(supplier)} value={getId(supplier)}>{supplier.name}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Order date</span>
              <input type="date" required value={form.orderDate} onChange={(event) => updateForm('orderDate', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white" />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Expected delivery (optional)</span>
              <input type="date" value={form.expectedDeliveryDate} onChange={(event) => updateForm('expectedDeliveryDate', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white" />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Notes</span>
              <input maxLength="1000" value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white" />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-white">Line items</h3>
              <button type="button" disabled={isSaving || products.length === 0} onClick={() => setForm((current) => ({ ...current, items: [...current.items, { productId: '', orderedQuantity: '1', unitCost: '0' }] }))} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-cyan-200 disabled:opacity-50">Add item</button>
            </div>
            {isLoadingOptions ? <LoadingSkeleton /> : null}
            {form.items.map((item, index) => {
              const selectedIds = form.items.filter((_, itemIndex) => itemIndex !== index).map((line) => line.productId);
              return (
                <div key={`po-item-${index}`} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3 md:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]">
                  <label className="text-sm text-slate-300">
                    <span className="mb-2 block">Part</span>
                    <select aria-label={`Part for purchase order item ${index + 1}`} required value={item.productId} disabled={isSaving || isLoadingOptions} onChange={(event) => updateItem(index, 'productId', event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white">
                      <option value="">Select product</option>
                      {products.map((product) => <option key={product.id} value={product.id} disabled={selectedIds.includes(product.id)}>{product.productName} · part number {product.sku || 'not recorded'}{product.oemPartNumber ? ` · OEM ${product.oemPartNumber}` : ''} · stock {product.currentStock} / min {product.minimumStock} · cost {formatMoney(product.costPrice)}{product.compatibleModels ? ` · ${product.compatibleModels}` : ''}</option>)}
                    </select>
                  </label>
                  <label className="text-sm text-slate-300">
                    <span className="mb-2 block">Quantity</span>
                    <input type="number" min="1" step="1" required value={item.orderedQuantity} onChange={(event) => updateItem(index, 'orderedQuantity', event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
                  </label>
                  <label className="text-sm text-slate-300">
                    <span className="mb-2 block">Unit cost</span>
                    <input type="number" min="0" step="0.01" required value={item.unitCost} onChange={(event) => updateItem(index, 'unitCost', event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
                  </label>
                  <div className="flex items-end justify-between gap-3 text-sm text-slate-300">
                    <span>Line: {formatMoney((Number(item.orderedQuantity) || 0) * (Number(item.unitCost) || 0))}</span>
                    {form.items.length > 1 ? <button type="button" aria-label="Remove item" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} className="pb-2 text-rose-300">Remove</button> : null}
                  </div>
                </div>
              );
            })}
            <p className="text-right text-sm text-slate-300">Total units: {totals.units} · Order total: <span className="font-semibold text-white">{formatMoney(totals.subtotal)}</span></p>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={isSaving || isLoadingOptions || Boolean(optionsError)} className="rounded-2xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">{isSaving ? 'Saving…' : editingId ? 'Save draft' : 'Create draft'}</button>
            <button type="button" onClick={() => { setIsFormOpen(false); setEditingId(''); }} className="rounded-2xl border border-white/10 px-4 py-2 text-slate-300">Cancel</button>
          </div>
        </form>
      ) : null}

      <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <SearchInput value={search} onChange={(value) => { setSearch(value); setLoadError(''); setIsLoading(true); }} placeholder="Search purchase orders or suppliers" />
          <select aria-label="Filter purchase orders by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); setIsLoading(true); }} className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white">
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="ordered">Ordered</option>
            <option value="partially_received">Partially received</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        {loadError ? <p role="alert" className="mt-4 text-sm text-rose-300">{loadError}<button type="button" onClick={retryLoad} className="ml-2 underline">Retry</button></p> : null}
        {isLoading ? <div className="mt-4"><LoadingSkeleton /></div> : null}
        {!isLoading && !loadError && orders.length === 0 ? <div className="mt-4"><EmptyState title="No purchase orders found" description={searchQuery || status ? 'Try changing the search or status filter.' : 'Create a draft purchase order to plan an incoming delivery.'} /></div> : null}
        {!isLoading && orders.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400"><tr><th className="p-3">Order</th><th className="p-3">Supplier</th><th className="p-3">Order date</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">Details</th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={getId(order)} className="border-t border-white/10 text-slate-300">
                    <td className="p-3 font-medium text-white">{order.poNumber}</td>
                    <td className="p-3">{order.supplier?.name || 'Supplier unavailable'}</td>
                    <td className="p-3">{formatDate(order.orderDate)}</td>
                    <td className="p-3">{formatMoney(order.totalAmount)}</td>
                    <td className="p-3"><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">{order.status.replaceAll('_', ' ')}</span></td>
                    <td className="p-3"><button type="button" onClick={() => openOrder(getId(order))} className="text-cyan-300 underline underline-offset-2">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!isLoading && orders.length > 0 ? <div className="mt-4"><Pagination currentPage={page} totalPages={pagination.totalPages || 1} onPageChange={(nextPage) => { setPage(nextPage); setIsLoading(true); }} /></div> : null}
      </section>

      {(selectedOrder || isLoadingDetail) ? (
        <section className="space-y-5 rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          {isLoadingDetail ? <LoadingSkeleton /> : null}
          {selectedOrder ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">{selectedOrder.poNumber}</h2>
                  <p className="mt-1 text-sm text-slate-400">{selectedOrder.supplier?.name || 'Supplier unavailable'} · Ordered {formatDate(selectedOrder.orderDate)} · Expected {formatDate(selectedOrder.expectedDeliveryDate)}</p>
                  <p className="mt-2 text-sm text-slate-300">Status: <span className="capitalize text-cyan-200">{selectedOrder.status.replaceAll('_', ' ')}</span> · Total: {formatMoney(selectedOrder.totalAmount)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => refreshOrders()} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300"><FiRefreshCw /> Refresh</button>
                  {canManage && selectedOrder.status === 'draft' ? <button type="button" onClick={() => beginEdit(selectedOrder)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-cyan-200">Edit draft</button> : null}
                  {canManage && selectedOrder.status === 'draft' ? <button type="button" onClick={() => runOrderAction(orderPurchaseOrder, 'Purchase order marked as ordered.')} className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950">Mark ordered</button> : null}
                  {canManage && ['draft', 'ordered'].includes(selectedOrder.status) && selectedOrder.items.every((item) => item.receivedQuantity === 0) ? <button type="button" onClick={startCancel} className="rounded-xl border border-rose-400/30 px-3 py-2 text-sm text-rose-300">Cancel order</button> : null}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400"><tr><th className="p-3">Part</th><th className="p-3">Ordered</th><th className="p-3">Received</th><th className="p-3">Remaining</th><th className="p-3">Unit cost</th><th className="p-3">Line total</th></tr></thead>
                  <tbody>
                    {selectedOrder.items.map((item) => (
                      <tr key={item._id || getId(item.product)} className="border-t border-white/10 text-slate-300">
                        <td className="p-3 text-white">
                          {item.product?.productName || 'Product unavailable'} {item.product?.sku ? <span className="text-xs text-cyan-200">· Part number: {item.product.sku}</span> : null}
                        </td>
                        <td className="p-3">{item.orderedQuantity}</td>
                        <td className="p-3">{item.receivedQuantity}</td>
                        <td className="p-3">{item.orderedQuantity - item.receivedQuantity}</td>
                        <td className="p-3">{formatMoney(item.unitCost)}</td>
                        <td className="p-3">{formatMoney(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedOrder.notes ? <p className="text-sm text-slate-400">Notes: {selectedOrder.notes}</p> : null}

              {canReceive && ['ordered', 'partially_received'].includes(selectedOrder.status) ? (
                <form onSubmit={handleReceipt} className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div><h3 className="font-semibold text-white">Record delivery</h3><p className="mt-1 text-xs text-slate-400">Enter only quantities received in this delivery. Stock and ledger records update together.</p></div>
                  {receiptError ? <p role="alert" className="text-sm text-rose-300">{receiptError}</p> : null}
                  <div className="space-y-2">
                    {selectedOrder.items.filter((item) => item.receivedQuantity < item.orderedQuantity).map((item) => {
                      const productKey = getId(item.product);
                      const remaining = item.orderedQuantity - item.receivedQuantity;
                      return (
                        <label key={item._id || productKey} className="grid items-center gap-3 text-sm text-slate-300 md:grid-cols-[1fr_auto_auto]">
                          <span>{item.product?.productName || 'Product'} · {item.receivedQuantity} received of {item.orderedQuantity}</span>
                          <span className="text-xs text-slate-500">Remaining {remaining}</span>
                          <input aria-label={`Receive quantity for ${item.product?.productName || 'product'}`} type="number" min="0" max={remaining} step="1" value={receiptQuantities[productKey] || ''} onChange={(event) => setReceiptQuantities((current) => ({ ...current, [productKey]: event.target.value }))} className="w-28 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white" />
                        </label>
                      );
                    })}
                  </div>
                  <button type="submit" disabled={isReceiving} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{isReceiving ? 'Recording…' : 'Record receipt'}</button>
                </form>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};

export default PurchaseOrdersPage;
