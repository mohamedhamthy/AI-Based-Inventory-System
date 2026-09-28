import { useEffect, useMemo, useState } from 'react';
import { FiAlertTriangle, FiBarChart2, FiCpu, FiPackage, FiTarget, FiTrendingDown, FiTrendingUp } from 'react-icons/fi';
import { toast } from 'react-toastify';
import PageHeader from '../components/common/PageHeader';
import { getProducts } from '../services/productService';

const ForecastPage = () => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await getProducts({ page: 1, limit: 100 });
        setProducts(data.products || []);
      } catch (error) {
        toast.error(error.message || 'Unable to load forecasting data');
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, []);

  const insights = useMemo(() => {
    const forecastItems = products.map((product) => {
      const currentStock = Number(product.currentStock || 0);
      const minimumStock = Number(product.minimumStock || 0);
      const costPrice = Number(product.costPrice || 0);
      const sellingPrice = Number(product.sellingPrice || 0);
      const stockGap = Math.max(0, minimumStock - currentStock);

      const demandState = currentStock <= minimumStock ? 'High' : currentStock <= minimumStock * 1.5 ? 'Medium' : 'Low';
      const demandScore = demandState === 'High' ? 92 : demandState === 'Medium' ? 72 : 48;
      const forecastDemand = demandState === 'High' ? Math.max(minimumStock * 2, 6) : demandState === 'Medium' ? Math.max(minimumStock + 2, 4) : Math.max(minimumStock, 2);
      const recommendedPurchaseQty = Math.max(0, Math.ceil(forecastDemand - currentStock + minimumStock));

      const markupPercent = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice) * 100 : 0;
      const priceSignal = markupPercent >= 28 ? 'Price increase potential' : markupPercent <= 12 ? 'Price pressure' : 'Stable pricing';
      const suggestedSellingPrice = costPrice > 0 ? Math.round(costPrice * (demandState === 'High' ? 1.32 : demandState === 'Medium' ? 1.24 : 1.18)) : sellingPrice;

      const urgency = currentStock <= minimumStock ? 'Urgent reorder' : currentStock <= minimumStock * 1.5 ? 'Monitor closely' : 'Healthy';
      const optimization = demandState === 'High' && currentStock <= minimumStock ? 'Fast-moving' : currentStock > minimumStock * 2 ? 'Slow-moving' : 'Balanced';

      return {
        ...product,
        currentStock,
        minimumStock,
        demandState,
        demandScore,
        forecastDemand,
        recommendedPurchaseQty,
        priceSignal,
        suggestedSellingPrice,
        urgency,
        optimization,
        stockGap,
        markupPercent,
      };
    });

    const urgentItems = forecastItems.filter((item) => item.recommendedPurchaseQty > 0).sort((a, b) => b.recommendedPurchaseQty - a.recommendedPurchaseQty);
    const highDemandItems = forecastItems.filter((item) => item.demandState === 'High').sort((a, b) => b.demandScore - a.demandScore);
    const priceRiskItems = forecastItems.filter((item) => item.priceSignal === 'Price increase potential' || item.priceSignal === 'Price pressure');
    const avgMargin = forecastItems.length > 0 ? Math.round(forecastItems.reduce((sum, item) => sum + item.markupPercent, 0) / forecastItems.length) : 0;

    return {
      forecastItems,
      urgentItems,
      highDemandItems,
      priceRiskItems,
      avgMargin,
      totalDemandScore: Math.round(forecastItems.reduce((sum, item) => sum + item.demandScore, 0) / Math.max(forecastItems.length, 1)),
      reorderValue: forecastItems.reduce((sum, item) => sum + item.recommendedPurchaseQty, 0),
    };
  }, [products]);

  const summaryCards = [
    {
      title: 'Demand pulse',
      value: `${insights.totalDemandScore}%`,
      detail: 'AI demand confidence backed by current stock and reorder thresholds',
      icon: FiCpu,
      tone: 'cyan',
    },
    {
      title: 'Urgent reorder',
      value: `${insights.urgentItems.length}`,
      detail: 'Parts that need replenishment now',
      icon: FiPackage,
      tone: 'emerald',
    },
    {
      title: 'Price risk',
      value: `${insights.priceRiskItems.length}`,
      detail: 'Parts with pricing pressure or upside potential',
      icon: FiTrendingUp,
      tone: 'amber',
    },
    {
      title: 'Avg. margin',
      value: `${insights.avgMargin}%`,
      detail: 'Average markup across the current catalog',
      icon: FiBarChart2,
      tone: 'violet',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Forecasting & Recommendations"
        description="Demand, price, reorder, and optimization insights derived from your live Yamaha parts inventory."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-[24px] border border-white/10 bg-slate-900/70" />)
          : summaryCards.map((card) => {
              const Icon = card.icon;
              const toneClasses = {
                cyan: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
                emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
                amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
                violet: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
              }[card.tone];

              return (
                <div key={card.title} className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
                  <div className={`inline-flex rounded-2xl border p-2 ${toneClasses}`}>
                    <Icon size={18} />
                  </div>
                  <p className="mt-4 text-2xl font-semibold text-white">{card.value}</p>
                  <p className="mt-1 text-sm font-medium text-white">{card.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{card.detail}</p>
                </div>
              );
            })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="min-w-0 rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white">Forecast recommendations</h2>
              <p className="text-sm text-slate-400">Suggested purchase quantities and selling-price guidance for each part.</p>
            </div>
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300">Live analytics</div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-max divide-y divide-white/10 text-left text-sm">
              <thead className="bg-slate-950/70 text-slate-400">
                <tr>
                  <th className="px-3 py-3">Part</th>
                  <th className="px-3 py-3">Demand</th>
                  <th className="px-3 py-3">Buy Qty</th>
                  <th className="px-3 py-3">Sell At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-900/60 text-slate-200">
                {insights.forecastItems.slice(0, 8).map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 font-medium text-white">{item.productName}</td>
                    <td className="px-3 py-3">{item.demandState}</td>
                    <td className="px-3 py-3">{item.recommendedPurchaseQty}</td>
                    <td className="px-3 py-3">LKR {item.suggestedSellingPrice.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
            <div className="flex items-center gap-2 text-cyan-300">
              <FiAlertTriangle size={18} />
              <h2 className="text-lg font-semibold text-white">Low-stock decision support</h2>
            </div>
            <div className="mt-4 space-y-3">
              {insights.urgentItems.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{item.productName}</p>
                    <p className="text-sm text-cyan-300">{item.recommendedPurchaseQty} units</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">Current stock {item.currentStock} • Min {item.minimumStock}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
            <div className="flex items-center gap-2 text-emerald-300">
              <FiTarget size={18} />
              <h2 className="text-lg font-semibold text-white">Inventory optimization</h2>
            </div>
            <div className="mt-4 space-y-3">
              {insights.forecastItems.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{item.optimization}</p>
                    <p className="text-sm text-slate-400">{item.urgency}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{item.productName} • {item.currentStock} units on hand</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">AI dashboard insights</h2>
            <p className="text-sm text-slate-400">A fast executive view of demand, price, and stock-health outlook.</p>
          </div>
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-sm text-violet-300">Responsive decision center</div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex items-center gap-2 text-cyan-300">
              <FiTrendingUp size={16} />
              <p className="font-medium text-white">Demand outlook</p>
            </div>
            <p className="mt-3 text-sm text-slate-400">High-demand parts are flagged first so reorder planning stays ahead of shortages.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex items-center gap-2 text-amber-300">
              <FiTrendingDown size={16} />
              <p className="font-medium text-white">Market price view</p>
            </div>
            <p className="mt-3 text-sm text-slate-400">Pricing pressure and upside potential are surfaced so your selling price stays competitive.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex items-center gap-2 text-emerald-300">
              <FiPackage size={16} />
              <p className="font-medium text-white">Reordering logic</p>
            </div>
            <p className="mt-3 text-sm text-slate-400">The recommended purchase quantity uses stock threshold gaps and forecast demand together.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForecastPage;
