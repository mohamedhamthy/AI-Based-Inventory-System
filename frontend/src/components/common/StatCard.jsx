const StatCard = ({ title, value, detail, icon: Icon, tone = 'default' }) => {
  const tones = {
    default: 'from-slate-700/70 to-slate-800/70 border-slate-700/70',
    success: 'from-emerald-600/40 to-emerald-500/20 border-emerald-500/30',
    warning: 'from-amber-500/40 to-amber-400/20 border-amber-500/30',
    danger: 'from-rose-600/40 to-rose-500/20 border-rose-500/30',
  };

  return (
    <div className={`rounded-[24px] border bg-gradient-to-br ${tones[tone]} p-5 shadow-[0_20px_70px_rgba(2,8,23,0.28)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_90px_rgba(2,8,23,0.35)]`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-300">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
        </div>
        <div className="rounded-xl bg-white/10 p-3 text-cyan-300">
          {Icon ? <Icon size={20} /> : null}
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-400">{detail}</p>
    </div>
  );
};

export default StatCard;
