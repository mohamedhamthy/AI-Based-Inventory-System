import { useEffect, useMemo, useState } from 'react';
import { FiBox, FiClipboard, FiCpu, FiPackage, FiTrendingUp, FiTruck } from 'react-icons/fi';
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'react-toastify';
import StatCard from '../components/common/StatCard';
import { getDashboardOverview } from '../services/productService';
import { useAuth } from '../contexts/AuthContext';

const DashboardPage = () => {
  const { user } = useAuth();
  const isDemo = user?.role === 'demo';
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await getDashboardOverview();
        setOverview(data);
      } catch (error) {
        toast.error(error.message || 'Unable to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboard();
  }, []);

  const stats = useMemo(() => {
    if (!overview?.overview) return [];
    return [
      { title: 'Total Parts', value: overview.overview.totalProducts.toLocaleString(), detail: 'Active Yamaha part catalog', icon: FiBox, tone: 'default' },
      { title: 'Stock On Hand', value: overview.overview.totalStockQuantity.toLocaleString(), detail: 'Units ready for sale', icon: FiPackage, tone: 'success' },
      { title: 'Parts Value', value: `LKR ${overview.overview.inventoryValue.toLocaleString()}`, detail: 'Based on selling prices', icon: FiTrendingUp, tone: 'warning' },
      { title: 'Low Stock', value: overview.overview.lowStockProducts.toLocaleString(), detail: 'Needs restock soon', icon: FiClipboard, tone: 'danger' },
    ];
  }, [overview]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Yamaha parts shop</p>
        <h1 className="text-3xl font-semibold text-white">Sales & stock dashboard</h1>
        <p className="text-slate-400">{isDemo ? 'Explore sample inventory, suppliers, and sales data in a separate read-only workspace.' : 'Monitor parts availability, fast-moving items, and shop sales readiness from one responsive screen.'}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-[24px] border border-white/10 bg-slate-900/70" />) : stats.map((stat) => <StatCard key={stat.title} {...stat} />)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Part movement trend</h2>
              <p className="text-sm text-slate-400">Stock in and out activity across recent weeks</p>
            </div>
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300">{isDemo ? 'Sample data' : 'Live data'}</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview?.trend || []}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.75} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                <Tooltip />
                <Area dataKey="inStock" stroke="#22d3ee" fill="url(#salesFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">Stock distribution</h2>
            <p className="text-sm text-slate-400">Current status by category</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={overview?.statusDistribution || []} dataKey="value" innerRadius={70} outerRadius={110} paddingAngle={3}>
                  {(overview?.statusDistribution || []).map((entry, index) => <Cell key={entry.name} fill={['#22d3ee', '#f59e0b', '#ef4444'][index]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent parts activity</h2>
              <p className="text-sm text-slate-400">Latest part updates and stock changes</p>
            </div>
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-2 text-cyan-300">
              <FiCpu size={18} />
            </div>
          </div>
          <div className="space-y-3">
            {(overview?.recentProducts || []).map((product) => (
              <div key={product.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                <div>
                  <p className="font-medium text-white">{product.name}</p>
                  <p className="text-sm text-slate-400">SKU {product.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-cyan-300">{product.stock} units</p>
                  <p className="text-xs text-slate-400">{product.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Shop summary</h2>
              <p className="text-sm text-slate-400">Current sales and stock health indicators</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-2 text-slate-300">
              <FiTruck size={18} />
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between"><span className="text-slate-400">Categories</span><span className="font-semibold text-white">{overview?.overview?.totalCategories || 0}</span></div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between"><span className="text-slate-400">Suppliers</span><span className="font-semibold text-white">{overview?.overview?.totalSuppliers || 0}</span></div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between"><span className="text-slate-400">Pending orders</span><span className="font-semibold text-white">{overview?.overview?.pendingOrders || 0}</span></div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between"><span className="text-slate-400">Out of stock</span><span className="font-semibold text-white">{overview?.overview?.outOfStockProducts || 0}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
