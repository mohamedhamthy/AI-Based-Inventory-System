const EmptyState = ({ title, description, action }) => {
  return (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-slate-900/60 p-8 text-center">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
};

export default EmptyState;
