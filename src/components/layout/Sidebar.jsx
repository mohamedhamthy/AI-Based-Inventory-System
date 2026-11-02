import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { FiBox, FiLayers, FiTruck, FiUsers, FiClipboard, FiBarChart2, FiCpu, FiSettings, FiLogOut, FiHome, FiPlus } from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/useWorkspace';

const navItems = [
  { to: '/dashboard', icon: FiHome, label: 'Dashboard' },
  { to: '/inventory', icon: FiBox, label: 'Parts' },
  { to: '/categories', icon: FiLayers, label: 'Categories' },
  { to: '/suppliers', icon: FiTruck, label: 'Suppliers' },
  { to: '/stock', icon: FiClipboard, label: 'Stock Moves' },
  { to: '/sales', icon: FiBox, label: 'Sales' },
  { to: '/reports', icon: FiBarChart2, label: 'Reports' },
  { to: '/forecast', icon: FiCpu, label: 'AI Forecasting' },
  { to: '/users', icon: FiUsers, label: 'Users' },
  { to: '/settings', icon: FiSettings, label: 'Settings' },
];

const Sidebar = ({ onClose }) => {
  const { logout, user } = useAuth();
  const { workspaces, activeWorkspace, selectWorkspace, createWorkspace } = useWorkspace();
  const isDemo = user?.role === 'demo';
  const visibleNavItems = isDemo ? navItems.filter(({ label }) => !['Users', 'Settings'].includes(label)) : navItems;
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCreateWorkspace = async (event) => {
    event.preventDefault();
    setIsCreating(true);
    try {
      await createWorkspace(workspaceName);
    } catch (error) {
      toast.error(error.message);
      setIsCreating(false);
    }
  };

  return (
    <>
      <aside className="flex h-full max-h-full flex-col justify-between overflow-y-auto rounded-[28px] border border-white/10 bg-slate-950/60 p-4 shadow-2xl backdrop-blur-xl">
        <div>
          <div className="mb-5 flex items-center gap-3 px-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-300">PF</div>
            <div>
              <p className="text-lg font-semibold text-white">PartsFlow</p>
              <p className="text-sm text-slate-400">AI Inventory Suite</p>
            </div>
          </div>

          <section aria-label="Workspace" className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <label htmlFor="active-workspace" className="mb-2 block px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </label>
            {isDemo ? (
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2.5 text-sm text-amber-100">{activeWorkspace?.name || 'Demo Inventory'} · Read only</div>
            ) : (
              <>
                <select
                  id="active-workspace"
                  aria-label="Switch workspace"
                  value={activeWorkspace?._id || ''}
                  onChange={(event) => selectWorkspace(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace._id} value={workspace._id}>{workspace.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-400/40 px-3 py-2 text-sm font-medium text-cyan-300 transition hover:border-cyan-300 hover:bg-cyan-400/10"
                >
                  <FiPlus size={16} />
                  Create workspace
                </button>
              </>
            )}
          </section>

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

      {isCreateOpen && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isCreating) setIsCreateOpen(false);
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="create-workspace-title" className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h2 id="create-workspace-title" className="text-xl font-semibold text-white">Create a workspace</h2>
            <p className="mt-2 text-sm text-slate-400">Start a separate inventory with its own parts, suppliers, and reports.</p>
            <form onSubmit={handleCreateWorkspace} className="mt-6 space-y-4">
              <div>
                <label htmlFor="workspace-name" className="mb-2 block text-sm font-medium text-slate-200">Workspace name</label>
                <input
                  id="workspace-name"
                  name="workspaceName"
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  autoFocus
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  placeholder="e.g. Downtown store"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" disabled={isCreating} onClick={() => setIsCreateOpen(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={isCreating || workspaceName.trim().length < 2} className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">
                  {isCreating ? 'Creating...' : 'Create workspace'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
};

export default Sidebar;
