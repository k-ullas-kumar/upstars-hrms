import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, tokenStore, UNAUTHORIZED_EVENT } from '../lib/api';
import { asRec, isRec, str, strArr } from '../lib/normalize';
import { PERMISSIONS, type AuthUser, type LoginResponse } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  /** True while the stored token is being validated on first load. */
  initializing: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Tells the server (errors ignored), then clears the local session. */
  logout: () => Promise<void>;
  hasPermission: (key: string) => boolean;
  hasAnyPermission: (keys: readonly string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function userCan(user: AuthUser | null, key: string): boolean {
  if (!user) return false;
  return user.permissions.includes('*') || user.permissions.includes(key);
}

/** Accepts `{ user }` or a bare user, camelCase or snake_case, and guarantees array fields. */
function toAuthUser(raw: unknown): AuthUser {
  const outer = asRec(raw);
  const r = isRec(outer.user) ? outer.user : outer;
  const email = str(r, 'email') ?? '';
  return {
    id: str(r, 'id') ?? '',
    email,
    name: str(r, 'name', 'full_name') ?? email,
    roles: strArr(r, 'roles'),
    permissions: strArr(r, 'permissions'),
    employeeId: str(r, 'employee_id') ?? null,
    tenantId: str(r, 'tenant_id') ?? null,
    tenantName: str(r, 'tenant_name') ?? null,
  };
}

/** Company admins: the COMPANY_ADMIN role, wildcard access, or anyone who can manage the organisation. */
function userIsAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  return user.roles.some((role) => role.toUpperCase() === 'COMPANY_ADMIN') || userCan(user, PERMISSIONS.orgManage);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState<boolean>(() => tokenStore.get() !== null);

  useEffect(() => {
    if (!tokenStore.get()) {
      setInitializing(false);
      return;
    }
    let cancelled = false;
    api
      .get<unknown>('/auth/me')
      .then((me) => {
        if (!cancelled) setUser(toAuthUser(me));
      })
      .catch(() => {
        if (!cancelled) tokenStore.clear();
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<LoginResponse>('/auth/login', { email, password }, { skipAuthRedirect: true });
    tokenStore.set(result.token);
    setUser(toAuthUser(result.user));
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', undefined, { skipAuthRedirect: true });
    } catch {
      // Ignore: the local session is cleared regardless.
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      isAdmin: userIsAdmin(user),
      login,
      logout,
      hasPermission: (key) => userCan(user, key),
      hasAnyPermission: (keys) => keys.some((key) => userCan(user, key)),
    }),
    [user, initializing, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
