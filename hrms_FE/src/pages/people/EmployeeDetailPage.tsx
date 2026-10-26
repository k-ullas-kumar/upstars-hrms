import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, Pencil, Phone, UserX } from 'lucide-react';
import { Async } from '../../components/ui/Async';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormModal } from '../../components/ui/FormModal';
import { Input } from '../../components/ui/Input';
import { Avatar, DetailList } from '../../components/ui/Misc';
import { StatusChip } from '../../components/ui/StatusChip';
import { Table, type Column } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { fmtDate, todayIso } from '../../lib/format';
import { listAll } from '../../lib/listAll';
import { normAsset, normEmployee, normLeaveRequest } from '../../lib/normalize';
import { toPayload } from '../../lib/payload';
import { required, useForm } from '../../lib/useForm';
import { useApi } from '../../lib/useApi';
import { EMPTY_LOOKUPS, refName, useLookups } from '../../lib/useLookups';
import { PERMISSIONS, type Asset, type Employee, type LeaveRequest } from '../../types';
import { EmployeeFormModal } from './EmployeeFormModal';

type TabKey = 'overview' | 'employment' | 'leave' | 'assets';

function DeactivateModal({ employee, onClose, onDone }: { employee: Employee; onClose: () => void; onDone: () => void }) {
  const form = useForm({ exitDate: todayIso(), reason: '' });
  return (
    <FormModal
      open
      size="sm"
      title="Deactivate employee"
      description={`${employee.name} will lose access and be marked as exited.`}
      submitLabel="Deactivate"
      submitVariant="danger"
      submitting={form.submitting}
      error={form.formError}
      onClose={onClose}
      onSubmit={() =>
        form.submit({
          validate: required(['exitDate', 'Exit date']),
          action: (values) =>
            api.post(`/employees/${employee.id}/deactivate`, toPayload({ exitDate: values.exitDate, reason: values.reason.trim() })),
          success: 'Employee deactivated',
          onDone: () => {
            onDone();
            onClose();
          },
        })
      }
    >
      <Input label="Exit date" type="date" required {...form.bind('exitDate')} />
      <Input label="Reason (optional)" {...form.bind('reason')} />
    </FormModal>
  );
}

function LeaveTab({ employeeId }: { employeeId: string }) {
  const state = useApi(async (signal) => {
    const all = await listAll('/leave-requests', normLeaveRequest, { employee_id: employeeId }, signal);
    return all.filter((request) => !request.employee?.id || request.employee.id === employeeId);
  }, [employeeId]);
  const columns: Column<LeaveRequest>[] = [
    { key: 'type', header: 'Type', render: (row) => row.leaveType?.name || '—' },
    { key: 'dates', header: 'Dates', render: (row) => `${fmtDate(row.startDate)} – ${fmtDate(row.endDate)}` },
    { key: 'days', header: 'Days', render: (row) => row.days ?? '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusChip status={row.status} /> },
  ];
  return (
    <Async state={state}>
      {(rows) => <Table columns={columns} rows={rows} rowKey={(row) => row.id} pageSize={10} emptyTitle="No leave requests" emptyDescription="This employee hasn't requested any leave." />}
    </Async>
  );
}

function AssetsTab({ employeeId }: { employeeId: string }) {
  const state = useApi(async (signal) => {
    const all = await listAll('/assets', normAsset, { employee_id: employeeId }, signal);
    return all.filter((asset) => asset.currentAssignment?.employee?.id === employeeId);
  }, [employeeId]);
  const columns: Column<Asset>[] = [
    { key: 'tag', header: 'Tag', render: (row) => <span className="font-mono text-xs">{row.assetTag}</span> },
    { key: 'name', header: 'Asset', render: (row) => row.name },
    { key: 'category', header: 'Category', render: (row) => row.category || '—' },
    { key: 'since', header: 'Assigned', render: (row) => fmtDate(row.currentAssignment?.assignedAt) },
  ];
  return (
    <Async state={state}>
      {(rows) => <Table columns={columns} rows={rows} rowKey={(row) => row.id} emptyTitle="No assets assigned" emptyDescription="Nothing is currently assigned to this employee." />}
    </Async>
  );
}

export function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<TabKey>('overview');
  const [editing, setEditing] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const state = useApi(async (signal) => normEmployee(await api.get<unknown>(`/employees/${id}`, undefined, signal)), [id]);
  const lookups = useLookups(['departments', 'designations', 'branches', 'employees']);
  const lk = lookups.data ?? EMPTY_LOOKUPS;

  const canViewAssets = hasPermission(PERMISSIONS.assetManage) || hasPermission(PERMISSIONS.assetAssign);

  return (
    <div>
      <Link to="/people/employees" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All employees
      </Link>

      <Async state={state} loadingLabel="Loading employee…">
        {(employee) => {
          const isActive = employee.employmentStatus.toUpperCase() === 'ACTIVE';
          return (
            <div className="space-y-5">
              <Card>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Avatar name={employee.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-semibold tracking-tight">{employee.name}</h1>
                      <StatusChip status={employee.employmentStatus} />
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {[refName(employee.designation, lk.designations), refName(employee.department, lk.departments)]
                        .filter((value) => value !== '—')
                        .join(' · ') || 'No role assigned'}
                      {employee.employeeNumber ? ` · ${employee.employeeNumber}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <a href={`mailto:${employee.workEmail}`} className="inline-flex items-center gap-1.5 hover:text-brand-700">
                        <Mail className="h-4 w-4 text-slate-400" aria-hidden /> {employee.workEmail}
                      </a>
                      {employee.phone && (
                        <a href={`tel:${employee.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand-700">
                          <Phone className="h-4 w-4 text-slate-400" aria-hidden /> {employee.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hasPermission(PERMISSIONS.employeeUpdate) && (
                      <Button variant="secondary" onClick={() => setEditing(true)}>
                        <Pencil className="h-4 w-4" aria-hidden /> Edit
                      </Button>
                    )}
                    {hasPermission(PERMISSIONS.employeeDeactivate) && isActive && (
                      <Button variant="danger" onClick={() => setDeactivating(true)}>
                        <UserX className="h-4 w-4" aria-hidden /> Deactivate
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              <Tabs
                active={tab}
                onChange={setTab}
                tabs={[
                  { key: 'overview', label: 'Overview' },
                  { key: 'employment', label: 'Employment' },
                  { key: 'leave', label: 'Leave' },
                  ...(canViewAssets ? [{ key: 'assets' as const, label: 'Assets' }] : []),
                ]}
              />

              <Card>
                {tab === 'overview' && (
                  <DetailList
                    items={[
                      { label: 'Full name', value: employee.name },
                      { label: 'Employee ID', value: employee.employeeNumber },
                      { label: 'Work email', value: employee.workEmail },
                      { label: 'Phone', value: employee.phone },
                      { label: 'Date of birth', value: employee.dateOfBirth ? fmtDate(employee.dateOfBirth) : undefined },
                      { label: 'Address', value: employee.address },
                    ]}
                  />
                )}
                {tab === 'employment' && (
                  <DetailList
                    items={[
                      { label: 'Status', value: <StatusChip status={employee.employmentStatus} /> },
                      { label: 'Department', value: refName(employee.department, lk.departments) },
                      { label: 'Designation', value: refName(employee.designation, lk.designations) },
                      { label: 'Branch', value: refName(employee.branch, lk.branches) },
                      {
                        label: 'Reports to',
                        value: employee.manager?.id ? (
                          <Link className="font-medium text-brand-700 hover:underline" to={`/people/employees/${employee.manager.id}`}>
                            {refName(employee.manager, lk.employees)}
                          </Link>
                        ) : (
                          refName(employee.manager, lk.employees)
                        ),
                      },
                      { label: 'Joining date', value: fmtDate(employee.joiningDate) },
                      { label: 'Exit date', value: employee.exitDate ? fmtDate(employee.exitDate) : undefined },
                    ]}
                  />
                )}
                {tab === 'leave' && <LeaveTab employeeId={employee.id} />}
                {tab === 'assets' && canViewAssets && <AssetsTab employeeId={employee.id} />}
              </Card>

              {editing && (
                <EmployeeFormModal
                  employee={employee}
                  lookups={lk}
                  onClose={() => setEditing(false)}
                  onSaved={state.reload}
                />
              )}
              {deactivating && (
                <DeactivateModal employee={employee} onClose={() => setDeactivating(false)} onDone={state.reload} />
              )}
            </div>
          );
        }}
      </Async>
    </div>
  );
}
