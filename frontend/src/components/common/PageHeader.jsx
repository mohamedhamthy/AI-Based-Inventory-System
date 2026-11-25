const PageHeader = ({ title, description, action }) => {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300 sm:text-sm sm:tracking-[0.35em]">AHS Motors · Yamaha Spare Parts · Sammanthurai</p>
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      </div>
      {action ? <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end">{action}</div> : null}
    </div>
  );
};

export default PageHeader;
