import { useMemo, useState } from 'react';
import { Crown, Plus, UserPlus, UsersRound } from 'lucide-react';
import { Async } from '../components/ui/Async';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { FormModal } from '../components/ui/FormModal';
import { Input, Textarea } from '../components/ui/Input';
import { Avatar } from '../components/ui/Misc';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { todayIso } from '../lib/format';
import { listAll } from '../lib/listAll';
import { normTeam } from '../lib/normalize';
import { toPayload } from '../lib/payload';
import { useApi } from '../lib/useApi';
import { required, useForm } from '../lib/useForm';
import { EMPTY_LOOKUPS, refName, useLookups, type Lookups } from '../lib/useLookups';
import { PERMISSIONS, type Team } from '../types';

function TeamFormModal({ lookups, onClose, onSaved }: { lookups: Lookups; onClose: () => void; onSaved: () => void }) {
  const form = useForm({ name: '', description: '', leadEmployeeId: '' });
  return (
    <FormModal
      open
      title="Create team"
      submitLabel="Create team"
      submitting={form.submitting}
      error={form.formError}
      onClose={onClose}
      onSubmit={() =>
        form.submit({
          validate: required(['name', 'Team name']),
          action: (values) =>
            api.post(
              '/teams',
              toPayload({ name: values.name.trim(), description: values.description.trim(), leadEmployeeId: values.leadEmployeeId }),
            ),
          success: 'Team created',
          onDone: () => {
            onSaved();
            onClose();
          },
        })
      }
    >
      <Input label="Team name" required autoFocus {...form.bind('name')} />
      <Textarea label="Description" rows={3} {...form.bind('description')} />
      <Select
        label="Team lead"
        placeholder="No lead yet"
        options={lookups.employees.map((e) => ({ value: e.id, label: e.name }))}
        {...form.bind('leadEmployeeId')}
      />
    </FormModal>
  );
}

function AddMemberModal({ team, lookups, onClose, onSaved }: { team: Team; lookups: Lookups; onClose: () => void; onSaved: () => void }) {
  const form = useForm({ employeeId: '', role: '' });
  const existing = new Set((team.members ?? []).map((member) => member.id));
  return (
    <FormModal
      open
      size="sm"
      title="Add team member"
      description={team.name}
      submitLabel="Add member"
      submitting={form.submitting}
      error={form.formError}
      onClose={onClose}
      onSubmit={() =>
        form.submit({
          validate: required(['employeeId', 'Employee']),
          action: (values) =>
            api.post(
              `/teams/${team.id}/members`,
              toPayload({ employeeId: values.employeeId, role: values.role.trim(), startDate: todayIso() }),
            ),
          success: 'Member added',
          onDone: () => {
            onSaved();
            onClose();
          },
        })
      }
    >
      <Select
        label="Employee"
        required
        placeholder="Select employee"
        options={lookups.employees.filter((e) => !existing.has(e.id)).map((e) => ({ value: e.id, label: e.name }))}
        {...form.bind('employeeId')}
      />
      <Input label="Role in team" placeholder="e.g. Designer" {...form.bind('role')} />
    </FormModal>
  );
}

function TeamDetailModal({
  teamId,
  canManage,
  lookups,
  onClose,
  onChanged,
}: {
  teamId: string;
  canManage: boolean;
  lookups: Lookups;
  onClose: () => void;
  onChanged: () => void;
}) {
  const state = useApi(async (signal) => normTeam(await api.get<unknown>(`/teams/${teamId}`, undefined, signal)), [teamId]);
  const [adding, setAdding] = useState(false);

  return (
    <Modal open size="lg" title="Team details" onClose={onClose}>
      <Async state={state}>
        {(team) => (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{team.name}</h3>
                {team.description && <p className="mt-0.5 text-sm text-slate-500">{team.description}</p>}
                <p className="mt-1 text-xs text-slate-500">Lead: {refName(team.lead, lookups.employees)}</p>
              </div>
              {canManage && (
                <Button size="sm" onClick={() => setAdding(true)}>
                  <UserPlus className="h-4 w-4" aria-hidden /> Add member
                </Button>
              )}
            </div>
            {(team.members ?? []).length === 0 ? (
              <EmptyState icon={UsersRound} title="No members yet" description="Add people to start collaborating." />
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {(team.members ?? []).map((member) => (
                  <li key={member.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Avatar name={member.name || refName(member, lookups.employees)} size="sm" />
                    <span className="flex-1 text-sm font-medium text-slate-800">{member.name || refName(member, lookups.employees)}</span>
                    {team.lead?.id === member.id && <Crown className="h-4 w-4 text-gold" aria-label="Team lead" />}
                    {member.role && <span className="text-xs text-slate-500">{member.role}</span>}
                  </li>
                ))}
              </ul>
            )}
            {adding && (
              <AddMemberModal
                team={team}
                lookups={lookups}
                onClose={() => setAdding(false)}
                onSaved={() => {
                  state.reload();
                  onChanged();
                }}
              />
            )}
          </div>
        )}
      </Async>
    </Modal>
  );
}

export function TeamsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.teamManage);
  const state = useApi((signal) => listAll('/teams', normTeam, {}, signal), []);
  const lookups = useLookups(['employees']);
  const lk = lookups.data ?? EMPTY_LOOKUPS;
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const teams = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (state.data ?? []).filter((team) => !query || `${team.name} ${team.description ?? ''}`.toLowerCase().includes(query));
  }, [state.data, search]);

  return (
    <div>
      <PageHeader
        title="Teams"
        description="Project and functional groups, independent of departments."
        actions={
          canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Create team
            </Button>
          )
        }
      />
      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search teams…" className="sm:w-72" />
      </div>
      <Async state={state} loadingLabel="Loading teams…">
        {() =>
          teams.length === 0 ? (
            <Card>
              <EmptyState
                icon={UsersRound}
                title={search ? 'No matching teams' : 'No teams yet'}
                description={search ? 'Try a different search.' : 'Create a team to group people around a project or function.'}
                action={
                  canManage && !search ? (
                    <Button size="sm" onClick={() => setCreating(true)}>
                      <Plus className="h-4 w-4" aria-hidden /> Create team
                    </Button>
                  ) : undefined
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {teams.map((team, index) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setViewing(team.id)}
                  className="card card-hover animate-fade-up p-4 text-left"
                  style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <span className="rounded-lg bg-brand-50 p-2.5 text-brand-600">
                      <UsersRound className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy">{team.name}</p>
                      <p className="line-clamp-2 text-xs text-slate-500">{team.description || 'No description'}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Crown className="h-3.5 w-3.5 text-gold" aria-hidden /> {refName(team.lead, lk.employees)}
                    </span>
                    <span>{team.memberCount ?? 0} member{team.memberCount === 1 ? '' : 's'}</span>
                  </div>
                </button>
              ))}
            </div>
          )
        }
      </Async>
      {creating && <TeamFormModal lookups={lk} onClose={() => setCreating(false)} onSaved={state.reload} />}
      {viewing && <TeamDetailModal teamId={viewing} canManage={canManage} lookups={lk} onClose={() => setViewing(null)} onChanged={state.reload} />}
    </div>
  );
}
