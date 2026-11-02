import { useEffect, useMemo, useState } from 'react';
import { FiPackage, FiShoppingCart, FiUsers } from 'react-icons/fi';
import { toast } from 'react-toastify';
import PageHeader from '../components/common/PageHeader';
import { getProducts } from '../services/productService';
import { createSale, getSales } from '../services/saleService';
import { useAuth } from '../contexts/AuthContext';

const initialForm = {
  customerName: '',
  phone: '',
  product: '',
  quantity: '1',
  unitPrice: '',
  paymentStatus: 'Paid',
  notes: '',
};

const SalesPage = () => {
  const { user } = useAuth();
  const isDemo = user?.role === 'demo';
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [saleData, productData] = await Promise.all([getSales(), getProducts({ page: 1, limit: 50 })]);
        setSales(saleData || []);
        setProducts(productData.products || []);
      } catch (error) {
        toast.error(error.message || 'Unable to load sales data');
      }
    };
    loadData();
  }, []);

  const summary = useMemo(() => {
    const totalSales = sales.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
    const totalQty = sales.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return { totalSales, totalQty, transactions: sales.length };
  }, [sales]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const sale = await createSale({
        customerName: form.customerName,
        phone: form.phone,
        product: form.product,
        quantity: Number(form.quantity),
        unitPrice: Number(form.unitPrice),
        paymentStatus: form.paymentStatus,
        notes: form.notes,
      });
      setSales((prev) => [sale, ...prev]);
      setForm(initialForm);
      toast.success('Sale recorded successfully');
    } catch (error) {
      toast.error(error.message || 'Unable to save sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Management"
        description="Record bike-part sales, update stock, and monitor shop revenue from one responsive page."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Today sales</p>
              <p className="mt-2 text-2xl font-semibold text-white">LKR {summary.totalSales.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300"><FiShoppingCart size={18} /></div>
          </div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Parts sold</p>
              <p className="mt-2 text-2xl font-semibold text-white">{summary.totalQty}</p>
            </div>
            <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-300"><FiPackage size={18} /></div>
          </div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Customers</p>
              <p className="mt-2 text-2xl font-semibold text-white">{summary.transactions}</p>
            </div>
            <div className="rounded-2xl bg-violet-500/10 p-3 text-violet-300"><FiUsers size={18} /></div>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${isDemo ? '' : 'xl:grid-cols-[0.9fr_1.1fr]'}`}>
        {isDemo ? (
          <section className="rounded-[24px] border border-amber-400/20 bg-amber-400/5 p-5">
            <h2 className="font-semibold text-amber-100">Read-only sample sales</h2>
            <p className="mt-2 text-sm text-amber-100/70">Sales creation is disabled in demo mode. The transactions shown here use fictional sample records.</p>
          </section>
        ) : (
        <form onSubmit={handleSubmit} className="min-w-0 rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold text-white">New sale</h2>
          <div className="mt-4 space-y-4">
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Customer name</span>
              <input required value={form.customerName} onChange={(event) => setForm((prev) => ({ ...prev, customerName: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white" />
            </label>
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Phone</span>
              <input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white" />
            </label>
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Part</span>
              <select required value={form.product} onChange={(event) => setForm((prev) => ({ ...prev, product: event.target.value, unitPrice: products.find((item) => item.id === event.target.value)?.sellingPrice || '' }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white">
                <option value="">Select part</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.productName}</option>)}
              </select>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Quantity</span>
                <input type="number" min="1" required value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white" />
              </label>
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Unit price (LKR)</span>
                <input type="number" min="0" required value={form.unitPrice} onChange={(event) => setForm((prev) => ({ ...prev, unitPrice: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white" />
              </label>
            </div>
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Payment status</span>
              <select value={form.paymentStatus} onChange={(event) => setForm((prev) => ({ ...prev, paymentStatus: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white">
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
              </select>
            </label>
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Notes</span>
              <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white" rows="3" />
            </label>
            <button type="submit" disabled={isSubmitting} className="rounded-2xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? 'Saving sale...' : 'Save sale'}
            </button>
          </div>
        </form>
        )}

        <div className={`min-w-0 rounded-[24px] border border-white/10 bg-slate-900/70 p-5 ${isDemo ? 'xl:col-span-1' : ''}`}>
          <div className="mb-4 flex items-center gap-2 text-cyan-300">
            <FiPackage size={18} />
            <h2 className="text-lg font-semibold text-white">Recent sales</h2>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
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
                {sales.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium text-white">{row.customerName}</td>
                    <td className="px-4 py-3">{row.product?.productName || row.product || '—'}</td>
                    <td className="px-4 py-3">{row.quantity}</td>
                    <td className="px-4 py-3">LKR {Number(row.totalAmount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">{row.paymentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesPage;
