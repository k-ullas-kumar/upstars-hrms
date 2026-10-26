import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ForbiddenState } from '../ui/Async';
import { PageSpinner } from '../ui/Spinner';

/** Redirects unauthenticated users to /login, preserving the intended destination. */
export function ProtectedRoute() {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="flex h-full items-center justify-center">
        <PageSpinner label="Loading your workspace…" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

interface PermissionRouteProps {
  /** User must have ANY of these permission keys. */
  anyOf?: readonly string[];
  /** Restricts to administrators regardless of permission list. */
  adminOnly?: boolean;
  children: ReactNode;
}

/** Shows a permission-denied state when the user lacks the required access. */
export function PermissionRoute({ anyOf, adminOnly, children }: PermissionRouteProps) {
  const { hasAnyPermission, isAdmin } = useAuth();
  const allowed = (!adminOnly || isAdmin) && (!anyOf || hasAnyPermission(anyOf));
  if (!allowed) {
    return (
      <div className="card">
        <ForbiddenState />
      </div>
    );
  }
  return <>{children}</>;
}
