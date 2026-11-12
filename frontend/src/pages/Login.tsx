import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { Sparkles, TrendingUp } from 'lucide-react';
import { getAuthConfig, login } from '../api';
import { useAuth } from '../auth/AuthContext';
import type { ApiError } from '../types';

export function Login() {
  const navigate = useNavigate();
  const { applyAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    getAuthConfig()
      .then((cfg) => setDemoMode(cfg.demoMode))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await login(email, password);
      applyAuth(response);
      navigate('/insiders');
    } catch (err) {
      const axiosErr = err as AxiosError<ApiError>;
      setError(axiosErr.response?.data?.message ?? 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 shadow-md shadow-brand-700/40"><TrendingUp className="w-5 h-5 text-white" /></span>
          <span className="text-2xl font-bold text-ink-100 tracking-tight">
            Insider<span className="text-brand-400">Flow</span>
          </span>
        </div>
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-ink-800 bg-ink-900/50 p-6 space-y-4"
        >
          <h1 className="text-lg font-semibold text-ink-100">Sign in</h1>
          {demoMode && (
            <div className="flex items-start gap-2 rounded-md bg-brand-500/10 ring-1 ring-brand-500/30 px-3 py-2 text-sm text-brand-300">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Demo mode — sign in with <strong>any email and any password</strong> to explore.</span>
            </div>
          )}
          {error && (
            <div className="rounded-md bg-down-500/10 ring-1 ring-down-500/30 px-3 py-2 text-sm text-down-400">
              {error}
            </div>
          )}
          <label className="block">
            <span className="text-sm text-ink-400">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md bg-ink-950 border border-ink-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="text-sm text-ink-400">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md bg-ink-950 border border-ink-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              placeholder="••••••••"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-3 py-2 text-sm font-semibold text-white transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-sm text-ink-500 text-center">
            No account?{' '}
            <Link to="/register" className="text-brand-400 hover:underline">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
