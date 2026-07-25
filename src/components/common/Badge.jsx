const Badge = ({ children, tone = 'default' }) => {
  const classes = {
    default: 'border-white/10 bg-white/10 text-slate-300',
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    warning: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    danger: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
  };

  return <span className={`rounded-full border px-3 py-1 text-xs font-medium ${classes[tone]}`}>{children}</span>;
};

export default Badge;
