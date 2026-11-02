import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiEyeOff, FiLock, FiMail, FiShield, FiCpu, FiBarChart2, FiPackage, FiCheckCircle, FiPlay } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, demoLogin } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(form);
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsSubmitting(true);
    try {
      await demoLogin();
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Unable to start the demo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(129,140,248,0.16),_transparent_24%),linear-gradient(135deg,_#020617,_#0b1122_60%,_#111827)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/70 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl lg:grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative overflow-hidden bg-gradient-to-br from-cyan-500/20 via-slate-900/90 to-violet-500/20 p-8 sm:p-10 lg:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.2),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.2),_transparent_30%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300 shadow-lg shadow-cyan-500/10">
                  <FiShield size={22} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">PartsFlow</p>
                  <p className="text-sm text-slate-400">AI-Based Inventory & Parts Management</p>
                </div>
              </div>

              <div className="mt-10 max-w-xl">
                <p className="text-sm font-medium uppercase tracking-[0.35em] text-cyan-300">Secure access</p>
                <h1 className="mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-[2.4rem]">
                  Monitor stock, suppliers, and operations from one intelligent workspace.
                </h1>
                <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
                  Secure role-based access, procurement visibility, and predictive readiness in a premium control center.
                </p>
              </div>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                { icon: FiPackage, label: 'Inventory' },
                { icon: FiBarChart2, label: 'Analytics' },
                { icon: FiCpu, label: 'AI Ready' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 backdrop-blur-md">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
                      <Icon size={18} />
                    </div>
                    <p className="mt-3 text-sm font-medium text-white">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center p-6 sm:p-8 lg:p-10">
          <div className="w-full">
            <div className="mb-8">
              <p className="text-sm font-medium uppercase tracking-[0.35em] text-cyan-300">Welcome back</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">Sign in to your workspace</h2>
              <p className="mt-2 text-sm text-slate-400">Use your credentials to continue managing inventory operations.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block rounded-2xl border border-white/10 bg-slate-900/70 p-3 shadow-[0_10px_35px_rgba(2,8,23,0.25)] transition focus-within:border-cyan-400/40 focus-within:ring-2 focus-within:ring-cyan-400/20">
                <span className="mb-2 flex items-center gap-2 text-sm text-slate-400"><FiMail size={16} /> Email</span>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-transparent text-base text-white outline-none placeholder:text-slate-500"
                  placeholder="you@company.com"
                />
              </label>

              <label className="block rounded-2xl border border-white/10 bg-slate-900/70 p-3 shadow-[0_10px_35px_rgba(2,8,23,0.25)] transition focus-within:border-cyan-400/40 focus-within:ring-2 focus-within:ring-cyan-400/20">
                <span className="mb-2 flex items-center gap-2 text-sm text-slate-400"><FiLock size={16} /> Password</span>
                <div className="flex items-center gap-2">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-transparent text-base text-white outline-none placeholder:text-slate-500"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white">
                    {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </label>

              <div className="flex items-center justify-between text-sm text-slate-400">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-white/20 bg-transparent accent-cyan-500" />
                  <span>Remember me</span>
                </label>
                <a href="#" className="text-cyan-300 transition hover:text-cyan-200">Forgot password?</a>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-400 px-4 py-3.5 font-semibold text-slate-950 transition duration-200 hover:from-cyan-400 hover:to-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <FiCheckCircle size={18} />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>

            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isSubmitting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-400/40 bg-violet-500/10 px-4 py-3.5 font-semibold text-violet-200 transition hover:border-violet-300/70 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <FiPlay size={18} />
              <span>{isSubmitting ? 'Preparing demo...' : '🎮 Explore Demo Account'}</span>
            </button>

            <p className="mt-6 text-center text-sm text-slate-400">
              New to PartsFlow?{' '}
              <Link to="/register" className="font-semibold text-cyan-300 transition hover:text-cyan-200">Create New Account</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
