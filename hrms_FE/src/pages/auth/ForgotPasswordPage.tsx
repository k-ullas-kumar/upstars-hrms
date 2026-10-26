import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, MailCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { api, ApiError, getErrorMessage } from '../../lib/api';
import { AuthShell } from './AuthShell';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEmailError('Enter a valid email address');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() }, { skipAuthRedirect: true });
      setSent(true);
    } catch (err) {
      // Do not reveal whether the address exists: only surface transport/server failures.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429) setSent(true);
      else setError(getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const backLink = (
    <Link to="/login" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back to sign in
    </Link>
  );

  if (sent) {
    return (
      <AuthShell title="Check your inbox" footer={backLink}>
        <div className="flex flex-col items-center text-center">
          <span className="mb-3 rounded-full bg-brand-50 p-3 text-brand-600">
            <MailCheck className="h-7 w-7" aria-hidden />
          </span>
          <p className="text-sm text-slate-600">
            If an account exists for <strong className="text-navy">{email.trim()}</strong>, we've sent instructions to
            reset your password.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your work email and we'll send you a reset link."
      footer={backLink}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}
        <Input
          label="Work email"
          type="email"
          autoFocus
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setEmailError(undefined);
          }}
          error={emailError}
        />
        <Button type="submit" loading={submitting} className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
