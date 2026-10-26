import { useMemo, useState } from 'react';
import { Building2, MapPin, Pencil, Plus, Tag, type LucideIcon } from 'lucide-react';
import { Async } from '../../components/ui/Async';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormModal } from '../../components/ui/FormModal';
import { Input } from '../../components/ui/Input';
import { FilterBar } from '../../components/ui/Misc';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { Select } from '../../components/ui/Select';
import { StatusChip } from '../../components/ui/StatusChip';
import { Table, type Column } from '../../components/ui/Table';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { titleCase } from '../../lib/format';
import { listAll } from '../../lib/listAll';
import { normOrg } from '../../lib/normalize';
import { toPayload } from '../../lib/payload';
import { required, useForm } from '../../lib/useForm';
import { useApi } from '../../lib/useApi';
import { PERMISSIONS, type OrgEntity } from '../../types';

export type OrgKind = 'department' | 'branch' | 'designation';

interface OrgConfig {
  title: string;
  singular: string;
  path: string;
  icon: LucideIcon;
  description: string;
  parentLabel: string;
}

const CONFIG: Record<OrgKind, OrgConfig> = {
  department: {
    title: 'Departments',
    singular: 'department',
    path: '/departments',
    icon: Building2,
    description: 'The functional groups that make up your company.',
    parentLabel: 'Parent department',
  },
  branch: {
    title: 'Branches',
    singular: 'branch',
    path: '/branches',
    icon: MapPin,
    description: 'Offices and locations where your people work.',
    parentLabel: 'Parent branch',
  },
  designation: {
    title: 'Designations',
    singular: 'designation',
    path: '/designations',
    icon: Tag,
    description: 'Job titles used across the organisation.',
    parentLabel: 'Reports into',
  },
};

function OrgFormModal({
  config,
  entity,
  all,
  onClose,
  onSaved,
}: {
  config: OrgConfig;
  entity: OrgEntity | null;
  all: OrgEntity[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm({
    name: entity?.name ?? '',
    parentId: entity?.parentId ?? '',
    status: entity?.status?.toUpperCase() ?? 'ACTIVE',
  });

  return (
    <FormModal
      open
      title={entity ? `Edit ${config.singular}` : `Add ${config.singular}`}
      submitLabel={entity ? 'Save changes' : `Create ${config.singular}`}
      submitting={form.submitting}
      error={form.formError}
      onClose={onClose}
      onSubmit={() =>
        form.submit({
          validate: required(['name', 'Name']),
          action: (values) => {
            const body = toPayload({
              name: values.name.trim(),
              parentId: values.parentId || (entity ? null : undefined),
              status: entity ? values.status : undefined,
            });
            return entity ? api.patch(`${config.path}/${entity.id}`, body) : api.post(config.path, body);
          },
          success: entity ? 'Changes saved' : `${config.singular.charAt(0).toUpperCase()}${config.singular.slice(1)} created`,
          onDone: () => {
            onSaved();
            onClose();
          },
        })
      }
    >
      <Input label="Name" required autoFocus {...form.bind('name')} />
      <Select
        label={config.parentLabel}
        placeholder="None"
        options={all.filter((item) => item.id !== entity?.id).map((item) => ({ value: item.id, label: item.name }))}
        {...form.bind('parentId')}
      />
      {entity && (
        <Select
          label="Status"
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ]}
          {...form.bind('status')}
        />
      )}
    </FormModal>
  );
}

export function OrgEntityPage({ kind }: { kind: OrgKind }) {
  const config = CONFIG[kind];
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.orgManage);
  const state = useApi((signal) => listAll(config.path, normOrg, {}, signal), [kind]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<OrgEntity | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (state.data ?? []).filter((item) => !query || item.name.toLowerCase().includes(query));
  }, [state.data, search]);

  const columns: Column<OrgEntity>[] = [
    {
      key: 'name',
      header: titleCase(config.singular),
      render: (row) => (
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-brand-50 p-1.5 text-brand-600">
            <config.icon className="h-4 w-4" aria-hidden />
          </span>
          <span className="font-medium text-slate-900">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'parent',
      header: 'Parent',
      hideOnMobile: true,
      render: (row) => (row.parentId ? (state.data?.find((item) => item.id === row.parentId)?.name ?? '—') : '—'),
    },
    { key: 'count', header: 'Employees', hideOnMobile: true, render: (row) => row.employeeCount ?? '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusChip status={row.status} /> },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            className: 'w-12 text-right',
            render: (row: OrgEntity) => (
              <Button variant="ghost" size="sm" onClick={() => setEditing(row)} aria-label={`Edit ${row.name}`}>
                <Pencil className="h-4 w-4" aria-hidden />
              </Button>
            ),
          } satisfies Column<OrgEntity>,
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Add {config.singular}
            </Button>
          )
        }
      />
      <Card flush>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder={`Search ${config.title.toLowerCase()}…`} className="sm:w-72" />
        </FilterBar>
        <Async state={state}>
          {() => (
            <Table
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              pageSize={15}
              emptyTitle={search ? `No matching ${config.title.toLowerCase()}` : `No ${config.title.toLowerCase()} yet`}
              emptyDescription={search ? 'Try a different search.' : `Add your first ${config.singular} to get started.`}
              emptyAction={
                canManage && !search ? (
                  <Button size="sm" onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4" aria-hidden /> Add {config.singular}
                  </Button>
                ) : undefined
              }
            />
          )}
        </Async>
      </Card>

      {(creating || editing) && (
        <OrgFormModal
          key={editing?.id ?? 'new'}
          config={config}
          entity={editing}
          all={state.data ?? []}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={state.reload}
        />
      )}
    </div>
  );
}

export const DepartmentsPage = () => <OrgEntityPage kind="department" />;
export const BranchesPage = () => <OrgEntityPage kind="branch" />;
export const DesignationsPage = () => <OrgEntityPage kind="designation" />;
