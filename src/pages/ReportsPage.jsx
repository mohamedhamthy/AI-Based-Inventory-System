import { useMemo } from 'react';
import { FiBarChart2, FiCheckCircle, FiClock, FiTrendingUp } from 'react-icons/fi';
import PageHeader from '../components/common/PageHeader';

const reportCards = [
  { title: 'Inventory accuracy', value: '98.4%', detail: 'Stock vs. system match', icon: FiCheckCircle, tone: 'success' },
  { title: 'Cycle count backlog', value: '12', detail: 'Items pending review', icon: FiClock, tone: 'warning' },
  { title: 'Top mover', value: 'Hydraulic Pump', detail: 'Highest movement in 30 days', icon: FiTrendingUp, tone: 'default' },
];

const ReportsPage = () => {
  const performance = useMemo(() => [
    { name: 'Mon', value: 64 },
    { name: 'Tue', value: 82 },
    { name: 'Wed', value: 74 },
    { name: 'Thu', value: 91 },
    { name: 'Fri', value: 88 },
    { name: 'Sat', value: 97 },
  ], []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales & Stock Reports"
        description="Surface operational insights for parts health, movement velocity, and sales planning decisions."
        action={<button className="rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950">Generate PDF</button>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {reportCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{card.title}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
                  <p className="mt-1 text-sm text-slate-400">{card.detail}</p>
                </div>
                <div className={`rounded-2xl p-3 ${card.tone === 'success' ? 'bg-emerald-500/10 text-emerald-300' : card.tone === 'warning' ? 'bg-amber-500/10 text-amber-300' : 'bg-cyan-500/10 text-cyan-300'}`}>
                  <Icon size={18} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Weekly throughput</h2>
              <p className="text-sm text-slate-400">Movement volume across the week</p>
            </div>
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-2 text-cyan-300"><FiBarChart2 size={18} /></div>
          </div>
          <div className="space-y-3">
            {performance.map((item) => (
              <div key={item.name}>
                <div className="mb-1 flex items-center justify-between text-sm text-slate-400">
                  <span>{item.name}</span>
                  <span>{item.value} units</span>
                </div>
                <div className="h-2 rounded-full bg-slate-950/70">
                  <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold text-white">Report highlights</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="font-medium text-white">Stock risk</p>
              <p className="mt-1 text-slate-400">3 critical Yamaha parts are below two-week coverage and should be replenished this week.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="font-medium text-white">Supplier performance</p>
              <p className="mt-1 text-slate-400">AutoCore Ltd and Motion Supply are maintaining the strongest lead-time consistency.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <p className="font-medium text-white">Sales readiness</p>
              <p className="mt-1 text-slate-400">Demand patterns suggest a moderate increase in brake and engine parts next month.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
