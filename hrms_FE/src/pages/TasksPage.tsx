import { useMemo, useState } from 'react';
import { ClipboardCheck, Plus } from 'lucide-react';
import { Async } from '../components/ui/Async';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormModal } from '../components/ui/FormModal';
import { Input, Textarea } from '../components/ui/Input';
import { Avatar, FilterBar, Segmented } from '../components/ui/Misc';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { StatusChip } from '../components/ui/StatusChip';
import { Table, type Column } from '../components/ui/Table';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { fmtDate, todayIso } from '../lib/format';
import { listAll } from '../lib/listAll';
import { isStatus, normTask, normTeam } from '../lib/normalize';
import { toPayload } from '../lib/payload';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';
import { useDebounce } from '../lib/useDebounce';
import { required, useForm } from '../lib/useForm';
import { EMPTY_LOOKUPS, refName, useLookups, type Lookups } from '../lib/useLookups';
import { PERMISSIONS, type Task } from '../types';

const STATUSES = [
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
];
const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

type Scope = 'mine' | 'all';

function TaskFormModal({
  lookups,
  teams,
  defaultOwner,
  onClose,
  onSaved,
}: {
  lookups: Lookups;
  teams: { id: string; name: string }[];
  defaultOwner: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm({ title: '', description: '', priority: 'MEDIUM', dueAt: '', teamId: '', ownerEmployeeId: defaultOwner });
  return (
    <FormModal
      open
      size="lg"
      title="New task"
      submitLabel="Create task"
      submitting={form.submitting}
      error={form.formError}
      onClose={onClose}
      onSubmit={() =>
        form.submit({
          validate: required(['title', 'Title'], ['ownerEmployeeId', 'Owner']),
          action: (values) =>
            api.post(
              '/tasks',
              toPayload({
                title: values.title.trim(),
                description: values.description.trim(),
                priority: values.priority,
                dueAt: values.dueAt ? new Date(`${values.dueAt}T17:00:00`).toISOString() : undefined,
                teamId: values.teamId,
                ownerEmployeeId: values.ownerEmployeeId,
              }),
            ),
          success: 'Task created',
          onDone: () => {
            onSaved();
            onClose();
          },
        })
      }
    >
      <Input label="Title" required autoFocus {...form.bind('title')} />
      <Textarea label="Description" rows={3} {...form.bind('description')} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select label="Owner" required placeholder="Select owner" options={lookups.employees.map((e) => ({ value: e.id, label: e.name }))} {...form.bind('ownerEmployeeId')} />
        <Select label="Team" placeholder="No team" options={teams.map((t) => ({ value: t.id, label: t.name }))} {...form.bind('teamId')} />
        <Select label="Priority" options={PRIORITIES} {...form.bind('priority')} />
        <Input label="Due date" type="date" min={todayIso()} {...form.bind('dueAt')} />
      </div>
    </FormModal>
  );
}

export function TasksPage() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.taskManage);
  const myEmployeeId = user?.employeeId ?? '';
  const state = useApi((signal) => listAll('/tasks', normTask, {}, signal), []);
  const teams = useApi((signal) => listAll('/teams', normTeam, {}, signal), [], canManage);
  const lookups = useLookups(['employees']);
  const lk = lookups.data ?? EMPTY_LOOKUPS;
  const { run, isBusy } = useAction();

  const [scope, setScope] = useState<Scope>(canManage ? 'all' : 'mine');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [creating, setCreating] = useState(false);
  const query = useDebounce(search, 200).trim().toLowerCase();

  const rows = useMemo(
    () =>
      (state.data ?? []).filter((task) => {
        if (scope === 'mine' && myEmployeeId && task.owner?.id !== myEmployeeId) return false;
        if (status && task.status.toUpperCase() !== status) return false;
        if (priority && task.priority.toUpperCase() !== priority) return false;
        return !query || `${task.title} ${task.description ?? ''}`.toLowerCase().includes(query);
      }),
    [state.data, scope, myEmployeeId, status, priority, query],
  );

  const changeStatus = (task: Task, next: string) =>
    void run(task.id, () => api.patch(`/tasks/${task.id}`, toPayload({ status: next })), 'Task updated', state.reload);

  const columns: Column<Task>[] = [
    {
      key: 'title',
      header: 'Task',
      render: (row) => (
        <div className="min-w-0 max-w-md">
          <p className={cn('truncate font-medium', isStatus(row.status, 'done', 'cancelled') ? 'text-slate-400 line-through' : 'text-slate-900')}>{row.title}</p>
          {row.team?.name && <p className="truncate text-xs text-slate-500">{row.team.name}</p>}
        </div>
      ),
    },
    { key: 'priority', header: 'Priority', render: (row) => <StatusChip status={row.priority} /> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const editable = canManage || (myEmployeeId && row.owner?.id === myEmployeeId);
        return editable ? (
          <select
            aria-label={`Status for ${row.title}`}
            value={row.status.toUpperCase()}
            disabled={isBusy(row.id)}
            onChange={(event) => changeStatus(row, event.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-brand-400 focus:border-brand-600 disabled:opacity-60"
          >
            {STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <StatusChip status={row.status} />
        );
      },
    },
    {
      key: 'due',
      header: 'Due',
      hideOnMobile: true,
      render: (row) => {
        const overdue = row.dueAt && !isStatus(row.status, 'done', 'cancelled') && row.dueAt.slice(0, 10) < todayIso();
        return <span className={cn(overdue && 'font-medium text-red-600')}>{row.dueAt ? fmtDate(row.dueAt) : '—'}{overdue ? ' · overdue' : ''}</span>;
      },
    },
    {
      key: 'owner',
      header: 'Owner',
      hideOnMobile: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Avatar name={refName(row.owner, lk.employees)} size="sm" />
          <span>{refName(row.owner, lk.employees)}</span>
        </div>
      ),
    },
  ];

  const hasFilters = Boolean(search || status || priority);

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Everything on your plate, and what your teams are working on."
        actions={
          canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden /> New task
            </Button>
          )
        }
      />
      <Card flush>
        <FilterBar>
          {canManage && (
            <Segmented
              value={scope}
              onChange={setScope}
              options={[
                { key: 'mine', label: 'My tasks' },
                { key: 'all', label: 'All tasks' },
              ]}
            />
          )}
          <SearchInput value={search} onChange={setSearch} placeholder="Search tasks…" className="sm:w-64" />
          <Select aria-label="Status" placeholder="Any status" value={status} onChange={(e) => setStatus(e.target.value)} options={STATUSES} className="sm:w-40" />
          <Select aria-label="Priority" placeholder="Any priority" value={priority} onChange={(e) => setPriority(e.target.value)} options={PRIORITIES} className="sm:w-36" />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setStatus('');
                setPriority('');
              }}
            >
              Clear filters
            </Button>
          )}
        </FilterBar>
        <Async state={state} loadingLabel="Loading tasks…">
          {() => (
            <Table
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              pageSize={15}
              emptyTitle={hasFilters ? 'No matching tasks' : scope === 'mine' ? 'No tasks assigned to you' : 'No tasks yet'}
              emptyDescription={hasFilters ? 'Try adjusting your filters.' : 'Tasks you create or are assigned will show up here.'}
              emptyAction={
                canManage && !hasFilters ? (
                  <Button size="sm" onClick={() => setCreating(true)}>
                    <ClipboardCheck className="h-4 w-4" aria-hidden /> New task
                  </Button>
                ) : undefined
              }
            />
          )}
        </Async>
      </Card>
      {creating && (
        <TaskFormModal lookups={lk} teams={teams.data ?? []} defaultOwner={myEmployeeId} onClose={() => setCreating(false)} onSaved={state.reload} />
      )}
    </div>
  );
}
