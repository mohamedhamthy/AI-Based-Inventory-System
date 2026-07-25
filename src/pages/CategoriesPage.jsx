import { useEffect, useMemo, useState } from 'react';
import { FiPlusCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import PageHeader from '../components/common/PageHeader';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import EmptyState from '../components/common/EmptyState';
import SearchInput from '../components/common/SearchInput';
import Pagination from '../components/common/Pagination';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../services/categoryService';

const CategoriesPage = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', code: '', description: '', color: '#22d3ee' });
  const [editingId, setEditingId] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const loadData = async () => {
    setIsLoading(true);
    try {
      const categories = await getCategories();
      setItems(categories);
    } catch (error) {
      toast.error(error.message || 'Unable to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

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
      toast.success('Category removed');
    } catch (error) {
      toast.error(error.message || 'Unable to delete category');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Categories" description="Organize inventory by part family, system, or equipment type." action={<button className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950"><FiPlusCircle /> New Category</button>} />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={handleSubmit} className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
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
              {editingId ? <button type="button" onClick={() => { setEditingId(null); setForm({ name: '', code: '', description: '', color: '#22d3ee' }); }} className="rounded-2xl border border-white/10 px-4 py-2 text-slate-300">Cancel</button> : null}
            </div>
          </div>
        </form>

        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <SearchInput value={search} onChange={setSearch} placeholder="Search categories" />
          {isLoading ? <LoadingSkeleton /> : null}
          {!isLoading && filtered.length === 0 ? <EmptyState title="No categories yet" description="Create the first grouping to begin organizing inventory." /> : null}
          {!isLoading && filtered.length > 0 ? (
            <div className="mt-4 space-y-3">
              {paged.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-lg" style={{ backgroundColor: `${item.color}22`, color: item.color }}>
                      {item.icon || '📦'}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="text-sm text-slate-400">{item.code}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(item)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300">Edit</button>
                    <button onClick={() => handleDelete(item)} className="rounded-xl border border-rose-500/20 px-3 py-2 text-sm text-rose-300">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-4"><Pagination currentPage={page} totalPages={Math.max(1, Math.ceil(filtered.length / pageSize))} onPageChange={setPage} /></div>
        </div>
      </div>
    </div>
  );
};

export default CategoriesPage;
