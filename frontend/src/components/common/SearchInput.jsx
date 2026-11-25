const SearchInput = ({ value, onChange, placeholder = 'Search...', ariaLabel = placeholder }) => {
  return (
    <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-300 shadow-[0_10px_35px_rgba(2,8,23,0.25)] backdrop-blur-xl">
      <span className="text-cyan-300">⌕</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full bg-transparent outline-none placeholder:text-slate-500"
      />
    </label>
  );
};

export default SearchInput;
