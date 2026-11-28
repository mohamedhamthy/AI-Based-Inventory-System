import { useCallback, useEffect, useRef, useState } from "react";
import { FiShield, FiUserCheck, FiUsers, FiUserX } from "react-icons/fi";
import { toast } from "react-toastify";
import EmptyState from "../components/common/EmptyState";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import PageHeader from "../components/common/PageHeader";
import Pagination from "../components/common/Pagination";
import SearchInput from "../components/common/SearchInput";
import StatCard from "../components/common/StatCard";
import { useAuth } from "../contexts/AuthContext";
import { createUser, getUsers, updateUser } from "../services/userService";
import { formatBusinessDateTime } from "../utils/formatters";

const roles = [
  "super_admin",
  "admin",
  "manager",
  "store_keeper",
  "employee",
  "viewer",
];
const initialCreateForm = {
  name: "",
  email: "",
  password: "",
  role: "employee",
};
const roleLabel = (role) => role.replaceAll("_", " ");
const formatLastLogin = (lastLogin) =>
  lastLogin ? formatBusinessDateTime(lastLogin) : "Never signed in";

const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
  });
  const [pagination, setPagination] = useState({
    totalPages: 1,
    totalItems: 0,
  });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pendingUserId, setPendingUserId] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const searchTimer = useRef(null);

  useEffect(() => {
    let isCurrent = true;

    const loadUsers = async () => {
      try {
        const data = await getUsers({
          page,
          limit: 10,
          search: searchQuery,
          role: roleFilter,
          status: statusFilter,
        });
        if (!isCurrent) return;
        setUsers(data.users);
        setSummary(data.summary);
        setPagination(data.pagination);
      } catch (error) {
        if (isCurrent) toast.error(error.message || "Unable to load users.");
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    loadUsers();
    return () => {
      isCurrent = false;
    };
  }, [page, refreshKey, roleFilter, searchQuery, statusFilter]);

  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  const handleSearch = useCallback((value) => {
    setSearch(value);
    setIsLoading(true);
    setPage(1);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => setSearchQuery(value), 250);
  }, []);

  const handleFilterChange = useCallback((setFilter, value) => {
    setIsLoading(true);
    setPage(1);
    setFilter(value);
  }, []);

  const saveUserChanges = useCallback(async (targetUser, changes) => {
    setPendingUserId(targetUser._id);
    try {
      const updatedUser = await updateUser(targetUser._id, changes);
      setUsers((currentUsers) =>
        currentUsers.map((item) =>
          item._id === updatedUser._id ? updatedUser : item,
        ),
      );
      if (changes.isActive !== undefined) {
        setSummary((current) => ({
          ...current,
          activeUsers: current.activeUsers + (updatedUser.isActive ? 1 : -1),
          inactiveUsers:
            current.inactiveUsers + (updatedUser.isActive ? -1 : 1),
        }));
      }
      setIsLoading(true);
      setRefreshKey((current) => current + 1);
      toast.success(`${updatedUser.name}'s account was updated.`);
    } catch (error) {
      toast.error(error.message || "Unable to update this account.");
    } finally {
      setPendingUserId("");
    }
  }, []);

  const handleCreateUser = async (event) => {
    event.preventDefault();
    if (isCreating) return;
    setIsCreating(true);
    setCreateError("");
    try {
      await createUser(createForm);
      setCreateForm(initialCreateForm);
      setIsCreateOpen(false);
      setIsLoading(true);
      setPage(1);
      setRefreshKey((current) => current + 1);
      toast.success("Staff account created successfully.");
    } catch (error) {
      setCreateError(error.message || "Unable to create this staff account.");
    } finally {
      setIsCreating(false);
    }
  };

  const statCards = [
    {
      title: "Visible accounts",
      value: summary.totalUsers,
      detail: "Accounts available in this view",
      icon: FiUsers,
    },
    {
      title: "Active",
      value: summary.activeUsers,
      detail: "Can sign in to the system",
      icon: FiUserCheck,
      tone: "success",
    },
    {
      title: "Inactive",
      value: summary.inactiveUsers,
      detail: "Sign-in access is disabled",
      icon: FiUserX,
      tone: "warning",
    },
    {
      title: "Access control",
      value: isSuperAdmin ? "Full" : "Admin",
      detail: "Role changes apply globally",
      icon: FiShield,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Create staff accounts and manage account status and access roles."
        action={
          <button
            type="button"
            onClick={() => {
              setCreateError("");
              setIsCreateOpen((open) => !open);
            }}
            className="rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950"
          >
            {isCreateOpen ? "Close form" : "Create staff account"}
          </button>
        }
      />

      {isCreateOpen ? (
        <form
          onSubmit={handleCreateUser}
          className="space-y-4 rounded-[24px] border border-white/10 bg-slate-900/70 p-5"
        >
          <div>
            <h2 className="text-lg font-semibold text-white">
              New staff account
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              The account will be added to your active workspace. Share the
              initial password through a secure channel.
            </p>
          </div>
          {createError ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200"
            >
              {createError}
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Full name</span>
              <input
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
              />
            </label>
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Email</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
              />
            </label>
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Initial password</span>
              <input
                required
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
              />
            </label>
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Role</span>
              <select
                value={createForm.role}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    role: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 capitalize text-white"
              >
                {roles
                  .filter((role) => isSuperAdmin || role !== "super_admin")
                  .map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCreating ? "Creating account..." : "Create account"}
          </button>
        </form>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <section className="space-y-4 rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_12rem_12rem]">
          <SearchInput
            value={search}
            onChange={handleSearch}
            placeholder="Search by name or email"
          />
          <label className="sr-only" htmlFor="user-role-filter">
            Filter by role
          </label>
          <select
            id="user-role-filter"
            value={roleFilter}
            onChange={(event) =>
              handleFilterChange(setRoleFilter, event.target.value)
            }
            className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none"
          >
            <option value="">All roles</option>
            {roles
              .filter((role) => isSuperAdmin || role !== "super_admin")
              .map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
          </select>
          <label className="sr-only" htmlFor="user-status-filter">
            Filter by status
          </label>
          <select
            id="user-status-filter"
            value={statusFilter}
            onChange={(event) =>
              handleFilterChange(setStatusFilter, event.target.value)
            }
            className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <p className="text-sm text-slate-400">
          Showing {users.length} of {pagination.totalItems} matching accounts
        </p>

        {isLoading ? <LoadingSkeleton /> : null}
        {!isLoading && users.length === 0 ? (
          <EmptyState
            title="No users found"
            description="Try changing your search or filters."
          />
        ) : null}
        {!isLoading && users.length > 0 ? (
          <>
            <div className="space-y-3 md:hidden">
              {users.map((account) => {
                const isSelf =
                  account._id === (currentUser?._id || currentUser?.id);
                const protectedAccount =
                  isSelf || (!isSuperAdmin && account.role === "super_admin");
                const isUpdating = pendingUserId === account._id;

                return (
                  <div
                    key={account._id}
                    className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">
                        {account.name}
                      </p>
                      <p className="truncate text-sm text-slate-400">
                        {account.email}
                      </p>
                      {isSelf ? (
                        <span className="text-xs text-cyan-300">You</span>
                      ) : null}
                    </div>
                    <label className="block text-sm text-slate-300">
                      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                        Role
                      </span>
                      <select
                        aria-label={`Role for ${account.name}`}
                        value={account.role}
                        disabled={protectedAccount || isUpdating}
                        onChange={(event) =>
                          saveUserChanges(account, { role: event.target.value })
                        }
                        className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm capitalize text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {roles
                          .filter(
                            (role) => isSuperAdmin || role !== "super_admin",
                          )
                          .map((role) => (
                            <option key={role} value={role}>
                              {roleLabel(role)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <div className="text-sm text-slate-300">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Last sign-in
                      </p>
                      {formatLastLogin(account.lastLogin)}
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Status
                      </p>
                      <button
                        type="button"
                        disabled={protectedAccount || isUpdating}
                        onClick={() =>
                          saveUserChanges(account, {
                            isActive: !account.isActive,
                          })
                        }
                        className={`w-fit rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          account.isActive
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                            : "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                        }`}
                      >
                        {isUpdating
                          ? "Saving..."
                          : account.isActive
                            ? "Active"
                            : "Inactive"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto rounded-2xl border border-white/10 md:block">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr] gap-4 border-b border-white/10 bg-slate-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <span>Account</span>
                  <span>Role</span>
                  <span>Last sign-in</span>
                  <span>Status</span>
                </div>
                <div className="divide-y divide-white/10">
                  {users.map((account) => {
                    const isSelf =
                      account._id === (currentUser?._id || currentUser?.id);
                    const protectedAccount =
                      isSelf ||
                      (!isSuperAdmin && account.role === "super_admin");
                    const isUpdating = pendingUserId === account._id;

                    return (
                      <div
                        key={account._id}
                        className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr] items-center gap-4 px-4 py-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">
                            {account.name}
                          </p>
                          <p className="truncate text-sm text-slate-400">
                            {account.email}
                          </p>
                          {isSelf ? (
                            <span className="text-xs text-cyan-300">You</span>
                          ) : null}
                        </div>
                        <select
                          aria-label={`Role for ${account.name}`}
                          value={account.role}
                          disabled={protectedAccount || isUpdating}
                          onChange={(event) =>
                            saveUserChanges(account, {
                              role: event.target.value,
                            })
                          }
                          className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm capitalize text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {roles
                            .filter(
                              (role) => isSuperAdmin || role !== "super_admin",
                            )
                            .map((role) => (
                              <option key={role} value={role}>
                                {roleLabel(role)}
                              </option>
                            ))}
                        </select>
                        <span className="text-sm text-slate-300">
                          {formatLastLogin(account.lastLogin)}
                        </span>
                        <button
                          type="button"
                          disabled={protectedAccount || isUpdating}
                          onClick={() =>
                            saveUserChanges(account, {
                              isActive: !account.isActive,
                            })
                          }
                          className={`w-fit rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            account.isActive
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                              : "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                          }`}
                        >
                          {isUpdating
                            ? "Saving..."
                            : account.isActive
                              ? "Active"
                              : "Inactive"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : null}

        <Pagination
          currentPage={page}
          totalPages={Math.max(1, pagination.totalPages)}
          onPageChange={(nextPage) => {
            setIsLoading(true);
            setPage(nextPage);
          }}
        />
      </section>
    </div>
  );
};

export default UsersPage;
