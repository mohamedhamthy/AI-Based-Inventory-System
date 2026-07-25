import { NavLink, useNavigate } from 'react-router-dom';
import { FiBox, FiLayers, FiTruck, FiUsers, FiClipboard, FiBarChart2, FiCpu, FiSettings, FiLogOut, FiHome } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { to: '/dashboard', icon: FiHome, label: 'Dashboard' },
  { to: '/inventory', icon: FiBox, label: 'Inventory' },
  { to: '/categories', icon: FiLayers, label: 'Categories' },
  { to: '/suppliers', icon: FiTruck, label: 'Suppliers' },
  { to: '/stock', icon: FiClipboard, label: 'Stock Movements' },
  { to: '/reports', icon: FiBarChart2, label: 'Reports' },
  { to: '/forecast', icon: FiCpu, label: 'AI Forecasting' },
  { to: '/users', icon: FiUsers, label: 'Users' },
  { to: '/settings', icon: FiSettings, label: 'Settings' },
];

const Sidebar = ({ onClose }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="flex h-full flex-col justify-between rounded-[28px] border border-white/10 bg-slate-950/60 p-4 shadow-2xl backdrop-blur-xl">
      <div>
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-300">PF</div>
          <div>
            <p className="text-lg font-semibold text-white">PartsFlow</p>
            <p className="text-sm text-slate-400">AI Inventory Suite</p>
          </div>
        </div>

        <nav className="space-y-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  isActive ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <button onClick={handleLogout} className="flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white">
        <FiLogOut size={18} />
        Sign Out
      </button>
    </aside>
  );
};

export default Sidebar;
