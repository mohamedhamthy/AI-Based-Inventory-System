import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiBell,
  FiChevronDown,
  FiKey,
  FiMenu,
  FiRefreshCw,
} from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import { getLowStockAlerts } from "../../services/dashboardService";
import { hasPermission, isDemoUser } from "../../utils/permissions";
import ChangePasswordModal from "../auth/ChangePasswordModal";

const Navbar = ({ onMenuClick }) => {
  const { user } = useAuth();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [alertError, setAlertError] = useState("");
  const [alertReloadKey, setAlertReloadKey] = useState(0);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const canViewAlerts = hasPermission(user, "stock:manage");
  const canChangePassword = Boolean(user) && !isDemoUser(user);

  useEffect(() => {
    if (!canViewAlerts) return undefined;
    let isCurrent = true;
    const loadAlerts = async () => {
      try {
        setIsLoadingAlerts(true);
        const result = await getLowStockAlerts();
        if (!isCurrent) return;
        setAlerts(result.alerts || []);
        setAlertCount(result.count || 0);
        setAlertError("");
      } catch (error) {
        if (isCurrent)
          setAlertError(error.message || "Unable to load stock alerts.");
      } finally {
        if (isCurrent) setIsLoadingAlerts(false);
      }
    };
    loadAlerts();
    const timer = window.setInterval(loadAlerts, 60000);
    return () => {
      isCurrent = false;
      window.clearInterval(timer);
    };
  }, [canViewAlerts, alertReloadKey]);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target)
      ) {
        setAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  return (
    <>
      <header className="relative z-50 flex items-center justify-between rounded-[24px] border border-white/10 bg-slate-900/70 px-4 py-4 shadow-lg backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={onMenuClick}
            className="rounded-2xl border border-white/10 bg-white/10 p-2 text-slate-200 lg:hidden"
          >
            <FiMenu size={18} />
          </button>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold text-white">
              AI-Based Parts Management System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canViewAlerts ? (
            <div className="relative">
              <button
                type="button"
                aria-label={`Stock alerts: ${alertCount}`}
                aria-expanded={alertsOpen}
                onClick={() => {
                  setAlertsOpen((open) => !open);
                  setAlertReloadKey((key) => key + 1);
                }}
                className="relative rounded-2xl border border-white/10 bg-white/10 p-2 text-slate-200"
              >
                <FiBell size={18} />
                {alertCount > 0 ? (
                  <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-rose-500 px-1 text-center text-xs font-semibold text-white">
                    {alertCount > 99 ? "99+" : alertCount}
                  </span>
                ) : null}
              </button>
              {alertsOpen ? (
                <section
                  className="absolute right-0 top-12 z-50 max-h-[calc(100dvh-6rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-4 shadow-2xl"
                  aria-label="Stock alerts"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-white">Stock alerts</h2>
                      <p className="text-xs text-slate-400">
                        {alertCount} active replenishment alerts
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Refresh stock alerts"
                      disabled={isLoadingAlerts}
                      onClick={() => setAlertReloadKey((key) => key + 1)}
                      className="rounded-lg p-2 text-slate-300 hover:bg-white/10 disabled:opacity-50"
                    >
                      <FiRefreshCw
                        className={isLoadingAlerts ? "animate-spin" : ""}
                      />
                    </button>
                  </div>
                  {isLoadingAlerts && alerts.length === 0 ? (
                    <p role="status" className="py-4 text-sm text-slate-400">
                      Loading alerts...
                    </p>
                  ) : null}
                  {alertError ? (
                    <div
                      role="alert"
                      className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200"
                    >
                      {alertError}
                      <button
                        type="button"
                        onClick={() => setAlertReloadKey((key) => key + 1)}
                        className="ml-2 underline"
                      >
                        Retry
                      </button>
                    </div>
                  ) : null}
                  {!isLoadingAlerts && !alertError && alerts.length === 0 ? (
                    <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                      No low-stock or out-of-stock products.
                    </p>
                  ) : null}
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {alerts.map((alert) => (
                      <Link
                        key={alert.id}
                        to={`/inventory/${alert.id}`}
                        onClick={() => setAlertsOpen(false)}
                        className="block rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">
                              {alert.productName}
                            </p>
                            <p className="text-xs text-slate-400">
                              Part number {alert.sku}
                              {alert.category?.name
                                ? ` · ${alert.category.name}`
                                : ""}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${alert.status === "out_of_stock" ? "bg-rose-500/10 text-rose-300" : "bg-amber-500/10 text-amber-200"}`}
                          >
                            {alert.status === "out_of_stock"
                              ? "Out of stock"
                              : "Low stock"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-300">
                          Stock {alert.currentStock} · reorder threshold{" "}
                          {alert.threshold}
                        </p>
                      </Link>
                    ))}
                  </div>
                  {alertCount > alerts.length ? (
                    <p className="mt-2 text-xs text-slate-400">
                      Showing {alerts.length} of {alertCount} alerts.
                    </p>
                  ) : null}
                  <Link
                    to="/inventory"
                    onClick={() => setAlertsOpen(false)}
                    className="mt-3 inline-block text-sm text-cyan-300 hover:text-cyan-200"
                  >
                    View inventory
                  </Link>
                </section>
              ) : null}
            </div>
          ) : null}

          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              aria-label="Open account menu"
              onClick={() => setAccountMenuOpen((open) => !open)}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-left transition hover:bg-white/15"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20 font-semibold text-cyan-300">
                {user?.name?.charAt(0) || "U"}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-white">{user?.name}</p>
                <p className="text-xs text-slate-400">
                  {isDemoUser(user) ? "Demo Mode" : user?.role}
                </p>
              </div>
              <FiChevronDown
                className={`text-slate-400 transition ${accountMenuOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            {accountMenuOpen ? (
              <div
                role="menu"
                aria-label="Account menu"
                className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-2xl border border-white/10 bg-slate-950 p-2 shadow-2xl"
              >
                <div className="px-3 py-2 sm:hidden">
                  <p className="truncate text-sm font-semibold text-white">
                    {user?.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {isDemoUser(user) ? "Demo Mode" : user?.role}
                  </p>
                </div>
                {canChangePassword ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setIsChangePasswordOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white"
                  >
                    <FiKey aria-hidden="true" />
                    Change Password
                  </button>
                ) : (
                  <p className="px-3 py-2.5 text-sm text-slate-400">
                    Password changes are not available for demo accounts.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {isChangePasswordOpen ? (
        <ChangePasswordModal
          isOpen
          onClose={() => setIsChangePasswordOpen(false)}
        />
      ) : null}
    </>
  );
};

export default Navbar;
