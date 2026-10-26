import { useMemo, useState } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { CalendarDays, Plane, Plus, Settings2 } from 'lucide-react';
import { Async } from '../components/ui/Async';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { DecisionModal } from '../components/ui/DecisionModal';
import { EmptyState } from '../components/ui/EmptyState';
import { FormModal } from '../components/ui/FormModal';
import { Input, Textarea } from '../components/ui/Input';
import { Avatar, ProgressBar, Segmented } from '../components/ui/Misc';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { StatusChip } from '../components/ui/StatusChip';
import { Table, type Column } from '../components/ui/Table';
import { Tabs } from '../components/ui/Tabs';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { fmtDate, todayIso } from '../lib/format';
import { listAll } from '../lib/listAll';
import { isStatus, normLeaveBalance, normLeaveRequest } from '../lib/normalize';
import { toPayload } from '../lib/payload';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';
import { required, useForm } from '../lib/useForm';
import { EMPTY_LOOKUPS, refName, useLookups } from '../lib/useLookups';
import { PERMISSIONS, type LeaveBalance, type LeaveRequest, type LeaveType } from '../types';

type TabKey = 'balances' | 'requests' | 'approvals' | 'types';
type ApprovalFilter = 'pending' | 'all';

function calendarDays(start: string, end: string): number | null {
  if (!start || !end) return null;
  const diff = differenceInCalendarDays(parseISO(end), parseISO(start));
  return Number.isFinite(diff) ? diff + 1 : null;
}

function RequestModal({
  leaveTypes,
  balances,
  onClose,
  onSaved,
}: {
  leaveTypes: LeaveType[];
  balances: LeaveBalance[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm({ leaveTypeId: '', startDate: todayIso(), endDate: todayIso(), reason: '' });
  const days = calendarDays(form.values.startDate, form.values.endDate);
  const balance = balances.find((entry) => entry.leaveTypeId === form.values.leaveTypeId);
  const overBalance = balance && days !== null && balance.entitled > 0 && days > balance.remaining;

  return (
    <FormModal
      open
      title="Request leave"
      description="Your manager will be notified to review the request."
      submitLabel="Submit request"
      submitting={form.submitting}
      error={form.formError}
      onClose={onClose}
      onSubmit={() =>
        form.submit({
          validate: (values) => {
            const errors = required(['leaveTypeId', 'Leave type'], ['startDate', 'Start date'], ['endDate', 'End date'])(values);
            if (!errors.endDate && values.endDate < values.startDate) errors.endDate = 'End date must be on or after the start date';
            return errors;
          },
          action: (values) =>
            api.post(
              '/leave-requests',
              toPayload({
                leaveTypeId: values.leaveTypeId,
                startDate: values.startDate,
                endDate: values.endDate,
                reason: values.reason.trim(),
              }),
            ),
          success: 'Leave request submitted',
          onDone: () => {
            onSaved();
            onClose();
          },
        })
      }
    >
      <Select
        label="Leave type"
        required
        placeholder="Select a leave type"
        options={leaveTypes.map((type) => ({ value: type.id, label: type.name }))}
        {...form.bind('leaveTypeId')}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="From" type="date" required {...form.bind('startDate')} />
        <Input label="To" type="date" required min={form.values.startDate} {...form.bind('endDate')} />
      </div>
      {days !== null && days > 0 && (
        <p className={overBalance ? 'rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800' : 'rounded-md bg-brand-50 px-3 py-2 text-xs text-brand-800'}>
          {days} calendar day{days === 1 ? '' : 's'} requested
          {balance && ` · ${balance.remaining} day${balance.remaining === 1 ? '' : 's'} available`}
          {overBalance && ' — this exceeds your balance'}
        </p>
      )}
      <Textarea label="Reason" rows={3} placeholder="Optional" {...form.bind('reason')} />
    </FormModal>
  );
}

function LeaveTypeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const form = useForm({ name: '', code: '', paid: 'true', maxDaysPerYear: '0', carryForward: 'false' });
  return (
    <FormModal
      open
      title="Add leave type"
      submitLabel="Create leave type"
      submitting={form.submitting}
      error={form.formError}
      onClose={onClose}
      onSubmit={() =>
        form.submit({
          validate: (values) => {
            const errors = required(['name', 'Name'], ['code', 'Code'])(values);
            if (Number(values.maxDaysPerYear) < 0 || Number.isNaN(Number(values.maxDaysPerYear))) {
              errors.maxDaysPerYear = 'Enter 0 or a positive number';
            }
            return errors;
          },
          action: (values) =>
            api.post(
              '/leave-types',
              toPayload({
                name: values.name.trim(),
                code: values.code.trim().toUpperCase(),
                paid: values.paid === 'true',
                maxDaysPerYear: Number(values.maxDaysPerYear),
                carryForward: values.carryForward === 'true',
              }),
            ),
          success: 'Leave type created',
          onDone: () => {
            onSaved();
            onClose();
          },
        })
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Name" required autoFocus placeholder="Annual leave" {...form.bind('name')} />
        <Input label="Code" required placeholder="AL" {...form.bind('code')} />
        <Select
          label="Paid"
          options={[
            { value: 'true', label: 'Paid' },
            { value: 'false', label: 'Unpaid' },
          ]}
          {...form.bind('paid')}
        />
        <Input label="Days per year" type="number" min={0} step="0.5" hint="0 means unlimited." {...form.bind('maxDaysPerYear')} />
        <Select
          label="Carry forward"
          options={[
            { value: 'false', label: 'No' },
            { value: 'true', label: 'Yes' },
          ]}
          {...form.bind('carryForward')}
        />
      </div>
    </FormModal>
  );
}

function BalanceCard({ balance, name, delayMs }: { balance: LeaveBalance; name: string; delayMs: number }) {
  const unlimited = balance.entitled <= 0;
  return (
    <div className="card card-hover animate-fade-up p-4" style={{ animationDelay: `${delayMs}ms` }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">{name}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-navy">
            {unlimited ? '∞' : balance.remaining}
            <span className="ml-1 text-sm font-normal text-slate-500">{unlimited ? 'no limit' : 'days left'}</span>
          </p>
        </div>
        <span className="rounded-lg bg-brand-50 p-2.5 text-brand-600">
          <Plane className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <div className="mt-4">
        {!unlimited && <ProgressBar value={balance.used} max={balance.entitled} />}
        <p className="mt-1.5 text-xs text-slate-500">
          {balance.used} used{unlimited ? '' : ` of ${balance.entitled}`}
          {balance.pending ? ` · ${balance.pending} pending` : ''}
        </p>
      </div>
    </div>
  );
}

export function LeavePage() {
  const { user, hasPermission } = useAuth();
  const canRequest = hasPermission(PERMISSIONS.leaveRequest);
  const canApprove = hasPermission(PERMISSIONS.leaveApprove);
  const canManageTypes = hasPermission(PERMISSIONS.leaveManageTypes);

  const [tab, setTab] = useState<TabKey>(canRequest ? 'balances' : canApprove ? 'approvals' : 'types');
  const [requesting, setRequesting] = useState(false);
  const [addingType, setAddingType] = useState(false);
  const [cancelling, setCancelling] = useState<LeaveRequest | null>(null);
  const [deciding, setDeciding] = useState<{ item: LeaveRequest; decision: 'approve' | 'reject' } | null>(null);
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>('pending');
  const { run, isBusy } = useAction();

  const lookups = useLookups(['leaveTypes', 'employees']);
  const lk = lookups.data ?? EMPTY_LOOKUPS;

  const balances = useApi(
    async (signal) => (await api.list<unknown>('/leave-balances', undefined, signal)).map(normLeaveBalance),
    [],
    canRequest,
  );
  const requests = useApi((signal) => listAll('/leave-requests', normLeaveRequest, {}, signal), [], canRequest || canApprove);

  const isMine = (item: LeaveRequest) => !item.employee?.id || !user?.employeeId || item.employee.id === user.employeeId;
  const mine = useMemo(() => (requests.data ?? []).filter(isMine), [requests.data, user?.employeeId]);
  const others = useMemo(
    () => (requests.data ?? []).filter((item) => !isMine(item) || (!user?.employeeId && canApprove)),
    [requests.data, user?.employeeId, canApprove],
  );
  const queue = useMemo(
    () => others.filter((item) => approvalFilter === 'all' || isStatus(item.status, 'pending')),
    [others, approvalFilter],
  );
  const pendingCount = others.filter((item) => isStatus(item.status, 'pending')).length;

  const reload = () => {
    balances.reload();
    requests.reload();
  };

  const typeName = (item: LeaveRequest) => item.leaveType?.name || refName(item.leaveType, lk.leaveTypes);

  const myColumns: Column<LeaveRequest>[] = [
    { key: 'type', header: 'Type', render: (row) => <span className="font-medium text-slate-900">{typeName(row)}</span> },
    { key: 'dates', header: 'Dates', render: (row) => (row.startDate === row.endDate ? fmtDate(row.startDate) : `${fmtDate(row.startDate)} – ${fmtDate(row.endDate)}`) },
    { key: 'days', header: 'Days', render: (row) => row.days ?? calendarDays(row.startDate, row.endDate) ?? '—' },
    { key: 'reason', header: 'Reason', hideOnMobile: true, render: (row) => <span className="line-clamp-1 max-w-xs">{row.reason || '—'}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div>
          <StatusChip status={row.status} />
          {row.decisionNote && <p className="mt-1 max-w-[14rem] truncate text-xs text-slate-500" title={row.decisionNote}>“{row.decisionNote}”</p>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (row) =>
        isStatus(row.status, 'pending') ? (
          <Button size="sm" variant="ghost" onClick={() => setCancelling(row)} disabled={isBusy(row.id)}>
            Cancel
          </Button>
        ) : null,
    },
  ];

  const queueColumns: Column<LeaveRequest>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Avatar name={refName(row.employee, lk.employees)} size="sm" />
          <span className="font-medium text-slate-900">{refName(row.employee, lk.employees)}</span>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: typeName },
    { key: 'dates', header: 'Dates', render: (row) => (row.startDate === row.endDate ? fmtDate(row.startDate) : `${fmtDate(row.startDate)} – ${fmtDate(row.endDate)}`) },
    { key: 'days', header: 'Days', render: (row) => row.days ?? calendarDays(row.startDate, row.endDate) ?? '—' },
    { key: 'reason', header: 'Reason', hideOnMobile: true, render: (row) => <span className="line-clamp-1 max-w-xs">{row.reason || '—'}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (row) =>
        isStatus(row.status, 'pending') ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setDeciding({ item: row, decision: 'reject' })}>
              Reject
            </Button>
            <Button size="sm" onClick={() => setDeciding({ item: row, decision: 'approve' })}>
              Approve
            </Button>
          </div>
        ) : (
          <StatusChip status={row.status} />
        ),
    },
  ];

  const typeColumns: Column<LeaveType>[] = [
    { key: 'name', header: 'Name', render: (row) => <span className="font-medium text-slate-900">{row.name}</span> },
    { key: 'code', header: 'Code', render: (row) => <span className="font-mono text-xs">{row.code || '—'}</span> },
    { key: 'paid', header: 'Paid', render: (row) => (row.paid === false ? 'Unpaid' : 'Paid') },
    { key: 'max', header: 'Days / year', render: (row) => (row.maxDaysPerYear ? row.maxDaysPerYear : 'Unlimited') },
    { key: 'carry', header: 'Carry forward', hideOnMobile: true, render: (row) => (row.carryForward ? 'Yes' : 'No') },
  ];

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    ...(canRequest
      ? [
          { key: 'balances' as const, label: 'Balances' },
          { key: 'requests' as const, label: 'My requests' },
        ]
      : []),
    ...(canApprove ? [{ key: 'approvals' as const, label: 'Approval queue', count: pendingCount }] : []),
    ...(canManageTypes ? [{ key: 'types' as const, label: 'Leave types' }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Leave"
        description="Plan time off, track balances and review requests."
        actions={
          <>
            {canManageTypes && tab === 'types' && (
              <Button variant="secondary" onClick={() => setAddingType(true)}>
                <Settings2 className="h-4 w-4" aria-hidden /> Add leave type
              </Button>
            )}
            {canRequest && (
              <Button onClick={() => setRequesting(true)}>
                <Plus className="h-4 w-4" aria-hidden /> Request leave
              </Button>
            )}
          </>
        }
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-5" />

      {tab === 'balances' && (
        <Async state={balances} loadingLabel="Loading balances…">
          {(rows) =>
            rows.length === 0 ? (
              <Card>
                <EmptyState
                  icon={CalendarDays}
                  title="No leave balances yet"
                  description="Your balances will appear here once leave types are configured for you."
                  action={
                    <Button size="sm" onClick={() => setRequesting(true)}>
                      Request leave
                    </Button>
                  }
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((balance, index) => (
                  <BalanceCard
                    key={balance.leaveTypeId || index}
                    balance={balance}
                    name={balance.leaveTypeName || lk.leaveTypes.find((type) => type.id === balance.leaveTypeId)?.name || 'Leave'}
                    delayMs={index * 60}
                  />
                ))}
              </div>
            )
          }
        </Async>
      )}

      {tab === 'requests' && (
        <Card flush>
          <Async state={requests}>
            {() => (
              <Table
                columns={myColumns}
                rows={mine}
                rowKey={(row) => row.id}
                pageSize={10}
                emptyTitle="No leave requests"
                emptyDescription="When you request time off, it will be tracked here."
                emptyAction={
                  <Button size="sm" onClick={() => setRequesting(true)}>
                    <Plus className="h-4 w-4" aria-hidden /> Request leave
                  </Button>
                }
              />
            )}
          </Async>
        </Card>
      )}

      {tab === 'approvals' && (
        <Card
          flush
          title="Requests from your team"
          actions={
            <Segmented
              value={approvalFilter}
              onChange={setApprovalFilter}
              options={[
                { key: 'pending', label: 'Pending' },
                { key: 'all', label: 'All' },
              ]}
            />
          }
        >
          <Async state={requests}>
            {() => (
              <Table
                columns={queueColumns}
                rows={queue}
                rowKey={(row) => row.id}
                pageSize={10}
                emptyTitle={approvalFilter === 'pending' ? 'No pending requests' : 'No requests'}
                emptyDescription="You're all caught up."
              />
            )}
          </Async>
        </Card>
      )}

      {tab === 'types' && (
        <Card flush>
          <Table
            columns={typeColumns}
            rows={lk.leaveTypes}
            rowKey={(row) => row.id}
            emptyTitle="No leave types"
            emptyDescription="Create leave types such as Annual, Sick or Casual leave."
            emptyAction={
              <Button size="sm" onClick={() => setAddingType(true)}>
                <Plus className="h-4 w-4" aria-hidden /> Add leave type
              </Button>
            }
          />
        </Card>
      )}

      {requesting && (
        <RequestModal leaveTypes={lk.leaveTypes} balances={balances.data ?? []} onClose={() => setRequesting(false)} onSaved={reload} />
      )}
      {addingType && <LeaveTypeModal onClose={() => setAddingType(false)} onSaved={lookups.reload} />}
      {deciding && (
        <DecisionModal
          decision={deciding.decision}
          subject={`${refName(deciding.item.employee, lk.employees)} · ${typeName(deciding.item)} · ${fmtDate(deciding.item.startDate)}`}
          onClose={() => setDeciding(null)}
          onDone={reload}
          onConfirm={(note) =>
            api.post(`/leave-requests/${deciding.item.id}/${deciding.decision}`, toPayload({ note, decisionNote: note }))
          }
        />
      )}
      <ConfirmDialog
        open={Boolean(cancelling)}
        title="Cancel leave request?"
        message="Your manager will no longer see this request. You can submit a new one at any time."
        confirmLabel="Cancel request"
        destructive
        loading={cancelling ? isBusy(cancelling.id) : false}
        onClose={() => setCancelling(null)}
        onConfirm={() => {
          if (!cancelling) return;
          void run(cancelling.id, () => api.post(`/leave-requests/${cancelling.id}/cancel`), 'Leave request cancelled', () => {
            setCancelling(null);
            reload();
          }).then((ok) => {
            if (!ok) setCancelling(null);
          });
        }}
      />
    </div>
  );
}
