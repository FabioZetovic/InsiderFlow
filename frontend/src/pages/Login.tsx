import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { Logo } from "../components/Logo";
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
      <div className="animate-rise w-full max-w-sm">
        <div className="mb-10 flex justify-center">
          <Logo size="lg" />
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-ink-900/70 p-8 space-y-5"
        >
          <h1 className="text-lg font-semibold text-ink-100">Sign in</h1>
          {demoMode && (
            <div className="flex items-start gap-2 bg-brand-500/10 px-3 py-2 text-sm text-brand-300">
              <span>Demo mode: sign in with <strong>any email and any password</strong> to explore.</span>
            </div>
          )}
          {error && (
            <div className="bg-down-500/10 px-3 py-2 text-sm text-down-400">
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
              className="mt-1 w-full bg-ink-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:ring-1 focus:ring-brand-500/60"
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
              className="mt-1 w-full bg-ink-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:ring-1 focus:ring-brand-500/60"
              placeholder="••••••••"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-3 py-2 text-sm font-semibold text-white transition-colors"
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
