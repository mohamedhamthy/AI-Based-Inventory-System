import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiLock, FiMail, FiShield, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Account creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_28%),linear-gradient(135deg,_#020617,_#0b1122_60%,_#111827)] px-4 py-8">
      <section className="w-full max-w-lg rounded-[32px] border border-white/10 bg-slate-950/75 p-6 shadow-2xl backdrop-blur-xl sm:p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300"><FiShield size={22} /></div>
          <div>
            <p className="text-lg font-semibold text-white">PartsFlow</p>
            <p className="text-sm text-slate-400">Create your secure workspace</p>
          </div>
        </div>
        <h1 className="mt-8 text-3xl font-semibold text-white">Create an account</h1>
        <p className="mt-2 text-sm text-slate-400">Your account starts with a private inventory workspace.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block rounded-2xl border border-white/10 bg-slate-900/70 p-3 focus-within:border-cyan-400/40">
            <span className="mb-2 flex items-center gap-2 text-sm text-slate-400"><FiUser size={16} /> Name</span>
            <input required minLength={2} maxLength={80} autoComplete="name" value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} className="w-full bg-transparent text-white outline-none" />
          </label>
          <label className="block rounded-2xl border border-white/10 bg-slate-900/70 p-3 focus-within:border-cyan-400/40">
            <span className="mb-2 flex items-center gap-2 text-sm text-slate-400"><FiMail size={16} /> Email</span>
            <input type="email" required autoComplete="email" value={form.email} onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} className="w-full bg-transparent text-white outline-none" />
          </label>
          <label className="block rounded-2xl border border-white/10 bg-slate-900/70 p-3 focus-within:border-cyan-400/40">
            <span className="mb-2 flex items-center gap-2 text-sm text-slate-400"><FiLock size={16} /> Password</span>
            <input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))} className="w-full bg-transparent text-white outline-none" />
            <span className="mt-2 block text-xs text-slate-500">Use at least 8 characters.</span>
          </label>
          <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-400 px-4 py-3.5 font-semibold text-slate-950 transition hover:from-cyan-400 hover:to-cyan-300 disabled:opacity-70">
            {isSubmitting ? 'Creating account...' : 'Create New Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account? <Link to="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">Sign in</Link>
        </p>
      </section>
    </main>
  );
};

export default RegisterPage;
