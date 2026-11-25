import { useEffect, useMemo, useState } from 'react';
import { FiPlusCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import PageHeader from '../components/common/PageHeader';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import EmptyState from '../components/common/EmptyState';
import SearchInput from '../components/common/SearchInput';
import Pagination from '../components/common/Pagination';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../services/categoryService';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission, isDemoUser } from '../utils/permissions';

const CategoriesPage = () => {
  const { user } = useAuth();
  const canManageCatalog = hasPermission(user, 'catalog:manage');
  const isDemo = isDemoUser(user);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', code: '', description: '', color: '#22d3ee' });
  const [editingId, setEditingId] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const resetForm = () => {
    setEditingId(null);
    setForm({ name: '', code: '', description: '', color: '#22d3ee' });
  };

  useEffect(() => {
    let active = true;
    getCategories()
      .then((categories) => {
        if (active) {
          setItems(categories);
          setLoadError('');
        }
      })
      .catch((error) => {
        if (active) {
          const message = error.message || 'Unable to load categories';
          setLoadError(message);
          toast.error(message);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, [loadAttempt]);

  const retryLoad = () => {
    setIsLoading(true);
    setLoadError('');
    setLoadAttempt((attempt) => attempt + 1);
  };

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return items.filter((item) => [item.name, item.code, item.description].join(' ').toLowerCase().includes(query));
  }, [items, search]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (editingId) {
        const updated = await updateCategory(editingId, form);
        setItems((prev) => prev.map((item) => (item.id === editingId ? updated : item)));
        toast.success('Category updated');
      } else {
        const created = await createCategory(form);
        setItems((prev) => [created, ...prev]);
        toast.success('Category created');
      }
      setLoadError('');
      setForm({ name: '', code: '', description: '', color: '#22d3ee' });
      setEditingId(null);
    } catch (error) {
      toast.error(error.message || 'Unable to save category');
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({ name: item.name, code: item.code, description: item.description || '', color: item.color || '#22d3ee' });
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    try {
      await deleteCategory(item.id);
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      setLoadError('');
      toast.success('Category removed');
    } catch (error) {
      toast.error(error.message || 'Unable to delete category');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Part categories" description="Organize spare parts by category to make inventory and procurement easier to navigate." action={canManageCatalog && <button type="button" onClick={resetForm} className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950"><FiPlusCircle /> New Category</button>} />
      <div className={`grid gap-6 ${!canManageCatalog ? 'xl:grid-cols-1' : 'xl:grid-cols-[0.9fr_1.1fr]'}`}>
        {canManageCatalog && <form onSubmit={handleSubmit} className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <h2 className="text-lg font-semibold text-white">{editingId ? 'Edit category' : 'Create category'}</h2>
          <div className="mt-4 space-y-4">
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Name</span>
              <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white" required />
            </label>
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Code</span>
              <input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white" required />
            </label>
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Description</span>
              <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white" rows="4" />
            </label>
            <div className="flex gap-3">
              <button type="submit" className="rounded-2xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950">{editingId ? 'Update' : 'Create'}</button>
              {editingId ? <button type="button" onClick={resetForm} className="rounded-2xl border border-white/10 px-4 py-2 text-slate-300">Cancel</button> : null}
            </div>
          </div>
        </form>}

        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search categories" />
          {isLoading ? <LoadingSkeleton /> : null}
          {loadError ? (
            <div role="alert" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
              {loadError}
              <button type="button" onClick={retryLoad} className="ml-2 underline">Retry</button>
            </div>
          ) : null}
          {!isLoading && !loadError && filtered.length === 0 ? <EmptyState title="No categories yet" description={isDemo ? 'There are no sample categories to display.' : 'Create the first grouping to begin organizing inventory.'} /> : null}
          {!isLoading && !loadError && filtered.length > 0 ? (
            <div className="mt-4 space-y-3">
              {paged.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg" style={{ backgroundColor: `${item.color}22`, color: item.color }}>
                      {item.icon || '📦'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="text-sm text-slate-400">{item.code}</p>
                    </div>
                  </div>
                  {canManageCatalog && <div className="flex flex-wrap gap-2 sm:shrink-0">
                    <button type="button" onClick={() => handleEdit(item)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300">Edit</button>
                    <button type="button" onClick={() => handleDelete(item)} className="rounded-xl border border-rose-500/20 px-3 py-2 text-sm text-rose-300">Delete</button>
                  </div>}
                </div>
              ))}
            </div>
          ) : null}
          {!isLoading && !loadError && filtered.length > 0 ? <div className="mt-4"><Pagination currentPage={page} totalPages={Math.max(1, Math.ceil(filtered.length / pageSize))} onPageChange={setPage} /></div> : null}
        </div>
      </div>
    </div>
  );
};

export default CategoriesPage;
