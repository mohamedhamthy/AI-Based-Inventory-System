import { FiCpu, FiBarChart2, FiLayers, FiAlertTriangle, FiPackage, FiTrendingUp } from 'react-icons/fi';
import PageHeader from '../components/common/PageHeader';

const pillars = [
  { title: 'Demand prediction', description: 'Forecast expected demand for critical parts and assemblies.', icon: FiTrendingUp },
  { title: 'Reorder recommendations', description: 'Suggest safe reorder points based on historical demand patterns.', icon: FiPackage },
  { title: 'Stock-out risk', description: 'Highlight risk areas before shortages impact operations.', icon: FiAlertTriangle },
  { title: 'Seasonal trend detection', description: 'Reveal recurring peaks and seasonal variability.', icon: FiBarChart2 },
];

const ForecastPage = () => {
  return (
    <div className="space-y-6">
      <PageHeader title="AI Forecasting" description="A premium placeholder for the future forecasting module that will be connected in the next phase." />

      <div className="rounded-[32px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/15 via-slate-900/70 to-violet-500/15 p-8 shadow-2xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-300">
              <FiCpu /> Forecasting module placeholder
            </div>
            <h2 className="mt-5 text-3xl font-semibold text-white">AI Demand Forecasting</h2>
            <p className="mt-3 text-lg text-slate-300">This experience is intentionally prepared for a future machine-learning or Python-based forecasting API. The interface is production-ready while the predictive engine remains pending.</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5">
            <p className="text-sm text-slate-400">Data readiness</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div><p className="text-2xl font-semibold text-white">20</p><p className="text-sm text-slate-400">Products</p></div>
              <div><p className="text-2xl font-semibold text-white">120+</p><p className="text-sm text-slate-400">Movements</p></div>
              <div><p className="text-2xl font-semibold text-white">6 mo</p><p className="text-sm text-slate-400">Coverage</p></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Forecast workspace</h3>
              <p className="text-sm text-slate-400">The final model will plug into this layout without a redesign.</p>
            </div>
            <button disabled className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-500">Generate Forecast</button>
          </div>
          <div className="mt-6 rounded-[24px] border border-dashed border-white/10 bg-slate-950/60 p-6 text-center">
            <FiCpu className="mx-auto text-cyan-300" size={28} />
            <p className="mt-4 font-medium text-white">AI forecasting module will be integrated in the final phase.</p>
            <p className="mt-2 text-sm text-slate-400">No fake predictions will be displayed as real output.</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-6">
          <h3 className="text-lg font-semibold text-white">Planned capabilities</h3>
          <div className="mt-4 grid gap-3">
            {pillars.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-cyan-500/10 p-2 text-cyan-300"><Icon size={18} /></div>
                    <div>
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-400">{item.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForecastPage;
