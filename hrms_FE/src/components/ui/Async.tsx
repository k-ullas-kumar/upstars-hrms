import type { ReactNode } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { getErrorMessage, isForbidden } from '../../lib/api';
import type { ApiState } from '../../lib/useApi';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { PageSpinner } from './Spinner';

export function ForbiddenState({ message }: { message?: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="Permission denied"
      description={message ?? "You don't have access to this. Contact your administrator if you think this is a mistake."}
    />
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (isForbidden(error)) return <ForbiddenState />;
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Couldn't load this data"
      description={getErrorMessage(error)}
      action={
        onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}

interface AsyncProps<T> {
  state: ApiState<T>;
  children: (data: T) => ReactNode;
  loadingLabel?: string;
}

/** Renders loading / error / permission-denied states, then `children(data)` once loaded. */
export function Async<T>({ state, children, loadingLabel }: AsyncProps<T>) {
  if (state.error && state.data === undefined) {
    return <ErrorState error={state.error} onRetry={state.reload} />;
  }
  if (state.loading && state.data === undefined) return <PageSpinner label={loadingLabel} />;
  if (state.data === undefined) return null;
  return <>{children(state.data)}</>;
}
