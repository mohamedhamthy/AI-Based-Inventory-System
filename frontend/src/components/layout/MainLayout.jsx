import { useState } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { useAuth } from "../../contexts/AuthContext";
import { isDemoUser } from "../../utils/permissions";

const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

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
        <div
          className={`${sidebarOpen ? "fixed inset-y-2 left-2 z-50 w-[min(18rem,calc(100vw-1rem))]" : "hidden"} lg:sticky lg:top-4 lg:block lg:h-[calc(100dvh-2rem)] lg:w-64 lg:shrink-0`}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        <div className="min-w-0 flex-1">
          {isDemoUser(user) ? (
            <div
              role="status"
              className="mb-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center text-sm font-semibold tracking-wide text-amber-100 sm:mb-4"
            >
              DEMO MODE – READ ONLY
            </div>
          ) : null}
          <Navbar onMenuClick={() => setSidebarOpen((prev) => !prev)} />
          <main className="mt-3 min-w-0 rounded-2xl border border-white/10 bg-slate-950/60 p-3 shadow-2xl backdrop-blur-xl sm:mt-4 sm:rounded-3xl sm:p-5 xl:p-6">
            <Outlet />
          </main>
          <footer className="py-4 text-center text-xs text-slate-500">
            Developed by{" "}
            <a
              href="https://hamthy.dev"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 transition hover:text-cyan-200"
            >
              hamthy.dev
            </a>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
