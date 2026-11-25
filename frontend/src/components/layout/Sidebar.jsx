import { NavLink, useNavigate } from 'react-router-dom';
import { FiBox, FiLayers, FiTruck, FiUsers, FiClipboard, FiBarChart2, FiCpu, FiLogOut, FiHome, FiDollarSign, FiMessageCircle, FiFileText } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission } from '../../utils/permissions';

const navItems = [
  { to: '/dashboard', icon: FiHome, label: 'Dashboard', permission: 'dashboard:read' },
  { to: '/inventory', icon: FiBox, label: 'Parts', permission: 'products:read' },
  { to: '/categories', icon: FiLayers, label: 'Categories', permission: 'categories:read' },
  { to: '/suppliers', icon: FiTruck, label: 'Suppliers', permission: 'suppliers:read' },
  { to: '/stock', icon: FiClipboard, label: 'Stock Moves', permission: 'stock:read' },
  { to: '/sales', icon: FiBox, label: 'Sales', permission: 'sales:read' },
  { to: '/customers', icon: FiUsers, label: 'Customers', permission: 'sales:read' },
  { to: '/purchase-orders', icon: FiFileText, label: 'Purchase Orders', permission: 'purchaseOrders:read' },
  { to: '/reports', icon: FiBarChart2, label: 'Reports', permission: 'reports:read' },
  { to: '/forecast', icon: FiCpu, label: 'AI Forecasting', permission: 'forecast:read' },
  { to: '/ai-assistant', icon: FiMessageCircle, label: 'AI Assistant', permission: 'ai:use' },
  { to: '/market-prices', icon: FiDollarSign, label: 'Market Prices', permission: 'marketPrices:read' },
  { to: '/users', icon: FiUsers, label: 'Users', permission: 'users:manage' },
];

const Sidebar = ({ onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const visibleNavItems = navItems.filter((item) => hasPermission(user, item.permission));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="flex h-full max-h-full flex-col justify-between overflow-y-auto rounded-[28px] border border-white/10 bg-slate-950/60 p-4 shadow-2xl backdrop-blur-xl">
      <div>
        <div className="mb-5 px-2">
          <p className="text-sm font-semibold leading-5 text-white">AI-Based Parts Management System</p>
        </div>

        <nav className="space-y-2">
          {visibleNavItems.map(({ to, icon: Icon, label }) => (
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
