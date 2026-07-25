import { useState } from 'react';
import { FiBell, FiMenu, FiSearch, FiSun, FiMoon, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';

const Navbar = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(true);

  return (
    <header className="flex items-center justify-between rounded-[24px] border border-white/10 bg-slate-900/70 px-4 py-4 shadow-lg backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="rounded-2xl border border-white/10 bg-white/10 p-2 text-slate-200 lg:hidden"><FiMenu size={18} /></button>
        <div className="hidden rounded-2xl border border-white/10 bg-white/10 px-3 py-2 sm:flex sm:items-center sm:gap-2">
          <FiSearch className="text-slate-400" />
          <input className="w-44 border-none bg-transparent text-sm text-white outline-none placeholder:text-slate-400" placeholder="Search..." />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => setDarkMode((prev) => !prev)} className="rounded-2xl border border-white/10 bg-white/10 p-2 text-slate-200">{darkMode ? <FiMoon size={18} /> : <FiSun size={18} />}</button>
        <button className="relative rounded-2xl border border-white/10 bg-white/10 p-2 text-slate-200"><FiBell size={18} /><span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-cyan-400" /></button>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20 font-semibold text-cyan-300">{user?.name?.charAt(0) || 'U'}</div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-white">{user?.name}</p>
            <p className="text-xs text-slate-400">{user?.role}</p>
          </div>
        </div>
        <button onClick={() => logout()} className="rounded-2xl border border-white/10 bg-white/10 p-2 text-slate-200"><FiLogOut size={18} /></button>
      </div>
    </header>
  );
};

export default Navbar;
