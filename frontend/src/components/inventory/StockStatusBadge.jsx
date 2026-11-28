const StockStatusBadge = ({ status }) => {
  const styles = {
    "In Stock": "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    "Low Stock": "border-amber-500/30 bg-amber-500/10 text-amber-300",
    "Out of Stock": "border-rose-500/30 bg-rose-500/10 text-rose-300",
    Inactive: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${styles[status] || styles.Inactive}`}
    >
      {status}
    </span>
  );
};

export default StockStatusBadge;
