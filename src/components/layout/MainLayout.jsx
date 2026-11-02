import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useWorkspace } from '../../contexts/useWorkspace';
import { useAuth } from '../../contexts/AuthContext';

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isLoading: isWorkspaceLoading, error: workspaceError, loadWorkspaces } = useWorkspace();
  const { user } = useAuth();
  const isDemo = user?.role === 'demo';

  if (isWorkspaceLoading) {
    return <div role="status" className="grid min-h-dvh place-items-center text-sm text-slate-400">Loading your workspace...</div>;
  }

  if (workspaceError) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="max-w-md rounded-3xl border border-white/10 bg-slate-950/70 p-8">
          <h1 className="text-xl font-semibold text-white">Could not load your workspace</h1>
          <p className="mt-2 text-sm text-slate-400">{workspaceError}</p>
          <button type="button" onClick={loadWorkspaces} className="mt-5 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full bg-transparent p-2 text-slate-100 sm:p-3 xl:p-4">
      <div className="flex w-full gap-3 xl:gap-4">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          />
        )}
        <div className={`${sidebarOpen ? 'fixed inset-y-2 left-2 z-50 w-[min(18rem,calc(100vw-1rem))]' : 'hidden'} lg:sticky lg:top-4 lg:block lg:h-[calc(100dvh-2rem)] lg:w-64 lg:shrink-0`}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        <div className="min-w-0 flex-1">
          <Navbar onMenuClick={() => setSidebarOpen((prev) => !prev)} />
          <main className="mt-3 min-w-0 rounded-2xl border border-white/10 bg-slate-950/60 p-3 shadow-2xl backdrop-blur-xl sm:mt-4 sm:rounded-3xl sm:p-5 xl:p-6">
            {isDemo && (
              <section role="status" aria-label="Demo account notice" className="mb-5 flex flex-col gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold tracking-wide text-amber-200">YOU ARE USING A DEMO ACCOUNT</p>
                  <p className="mt-1 text-sm text-amber-100/80">This workspace contains sample data only. Editing, account settings, and administrative features are restricted.</p>
                </div>
                <span className="w-fit rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-200">Demo Mode</span>
              </section>
            )}
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
