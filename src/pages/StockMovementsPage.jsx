import { useMemo, useState } from 'react';
import { FiArrowDownLeft, FiArrowUpRight, FiPackage, FiRefreshCw, FiTruck } from 'react-icons/fi';
import PageHeader from '../components/common/PageHeader';

const movementData = [
  { id: 1, product: 'Hydraulic Pump', type: 'In', quantity: 120, reference: 'PO-1024', supplier: 'Northwind Parts', date: '2026-07-29', location: 'Warehouse A', status: 'Completed' },
  { id: 2, product: 'Pressure Sensor', type: 'Out', quantity: 42, reference: 'SO-445', supplier: 'Assembly Line 2', date: '2026-07-28', location: 'Line 3', status: 'Pending' },
  { id: 3, product: 'Conveyor Belt', type: 'Adjustment', quantity: -8, reference: 'ADJ-221', supplier: 'Internal Audit', date: '2026-07-27', location: 'Warehouse B', status: 'Completed' },
  { id: 4, product: 'Motor Controller', type: 'In', quantity: 75, reference: 'PO-1019', supplier: 'Motion Supply', date: '2026-07-26', location: 'Warehouse A', status: 'Completed' },
  { id: 5, product: 'Filter Cartridge', type: 'Out', quantity: 18, reference: 'SO-438', supplier: 'Maintenance Team', date: '2026-07-24', location: 'Workshop', status: 'Completed' },
];

const filters = ['All', 'In', 'Out', 'Adjustment'];

const StockMovementsPage = () => {
  const [activeFilter, setActiveFilter] = useState('All');

  const filteredMovements = useMemo(() => {
    if (activeFilter === 'All') return movementData;
    return movementData.filter((entry) => entry.type === activeFilter);
  }, [activeFilter]);

  const summary = useMemo(() => {
    const totalUnits = movementData.reduce((sum, entry) => sum + Math.abs(entry.quantity), 0);
    const inbound = movementData.filter((entry) => entry.type === 'In').reduce((sum, entry) => sum + entry.quantity, 0);
    const outbound = movementData.filter((entry) => entry.type === 'Out').reduce((sum, entry) => sum + entry.quantity, 0);
    const adjustments = movementData.filter((entry) => entry.type === 'Adjustment').length;

    return { totalUnits, inbound, outbound, adjustments };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock movements"
        description="Track incoming, outgoing, and adjusted inventory entries across the warehouse network."
        action={<button className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-300">Export report</button>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Units moved</p>
              <p className="mt-2 text-2xl font-semibold text-white">{summary.totalUnits}</p>
            </div>
            <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300"><FiPackage size={18} /></div>
          </div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Inbound</p>
              <p className="mt-2 text-2xl font-semibold text-white">{summary.inbound}</p>
            </div>
            <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-300"><FiArrowDownLeft size={18} /></div>
          </div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Outbound</p>
              <p className="mt-2 text-2xl font-semibold text-white">{summary.outbound}</p>
            </div>
            <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-300"><FiArrowUpRight size={18} /></div>
          </div>
        </div>
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Adjustments</p>
              <p className="mt-2 text-2xl font-semibold text-white">{summary.adjustments}</p>
            </div>
            <div className="rounded-2xl bg-violet-500/10 p-3 text-violet-300"><FiRefreshCw size={18} /></div>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`rounded-full px-3 py-2 text-sm transition ${activeFilter === filter ? 'bg-cyan-500 text-slate-950' : 'border border-white/10 text-slate-300 hover:bg-white/10'}`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-max divide-y divide-white/10 text-left text-sm">
            <thead className="bg-slate-950/70 text-slate-400">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-900/60 text-slate-200">
              {filteredMovements.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 font-medium text-white">{entry.product}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs ${entry.type === 'In' ? 'bg-emerald-500/15 text-emerald-300' : entry.type === 'Out' ? 'bg-amber-500/15 text-amber-300' : 'bg-violet-500/15 text-violet-300'}`}>
                      {entry.type}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-semibold ${entry.quantity > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}</td>
                  <td className="px-4 py-3">{entry.reference}</td>
                  <td className="px-4 py-3">{entry.location}</td>
                  <td className="px-4 py-3">{entry.date}</td>
                  <td className="px-4 py-3">{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StockMovementsPage;
