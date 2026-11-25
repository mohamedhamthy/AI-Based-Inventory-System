import { useEffect, useState } from 'react';
import { FiUsers } from 'react-icons/fi';
import { toast } from 'react-toastify';
import EmptyState from '../components/common/EmptyState';
import PageHeader from '../components/common/PageHeader';
import SearchInput from '../components/common/SearchInput';
import { useAuth } from '../contexts/AuthContext';
import { createCustomer, getCustomers } from '../services/customerService';
import { hasPermission, isDemoUser } from '../utils/permissions';

const emptyForm = { name: '', phone: '', address: '', notes: '' };

const CustomersPage = () => {
  const { user } = useAuth();
  const canCreate = hasPermission(user, 'sales:create');
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    getCustomers({ limit: 100, search })
      .then((data) => {
        if (active) {
          setCustomers((data.customers || []).map((customer) => ({
            ...customer,
            id: customer.id || customer._id,
          })));
          setError('');
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Unable to load customers.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [reload, search]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const customer = await createCustomer(form);
      setForm(emptyForm);
      setSearch('');
      setReload((current) => current + 1);
      toast.success(`${customer.name} added to customers`);
    } catch (saveError) {
      toast.error(saveError.message || 'Unable to save customer.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Keep customer contact details in this workspace and associate them with sales invoices." />
      <div className={`grid gap-6 ${canCreate ? 'xl:grid-cols-[0.85fr_1.15fr]' : ''}`}>
        {canCreate ? (
          <form onSubmit={handleSubmit} className="h-fit rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold text-white">Add customer</h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Customer name</span>
                <input required minLength="2" maxLength="120" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white" />
              </label>
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Phone</span>
                <input maxLength="40" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white" />
              </label>
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Address</span>
                <input maxLength="300" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white" />
              </label>
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Notes</span>
                <textarea maxLength="500" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-white" rows="3" />
              </label>
              <button type="submit" disabled={isSaving || isDemoUser(user)} className="rounded-2xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60">
                {isSaving ? 'Saving…' : 'Save customer'}
              </button>
            </div>
          </form>
        ) : null}
        <section className="min-w-0 rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center gap-2 text-cyan-300">
            <FiUsers size={18} />
            <h2 className="text-lg font-semibold text-white">Workspace customers</h2>
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search customers by name, phone, or address" />
          {error ? <div role="alert" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{error}<button type="button" onClick={() => { setIsLoading(true); setReload((current) => current + 1); }} className="ml-2 underline">Retry</button></div> : null}
          {isLoading ? <p role="status" className="mt-4 text-sm text-slate-400">Loading customers…</p> : null}
          {!isLoading && !error && customers.length === 0 ? <EmptyState title="No customers found" description={isDemoUser(user) ? 'No sample customers are available in this workspace.' : 'Add customers as you record real business transactions.'} /> : null}
          {!isLoading && !error && customers.length > 0 ? (
            <div className="mt-4 space-y-3">
              {customers.map((customer) => (
                <article key={customer.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <h3 className="font-semibold text-white">{customer.name}</h3>
                  {customer.phone ? <p className="mt-1 text-sm text-slate-300">{customer.phone}</p> : null}
                  {customer.address ? <p className="mt-1 text-sm text-slate-400">{customer.address}</p> : null}
                  {customer.notes ? <p className="mt-2 text-xs text-slate-500">{customer.notes}</p> : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default CustomersPage;
