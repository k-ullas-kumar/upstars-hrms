import { useMemo, useState } from 'react';
import { ChevronDown, Info, ShieldCheck } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { titleCase } from '../../lib/format';
import { normRole } from '../../lib/normalize';
import { useApi } from '../../lib/useApi';
import type { Role } from '../../types';

/** Groups `area:action` keys by area for readable display. */
function groupPermissions(keys: string[]): [string, string[]][] {
  const groups = new Map<string, string[]>();
  keys.forEach((key) => {
    const [area = key, action = ''] = key.split(':');
    groups.set(area, [...(groups.get(area) ?? []), action || area]);
  });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function PermissionChips({ keys }: { keys: string[] }) {
  if (keys.includes('*')) {
    return <p className="text-sm text-slate-600">Full access to everything in this workspace.</p>;
  }
  if (keys.length === 0) return <p className="text-sm text-slate-500">No permissions granted.</p>;
  return (
    <div className="space-y-3">
      {groupPermissions(keys).map(([area, actions]) => (
        <div key={area} className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
          <p className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">{titleCase(area)}</p>
          <div className="flex flex-wrap gap-1.5">
            {actions.map((action) => (
              <span key={action} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
                {titleCase(action)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoleCard({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
      >
        <span className="rounded-lg bg-navy-50 p-2 text-navy-600">
          <ShieldCheck className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-navy">{titleCase(role.name)}</p>
          {role.description && <p className="truncate text-xs text-slate-500">{role.description}</p>}
        </div>
        <span className="text-xs text-slate-500">{role.permissions.length} permissions</span>
        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="animate-fade-in border-t border-slate-100 px-4 py-4">
          <PermissionChips keys={role.permissions} />
        </div>
      )}
    </div>
  );
}

export function RolesPage() {
  const { user } = useAuth();
  const state = useApi(async (signal) => (await api.list<unknown>('/roles', undefined, signal)).map(normRole), []);
  const roles = useMemo(() => [...(state.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [state.data]);

  return (
    <div className="space-y-5">
      <PageHeader title="Roles & access" description="Read-only view of what each role can do." />

      <Card title="Your access">
        <div className="mb-3 flex flex-wrap gap-2">
          {(user?.roles ?? []).map((role) => (
            <span key={role} className="rounded-full bg-navy px-2.5 py-0.5 text-xs font-medium text-white">
              {titleCase(role)}
            </span>
          ))}
          {(user?.roles ?? []).length === 0 && <span className="text-sm text-slate-500">No roles assigned.</span>}
        </div>
        <PermissionChips keys={user?.permissions ?? []} />
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-navy">All roles</h2>
        {state.loading && state.data === undefined ? (
          <PageSpinner label="Loading roles…" />
        ) : state.error && state.data === undefined ? (
          <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            The role catalogue isn't available right now, but your own access is shown above.
          </div>
        ) : (
          <div className="space-y-2">
            {roles.map((role) => (
              <RoleCard key={role.id || role.name} role={role} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
