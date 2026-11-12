import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { Check, TrendingUp, X } from 'lucide-react';
import { register } from '../api';
import { useAuth } from '../auth/AuthContext';
import type { ApiError } from '../types';

const PASSWORD_REGEX = /^(?=.*[0-9])(?=.*[A-Z]).{8,}$/;

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2 text-xs ${ok ? 'text-up-400' : 'text-ink-500'}`}>
      {ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      {label}
    </li>
  );
}

export function Register() {
  const navigate = useNavigate();
  const { applyAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const rules = useMemo(
    () => ({
      length: password.length >= 8,
      number: /[0-9]/.test(password),
      uppercase: /[A-Z]/.test(password),
      match: password.length > 0 && password === confirm,
    }),
    [password, confirm],
  );

  const valid = PASSWORD_REGEX.test(password) && rules.match;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError('Fix the password requirements below first.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await register(email, username, password);
      applyAuth(response);
      navigate('/insiders');
    } catch (err) {
      const axiosErr = err as AxiosError<ApiError>;
      const data = axiosErr.response?.data;
      const fieldError = data?.fieldErrors ? Object.values(data.fieldErrors)[0] : undefined;
      setError(fieldError ?? data?.message ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded-md bg-ink-950 border border-ink-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500';

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
          <h1 className="text-lg font-semibold text-ink-100">Create account</h1>
          {error && (
            <div className="rounded-md bg-down-500/10 ring-1 ring-down-500/30 px-3 py-2 text-sm text-down-400">
              {error}
            </div>
          )}
          <label className="block">
            <span className="text-sm text-ink-400">Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" />
          </label>
          <label className="block">
            <span className="text-sm text-ink-400">Username</span>
            <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} placeholder="trader42" />
          </label>
          <label className="block">
            <span className="text-sm text-ink-400">Password</span>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
          </label>
          <label className="block">
            <span className="text-sm text-ink-400">Confirm password</span>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} placeholder="••••••••" />
          </label>
          <ul className="space-y-1">
            <Rule ok={rules.length} label="At least 8 characters" />
            <Rule ok={rules.number} label="At least 1 number" />
            <Rule ok={rules.uppercase} label="At least 1 uppercase letter" />
            <Rule ok={rules.match} label="Passwords match" />
          </ul>
          <button
            type="submit"
            disabled={loading || !valid}
            className="w-full rounded-md bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-3 py-2 text-sm font-semibold text-white transition-colors"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
          <p className="text-sm text-ink-500 text-center">
            Already registered?{' '}
            <Link to="/login" className="text-brand-400 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
