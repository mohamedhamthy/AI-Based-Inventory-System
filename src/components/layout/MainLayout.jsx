import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
