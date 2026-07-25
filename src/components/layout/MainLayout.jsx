import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-transparent p-3 text-slate-100 sm:p-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row">
        <div className={`${sidebarOpen ? 'block' : 'hidden'} lg:block lg:w-72`}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        <div className="flex-1">
          <Navbar onMenuClick={() => setSidebarOpen((prev) => !prev)} />
          <main className="mt-4 rounded-[28px] border border-white/10 bg-slate-950/60 p-4 shadow-2xl backdrop-blur-xl sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
