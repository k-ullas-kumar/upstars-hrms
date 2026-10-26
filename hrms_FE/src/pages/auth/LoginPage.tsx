import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { AuthShell } from './AuthShell';

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const { user, initializing, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);

  if (!initializing && user) return <Navigate to={from} replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found: { email?: string; password?: string } = {};
    if (!email.trim()) found.email = 'Enter your email address';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) found.email = 'Enter a valid email address';
    if (!password) found.password = 'Enter your password';
    setFieldErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to sign in. Please try again.'));
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your HRMS workspace.">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {error && (
          <div
            role="alert"
            className="flex animate-scale-in items-start gap-2 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-amber-50 px-3 py-2.5 text-sm text-red-700 shadow-sm"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-wide text-navy-500">
            Work email
          </label>
          <div
            className={cn(
              'group relative flex items-center rounded-xl border bg-white transition-all duration-200',
              fieldErrors.email
                ? 'border-red-400 ring-2 ring-red-100'
                : focused === 'email'
                  ? 'border-gold-300 bg-gold-50/40 shadow-[0_0_0_4px_rgba(201,162,39,0.22)]'
                  : 'border-slate-200 hover:border-gold/50',
            )}
          >
            <span className="pointer-events-none pl-3 text-slate-400 transition-colors group-focus-within:text-gold">
              <Mail className="h-4 w-4" aria-hidden />
            </span>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              autoFocus
              placeholder="you@company.com"
              value={email}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldErrors((current) => ({ ...current, email: undefined }));
              }}
              className="w-full border-0 bg-transparent px-3 py-3 text-sm text-navy outline-none ring-0 placeholder:text-slate-400 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            />
          </div>
          {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wide text-navy-500">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-brand-700 transition-colors hover:text-gold-600"
            >
              Forgot password?
            </Link>
          </div>
          <div
            className={cn(
              'group relative flex items-center rounded-xl border bg-white transition-all duration-200',
              fieldErrors.password
                ? 'border-red-400 ring-2 ring-red-100'
                : focused === 'password'
                  ? 'border-gold-300 bg-gold-50/40 shadow-[0_0_0_4px_rgba(201,162,39,0.22)]'
                  : 'border-slate-200 hover:border-gold/50',
            )}
          >
            <span className="pointer-events-none pl-3 text-slate-400 transition-colors group-focus-within:text-gold">
              <Lock className="h-4 w-4" aria-hidden />
            </span>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: undefined }));
              }}
              className="w-full border-0 bg-transparent px-3 py-3 text-sm text-navy outline-none ring-0 placeholder:text-slate-400 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="mr-2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-navy focus-visible:outline-none focus-visible:ring-0"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {fieldErrors.password && <p className="text-xs text-red-600">{fieldErrors.password}</p>}
        </div>

        <Button
          type="submit"
          loading={submitting}
          variant="gold"
          className="h-11 w-full rounded-xl bg-gradient-to-r from-gold via-gold-400 to-gold text-navy shadow-lg shadow-gold/30 transition-all duration-200 hover:brightness-105 hover:shadow-gold/50"
        >
          {submitting ? 'Signing in…' : 'Sign in to HRMS'}
        </Button>
      </form>
    </AuthShell>
  );
}
