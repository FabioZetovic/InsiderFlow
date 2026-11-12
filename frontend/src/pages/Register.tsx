import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { Logo } from "../components/Logo";
import { register } from '../api';
import { useAuth } from '../auth/AuthContext';
import type { ApiError } from '../types';

const PASSWORD_REGEX = /^(?=.*[0-9])(?=.*[A-Z]).{8,}$/;

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2 text-xs ${ok ? 'text-up-400' : 'text-ink-500'}`}>
      <span className={`h-1.5 w-1.5 rounded-full transition-colors ${ok ? "bg-up-400" : "bg-ink-600"}`} />
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
    'mt-1 w-full bg-ink-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:ring-1 focus:ring-brand-500/60';

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
          <h1 className="text-lg font-semibold text-ink-100">Create account</h1>
          {error && (
            <div className="bg-down-500/10 px-3 py-2 text-sm text-down-400">
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
            className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-3 py-2 text-sm font-semibold text-white transition-colors"
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
