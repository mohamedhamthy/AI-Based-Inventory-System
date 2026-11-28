import { useEffect, useMemo, useState } from "react";
import { FiPlusCircle } from "react-icons/fi";
import { toast } from "react-toastify";
import PageHeader from "../components/common/PageHeader";
import SearchInput from "../components/common/SearchInput";
import Pagination from "../components/common/Pagination";
import LoadingSkeleton from "../components/common/LoadingSkeleton";
import EmptyState from "../components/common/EmptyState";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../services/supplierService";
import { useAuth } from "../contexts/AuthContext";
import { hasPermission, isDemoUser } from "../utils/permissions";

const SuppliersPage = () => {
  const { user } = useAuth();
  const canManageCatalog = hasPermission(user, "catalog:manage");
  const isDemo = isDemoUser(user);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    supplierCode: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    paymentTerms: "",
    leadTimeDays: "7",
    status: "active",
  });
  const [editingId, setEditingId] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: "",
      supplierCode: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      paymentTerms: "",
      leadTimeDays: "7",
      status: "active",
    });
  };

  useEffect(() => {
    let active = true;
    getSuppliers()
      .then((suppliers) => {
        if (active) {
          setItems(suppliers);
          setLoadError("");
        }
      })
      .catch((error) => {
        if (active) {
          const message = error.message || "Unable to load suppliers";
          setLoadError(message);
          toast.error(message);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadAttempt]);

  const retryLoad = () => {
    setIsLoading(true);
    setLoadError("");
    setLoadAttempt((attempt) => attempt + 1);
  };

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return items.filter((item) =>
      [item.name, item.supplierCode, item.contactPerson, item.email]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [items, search]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (editingId) {
        const updated = await updateSupplier(editingId, form);
        setItems((prev) =>
          prev.map((item) => (item.id === editingId ? updated : item)),
        );
        toast.success("Supplier updated");
      } else {
        const created = await createSupplier(form);
        setItems((prev) => [created, ...prev]);
        toast.success("Supplier created");
      }
      setLoadError("");
      setForm({
        name: "",
        supplierCode: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        paymentTerms: "",
        leadTimeDays: "7",
        status: "active",
      });
      setEditingId(null);
    } catch (error) {
      toast.error(error.message || "Unable to save supplier");
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      supplierCode: item.supplierCode || "",
      contactPerson: item.contactPerson || "",
      email: item.email || "",
      phone: item.phone || "",
      address: item.address || "",
      paymentTerms: item.paymentTerms || "",
      leadTimeDays: String(item.leadTimeDays ?? 7),
      status: item.status || "active",
    });
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    try {
      await deleteSupplier(item.id);
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      setLoadError("");
      toast.success("Supplier removed");
    } catch (error) {
      toast.error(error.message || "Unable to delete supplier");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Manage supplier contacts and source information for spare-parts procurement."
        action={
          canManageCatalog && (
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950"
            >
              <FiPlusCircle /> New Supplier
            </button>
          )
        }
      />
      <div
        className={`grid gap-6 ${!canManageCatalog ? "xl:grid-cols-1" : "xl:grid-cols-[0.95fr_1.05fr]"}`}
      >
        {canManageCatalog && (
          <form
            onSubmit={handleSubmit}
            className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5"
          >
            <h2 className="text-lg font-semibold text-white">
              {editingId ? "Edit supplier" : "Create supplier"}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-300">
                <span className="mb-2 block">Company name</span>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
                  required
                />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-2 block">Supplier code</span>
                <input
                  value={form.supplierCode}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      supplierCode: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
                  required
                />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-2 block">Contact person</span>
                <input
                  value={form.contactPerson}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      contactPerson: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
                />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-2 block">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
                />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-2 block">Phone</span>
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
                />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-2 block">Payment terms</span>
                <input
                  value={form.paymentTerms}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      paymentTerms: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
                />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-2 block">Lead time (days)</span>
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={form.leadTimeDays}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      leadTimeDays: e.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
                  required
                />
              </label>
              <label className="text-sm text-slate-300 md:col-span-2">
                <span className="mb-2 block">Address</span>
                <textarea
                  value={form.address}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, address: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
                  rows="3"
                />
              </label>
              <label className="text-sm text-slate-300">
                <span className="mb-2 block">Status</span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                className="rounded-2xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950"
              >
                {editingId ? "Update" : "Create"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-slate-300"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        )}

        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search suppliers"
          />
          {isLoading ? <LoadingSkeleton /> : null}
          {loadError ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200"
            >
              {loadError}
              <button
                type="button"
                onClick={retryLoad}
                className="ml-2 underline"
              >
                Retry
              </button>
            </div>
          ) : null}
          {!isLoading && !loadError && filtered.length === 0 ? (
            <EmptyState
              title="No suppliers yet"
              description={
                isDemo
                  ? "There are no sample suppliers to display."
                  : "Create a trusted vendor profile to accelerate procurement."
              }
            />
          ) : null}
          {!isLoading && !loadError && filtered.length > 0 ? (
            <div className="mt-4 space-y-3">
              {paged.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="text-sm text-slate-400">
                        {item.contactPerson || item.email || item.supplierCode}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.phone || "Phone not recorded"} ·{" "}
                        {item.leadTimeDays ?? 7} day lead time ·{" "}
                        {item.paymentTerms || "Payment terms not recorded"}
                      </p>
                    </div>
                    <span
                      className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs ${item.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  {canManageCatalog && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="rounded-xl border border-rose-500/20 px-3 py-2 text-sm text-rose-300"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
          {!isLoading && !loadError && filtered.length > 0 ? (
            <div className="mt-4">
              <Pagination
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(filtered.length / pageSize))}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SuppliersPage;
