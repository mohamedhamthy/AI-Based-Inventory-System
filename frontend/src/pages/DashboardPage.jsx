import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowDownLeft,
  FiBox,
  FiClipboard,
  FiDollarSign,
  FiPackage,
  FiRefreshCw,
  FiShoppingCart,
  FiTruck,
  FiTrendingUp,
} from 'react-icons/fi';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import StatCard from '../components/common/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardOverview } from '../services/dashboardService';
import { getDemandInsights } from '../services/aiService';
import { hasPermission, isDemoUser } from '../utils/permissions';
import { formatBusinessDateTime, formatLkr } from '../utils/formatters';

const formatNumber = (value) => Number(value || 0).toLocaleString('en-LK');
const formatMoney = formatLkr;
const formatDate = formatBusinessDateTime;

const DashboardPage = () => {
  const { user } = useAuth();
  const isDemo = isDemoUser(user);
  const canReadPurchaseOrders = hasPermission(user, 'purchaseOrders:read');
  const canUseAi = hasPermission(user, 'ai:use');
  const [overview, setOverview] = useState(null);
  const [insights, setInsights] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingInsights, setIsLoadingInsights] = useState(canUseAi);
  const [loadError, setLoadError] = useState('');
  const [insightsError, setInsightsError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    getDashboardOverview()
      .then((data) => {
        if (isCurrent) {
          setOverview(data);
          setLoadError('');
        }
      })
      .catch((error) => { if (isCurrent) setLoadError(error.message || 'Unable to load dashboard data.'); })
      .finally(() => { if (isCurrent) setIsLoading(false); });
    if (canUseAi) {
      getDemandInsights()
        .then((data) => {
          if (isCurrent) {
            setInsights(data);
            setInsightsError('');
          }
        })
        .catch((error) => { if (isCurrent) setInsightsError(error.message || 'Unable to load AI purchase insights.'); })
        .finally(() => { if (isCurrent) setIsLoadingInsights(false); });
    }
    return () => {
      isCurrent = false;
    };
  }, [canUseAi, reloadKey]);

  const retryLoad = () => {
    setIsLoading(true);
    setLoadError('');
    setIsLoadingInsights(canUseAi);
    setInsightsError('');
    setReloadKey((key) => key + 1);
  };

  const stats = useMemo(() => {
    if (!overview?.overview) return [];
    const data = overview.overview;
    return [
      { title: 'Active products', value: formatNumber(data.totalProducts), detail: 'In this workspace', icon: FiBox, tone: 'default' },
      { title: 'Stock on hand', value: formatNumber(data.totalStockQuantity), detail: 'Current units', icon: FiPackage, tone: 'success' },
      { title: 'Inventory value', value: formatMoney(data.inventoryValue), detail: 'Valued at recorded purchase cost', icon: FiDollarSign, tone: 'default' },
      { title: 'Low stock', value: formatNumber(data.lowStockProducts), detail: 'At or below reorder threshold', icon: FiClipboard, tone: 'warning' },
      { title: 'Out of stock', value: formatNumber(data.outOfStockProducts), detail: 'Active products with zero stock', icon: FiArrowDownLeft, tone: 'danger' },
      { title: "Today's sales", value: formatMoney(data.todaySales), detail: `${formatNumber(data.todayTransactions)} transactions · Sri Lanka business day`, icon: FiDollarSign, tone: 'default' },
      { title: 'Monthly sales', value: formatMoney(overview.monthlySales?.[overview.monthlySales.length - 1]?.sales), detail: 'Current Asia/Colombo calendar month', icon: FiTrendingUp, tone: 'success' },
    ];
  }, [overview]);

  const purchaseRecommendations = useMemo(
    () => (insights?.items || []).filter((item) => item.currentStock <= item.minimumStock || item.recommendedPurchaseQty > 0),
    [insights],
  );

  const statusColors = { 'In Stock': '#22d3ee', 'Low Stock': '#f59e0b', 'Out of Stock': '#ef4444' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">AHS Motors · Yamaha Spare Parts · Sammanthurai</p>
        <h1 className="text-3xl font-semibold text-white">AI-Based Parts Management System</h1>
        <p className="text-slate-400">
          {isDemo
            ? 'Read-only inventory and sales information for the demo workspace.'
            : 'Current parts inventory, sales performance, and recent operational activity.'}
        </p>
      </div>

      {loadError ? (
        <div role="alert" className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-4 text-sm text-rose-200">
          {loadError}
          <button type="button" onClick={retryLoad} className="ml-3 underline">Retry</button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-[24px] border border-white/10 bg-slate-900/70" />)
          : stats.map((stat) => <StatCard key={stat.title} {...stat} />)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">Monthly sales trend</h2>
            <p className="text-sm text-slate-400">Revenue and quantities sold by Sri Lankan calendar month</p>
          </div>
          <div className="h-72">
            {isLoading ? <div className="h-full animate-pulse rounded-2xl bg-white/5" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overview?.monthlySales || []}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.75} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} tickFormatter={(value) => formatNumber(value)} />
                  <Tooltip formatter={(value) => [formatMoney(value), 'Sales']} />
                  <Area type="monotone" dataKey="sales" name="Sales" stroke="#22d3ee" fill="url(#salesFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          {!isLoading && !overview?.monthlySales?.some((month) => month.sales > 0) ? (
            <p className="mt-2 text-sm text-slate-400">No sales recorded in the last six months.</p>
          ) : null}
        </section>

        {canUseAi ? (
          <section className="rounded-[24px] border border-cyan-300/15 bg-slate-900/70 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">AI purchase recommendations</h2>
                <p className="text-sm text-slate-400">Workspace sales and inventory insights for review; no stock or orders are changed automatically.</p>
              </div>
              <Link to="/forecast" className="shrink-0 text-sm text-cyan-300 hover:text-cyan-200">Review forecasts</Link>
            </div>
            {isLoadingInsights ? <p role="status" className="text-sm text-slate-400">Analyzing available sales history…</p> : null}
            {insightsError ? <p role="alert" className="text-sm text-rose-300">{insightsError}</p> : null}
            {!isLoadingInsights && !insightsError && purchaseRecommendations.length === 0 ? (
              <p className="text-sm text-slate-400">No validated purchase recommendations are available. Recommendations require sufficient recent sales history.</p>
            ) : null}
            {!isLoadingInsights && !insightsError && purchaseRecommendations.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {purchaseRecommendations.slice(0, 3).map((item) => (
                  <Link key={item.id} to={`/inventory/${item.id}`} className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-cyan-300/30">
                    <p className="font-medium text-white">{item.productName}</p>
                    <p className="mt-1 text-xs text-slate-400">Part number: {item.sku || 'Not recorded'}{item.oemPartNumber ? ` · OEM: ${item.oemPartNumber}` : ''}</p>
                    <p className="mt-3 text-sm text-cyan-200">
                      {item.purchaseRecommendation?.action || 'Review'}
                      {item.recommendedPurchaseQty > 0 ? ` · ${formatNumber(item.recommendedPurchaseQty)} net units` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{item.currentStock} on hand · {item.outstandingQuantity} on order</p>
                    {item.forecast?.confidence !== undefined ? <p className="mt-2 text-xs text-slate-500">Quality score {item.forecast.confidence}/100, not a probability</p> : null}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">Inventory health</h2>
            <p className="text-sm text-slate-400">Active products by current reorder status</p>
          </div>
          <div className="h-72">
            {isLoading ? <div className="h-full animate-pulse rounded-2xl bg-white/5" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={overview?.statusDistribution || []} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={3}>
                    {(overview?.statusDistribution || []).map((entry) => <Cell key={entry.name} fill={statusColors[entry.name] || '#64748b'} />)}
                  </Pie>
                  <Tooltip formatter={(value, name) => [formatNumber(value), name]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {!isLoading ? (
            <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-300">
              {(overview?.statusDistribution || []).map((entry) => (
                <span key={entry.name} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColors[entry.name] }} />
                  {entry.name}: {formatNumber(entry.value)}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent sales</h2>
              <p className="text-sm text-slate-400">Latest sales visible to your role</p>
            </div>
            <FiShoppingCart className="text-cyan-300" size={18} />
          </div>
          {isLoading ? <p role="status" className="py-5 text-sm text-slate-400">Loading sales...</p> : (
            <div className="space-y-2">
              {(overview?.recentSales || []).map((sale) => (
                <div key={sale._id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{sale.product?.productName || 'Product unavailable'}</p>
                    <p className="text-xs text-slate-400">{formatDate(sale.saleDate)} · {sale.quantity} units · {sale.paymentStatus}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-cyan-200">{formatMoney(sale.totalAmount)}</p>
                </div>
              ))}
              {overview?.recentSales?.length === 0 ? <p className="py-4 text-sm text-slate-400">No sales have been recorded.</p> : null}
            </div>
          )}
          <Link to="/sales" className="mt-4 inline-block text-sm text-cyan-300 hover:text-cyan-200">View sales</Link>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Recent stock movements</h2>
              <p className="text-sm text-slate-400">Stock-In, sales, and adjustment ledger activity</p>
            </div>
            <FiRefreshCw className="text-cyan-300" size={18} />
          </div>
          {isLoading ? <p role="status" className="py-5 text-sm text-slate-400">Loading stock activity...</p> : (
            <div className="space-y-2">
              {(overview?.recentMovements || []).map((movement) => (
                <div key={movement._id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{movement.product?.productName || 'Product unavailable'}</p>
                    <p className="text-xs capitalize text-slate-400">{movement.movementType?.replace('_', ' ')} · {formatDate(movement.createdAt)}</p>
                  </div>
                  <p className="shrink-0 text-sm text-cyan-200">{movement.quantity} units</p>
                </div>
              ))}
              {overview?.recentMovements?.length === 0 ? <p className="py-4 text-sm text-slate-400">No stock movements have been recorded.</p> : null}
            </div>
          )}
          <Link to="/stock" className="mt-4 inline-block text-sm text-cyan-300 hover:text-cyan-200">View movement history</Link>
        </section>
      </div>

      <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
        <div className="mb-4 flex items-center gap-2">
          <FiTruck className="text-cyan-300" size={18} />
          <h2 className="text-lg font-semibold text-white">Workspace summary</h2>
        </div>
        <div className={`grid gap-3 sm:grid-cols-2 ${canReadPurchaseOrders ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">Active categories</p>
            <p className="mt-1 text-xl font-semibold text-white">{formatNumber(overview?.overview?.totalCategories)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">Active suppliers</p>
            <p className="mt-1 text-xl font-semibold text-white">{formatNumber(overview?.overview?.totalSuppliers)}</p>
          </div>
          {canReadPurchaseOrders ? (
            <>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-400">Pending purchase orders</p>
                <p className="mt-1 text-xl font-semibold text-white">{formatNumber(overview?.overview?.pendingOrders)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-400">Latest order activity</p>
                {overview?.recentPurchaseOrders?.[0] ? (
                  <Link to="/purchase-orders" className="mt-1 block truncate text-sm font-semibold text-cyan-200">
                    {overview.recentPurchaseOrders[0].poNumber} · {overview.recentPurchaseOrders[0].status.replace('_', ' ')}
                  </Link>
                ) : <p className="mt-1 text-sm text-slate-400">No purchase orders yet.</p>}
              </div>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
