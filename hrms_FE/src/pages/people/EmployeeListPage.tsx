import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Plus, Upload, UserSearch } from 'lucide-react';
import { Async } from '../../components/ui/Async';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Avatar, FilterBar } from '../../components/ui/Misc';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { Select } from '../../components/ui/Select';
import { StatusChip } from '../../components/ui/StatusChip';
import { Table, type Column } from '../../components/ui/Table';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api, getErrorMessage } from '../../lib/api';
import { fmtDate } from '../../lib/format';
import { listAll } from '../../lib/listAll';
import { normEmployee } from '../../lib/normalize';
import { useApi } from '../../lib/useApi';
import { useDebounce } from '../../lib/useDebounce';
import { EMPTY_LOOKUPS, refName, useLookups } from '../../lib/useLookups';
import { PERMISSIONS, type Employee } from '../../types';
import { EmployeeFormModal } from './EmployeeFormModal';

const STATUS_FILTERS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'EXITED', label: 'Exited' },
];

export function EmployeeListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const employees = useApi((signal) => listAll('/employees', normEmployee, {}, signal), []);
  const lookups = useLookups(['departments', 'designations', 'branches', 'employees']);
  const lk = lookups.data ?? EMPTY_LOOKUPS;

  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [branch, setBranch] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const query = useDebounce(search, 200).trim().toLowerCase();

  const filtered = useMemo(() => {
    return (employees.data ?? []).filter((employee) => {
      if (department && employee.department?.id !== department) return false;
      if (branch && employee.branch?.id !== branch) return false;
      if (status && employee.employmentStatus.toUpperCase() !== status) return false;
      if (!query) return true;
      return [employee.name, employee.workEmail, employee.employeeNumber, employee.phone ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [employees.data, department, branch, status, query]);

  const hasFilters = Boolean(search || department || branch || status);
  const clearFilters = () => {
    setSearch('');
    setDepartment('');
    setBranch('');
    setStatus('');
  };

  const onExport = async () => {
    setExporting(true);
    try {
      await api.download('/reports/employees.csv', undefined, 'employees.csv');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  const canCreate = hasPermission(PERMISSIONS.employeeCreate);

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name} />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{row.name}</p>
            <p className="truncate text-xs text-slate-500">{row.workEmail}</p>
          </div>
        </div>
      ),
    },
    { key: 'number', header: 'ID', hideOnMobile: true, render: (row) => <span className="font-mono text-xs">{row.employeeNumber || '—'}</span> },
    { key: 'department', header: 'Department', hideOnMobile: true, render: (row) => refName(row.department, lk.departments) },
    { key: 'designation', header: 'Designation', hideOnMobile: true, render: (row) => refName(row.designation, lk.designations) },
    { key: 'manager', header: 'Manager', hideOnMobile: true, render: (row) => refName(row.manager, lk.employees) },
    { key: 'joined', header: 'Joined', hideOnMobile: true, render: (row) => fmtDate(row.joiningDate) },
    { key: 'status', header: 'Status', render: (row) => <StatusChip status={row.employmentStatus} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Search, filter and manage everyone in your organisation."
        actions={
          <>
            {hasPermission(PERMISSIONS.employeeExport) && (
              <Button variant="secondary" onClick={onExport} loading={exporting}>
                <Download className="h-4 w-4" aria-hidden /> Export
              </Button>
            )}
            {hasPermission(PERMISSIONS.employeeImport) && (
              <Button variant="secondary" onClick={() => navigate('/people/employees/import')}>
                <Upload className="h-4 w-4" aria-hidden /> Import
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" aria-hidden /> Add employee
              </Button>
            )}
          </>
        }
      />

      <Card flush>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or ID…" className="sm:w-72" />
          <Select
            aria-label="Department"
            placeholder="All departments"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            options={lk.departments.map((d) => ({ value: d.id, label: d.name }))}
            className="sm:w-44"
          />
          <Select
            aria-label="Branch"
            placeholder="All branches"
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            options={lk.branches.map((b) => ({ value: b.id, label: b.name }))}
            className="sm:w-40"
          />
          <Select
            aria-label="Status"
            placeholder="Any status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={STATUS_FILTERS}
            className="sm:w-36"
          />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
          <span className="text-xs text-slate-500 sm:ml-auto">
            {employees.data ? `${filtered.length} of ${employees.data.length}` : ''}
          </span>
        </FilterBar>

        <Async state={employees} loadingLabel="Loading employees…">
          {() => (
            <Table
              columns={columns}
              rows={filtered}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(`/people/employees/${row.id}`)}
              pageSize={15}
              emptyTitle={hasFilters ? 'No matching employees' : 'No employees yet'}
              emptyDescription={
                hasFilters ? 'Try adjusting or clearing your filters.' : 'Add your first employee or import a CSV to get started.'
              }
              emptyAction={
                hasFilters ? (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    <UserSearch className="h-4 w-4" aria-hidden /> Clear filters
                  </Button>
                ) : canCreate ? (
                  <Button size="sm" onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4" aria-hidden /> Add employee
                  </Button>
                ) : undefined
              }
            />
          )}
        </Async>
      </Card>

      {creating && (
        <EmployeeFormModal
          lookups={lk}
          onClose={() => setCreating(false)}
          onSaved={() => {
            employees.reload();
            lookups.reload();
          }}
        />
      )}
    </div>
  );
}
