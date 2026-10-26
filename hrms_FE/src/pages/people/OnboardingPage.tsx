import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Plus, UserPlus } from 'lucide-react';
import { Async } from '../../components/ui/Async';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormModal } from '../../components/ui/FormModal';
import { Input, Textarea } from '../../components/ui/Input';
import { Avatar, ProgressBar, Segmented } from '../../components/ui/Misc';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { StatusChip } from '../../components/ui/StatusChip';
import { cn } from '../../lib/cn';
import { api } from '../../lib/api';
import { fmtDate } from '../../lib/format';
import { listAll } from '../../lib/listAll';
import { isStatus, normOnboarding } from '../../lib/normalize';
import { toPayload } from '../../lib/payload';
import { useAction } from '../../lib/useAction';
import { useApi } from '../../lib/useApi';
import { required, useForm } from '../../lib/useForm';
import { EMPTY_LOOKUPS, refName, useLookups, type Lookups } from '../../lib/useLookups';
import type { OnboardingCase } from '../../types';

const DEFAULT_TASKS = [
  'Collect identity and joining documents',
  'Create email and system accounts',
  'Assign laptop and accessories',
  'Introduce to team and manager',
  'Complete HR induction',
].join('\n');

type Filter = 'active' | 'completed' | 'all';

function StartModal({ lookups, onClose, onSaved }: { lookups: Lookups; onClose: () => void; onSaved: () => void }) {
  const form = useForm({ employeeId: '', name: 'New hire onboarding', tasks: DEFAULT_TASKS });
  return (
    <FormModal
      open
      title="Start onboarding"
      description="Create a checklist for a new joiner."
      submitLabel="Create checklist"
      submitting={form.submitting}
      error={form.formError}
      onClose={onClose}
      onSubmit={() =>
        form.submit({
          validate: (values) => {
            const errors = required(['employeeId', 'Employee'], ['name', 'Checklist name'])(values);
            if (!values.tasks.trim()) errors.tasks = 'Add at least one task';
            return errors;
          },
          action: (values) =>
            api.post(
              '/onboarding-checklists',
              toPayload({
                employeeId: values.employeeId,
                name: values.name.trim(),
                items: values.tasks
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((title) => ({ title })),
              }),
            ),
          success: 'Onboarding checklist created',
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
        options={lookups.employees.map((e) => ({ value: e.id, label: `${e.name}${e.employeeNumber ? ` (${e.employeeNumber})` : ''}` }))}
        {...form.bind('employeeId')}
      />
      <Input label="Checklist name" required {...form.bind('name')} />
      <Textarea label="Tasks" rows={6} hint="One task per line." {...form.bind('tasks')} />
    </FormModal>
  );
}

function CaseCard({ item, lookups, onToggled }: { item: OnboardingCase; lookups: Lookups; onToggled: () => void }) {
  const { run, isBusy } = useAction();
  const done = item.tasks.filter((task) => task.done).length;
  const complete = item.tasks.length > 0 && done === item.tasks.length;

  return (
    <Card className="animate-fade-up">
      <div className="flex items-start gap-3">
        <Avatar name={refName(item.employee, lookups.employees)} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900">{refName(item.employee, lookups.employees)}</p>
          <p className="truncate text-xs text-slate-500">{item.name}</p>
        </div>
        <StatusChip status={complete ? 'completed' : item.status} />
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>
            {done} of {item.tasks.length} done
          </span>
          <span>{item.tasks.length > 0 ? Math.round((done / item.tasks.length) * 100) : 0}%</span>
        </div>
        <ProgressBar value={done} max={item.tasks.length} className="[&>div]:!bg-brand-500" />
      </div>
      <ul className="mt-3 space-y-1">
        {item.tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              disabled={task.done || isBusy(task.id)}
              onClick={() =>
                void run(task.id, () => api.post(`/onboarding-items/${task.id}/complete`), 'Task completed', onToggled)
              }
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                task.done ? 'text-slate-400' : 'text-slate-700 hover:bg-brand-50',
              )}
            >
              {task.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
              )}
              <span className={cn('flex-1', task.done && 'line-through')}>{task.title}</span>
              {task.dueDate && !task.done && <span className="text-xs text-slate-400">{fmtDate(task.dueDate, 'dd MMM')}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function OnboardingPage() {
  const state = useApi((signal) => listAll('/onboarding-checklists', normOnboarding, {}, signal), []);
  const lookups = useLookups(['employees']);
  const lk = lookups.data ?? EMPTY_LOOKUPS;
  const [filter, setFilter] = useState<Filter>('active');
  const [starting, setStarting] = useState(false);

  const visible = useMemo(
    () =>
      (state.data ?? []).filter((item) => {
        const complete = isStatus(item.status, 'completed') || (item.tasks.length > 0 && item.tasks.every((task) => task.done));
        if (filter === 'active') return !complete;
        if (filter === 'completed') return complete;
        return true;
      }),
    [state.data, filter],
  );

  return (
    <div>
      <PageHeader
        title="Onboarding"
        description="Track every new joiner's checklist from offer to first week."
        actions={
          <>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { key: 'active', label: 'In progress' },
                { key: 'completed', label: 'Completed' },
                { key: 'all', label: 'All' },
              ]}
            />
            <Button onClick={() => setStarting(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Start onboarding
            </Button>
          </>
        }
      />
      <Async state={state} loadingLabel="Loading onboarding…">
        {() =>
          visible.length === 0 ? (
            <Card>
              <EmptyState
                icon={UserPlus}
                title={filter === 'active' ? 'No onboarding in progress' : 'Nothing to show'}
                description="Start a checklist to help new joiners get set up quickly."
                action={
                  <Button size="sm" onClick={() => setStarting(true)}>
                    <Plus className="h-4 w-4" aria-hidden /> Start onboarding
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((item) => (
                <CaseCard key={item.id} item={item} lookups={lk} onToggled={state.reload} />
              ))}
            </div>
          )
        }
      </Async>
      {starting && <StartModal lookups={lk} onClose={() => setStarting(false)} onSaved={state.reload} />}
    </div>
  );
}
