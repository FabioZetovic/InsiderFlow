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
      setError(axiosErr.response?.data?.message ?? 'Login failed — is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <TrendingUp className="w-7 h-7 text-emerald-400" />
          <span className="text-2xl font-bold text-zinc-100 tracking-tight">
            Insider<span className="text-emerald-400">Flow</span>
          </span>
        </div>
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 space-y-4"
        >
          <h1 className="text-lg font-semibold text-zinc-100">Sign in</h1>
          {demoMode && (
            <div className="flex items-start gap-2 rounded-md bg-emerald-500/10 ring-1 ring-emerald-500/30 px-3 py-2 text-sm text-emerald-300">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Demo mode — sign in with <strong>any email and any password</strong> to explore.</span>
            </div>
          )}
          {error && (
            <div className="rounded-md bg-red-500/10 ring-1 ring-red-500/30 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
          <label className="block">
            <span className="text-sm text-zinc-400">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              placeholder="••••••••"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-2 text-sm font-semibold text-white transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-sm text-zinc-500 text-center">
            No account?{' '}
            <Link to="/register" className="text-emerald-400 hover:underline">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
