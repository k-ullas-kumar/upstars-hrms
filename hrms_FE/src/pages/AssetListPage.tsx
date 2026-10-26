import { useMemo, useState } from 'react';
import { Boxes, PackageCheck, Plus, Undo2, UserCheck } from 'lucide-react';
import { Async } from '../components/ui/Async';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormModal } from '../components/ui/FormModal';
import { Input, Textarea } from '../components/ui/Input';
import { DetailList, FilterBar } from '../components/ui/Misc';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { StatusChip } from '../components/ui/StatusChip';
import { Table, type Column } from '../components/ui/Table';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { fmtDate, fmtDateTime } from '../lib/format';
import { listAll } from '../lib/listAll';
import { isStatus, normAsset, normAssetDetail } from '../lib/normalize';
import { toPayload } from '../lib/payload';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';
import { useDebounce } from '../lib/useDebounce';
import { required, useForm } from '../lib/useForm';
import { EMPTY_LOOKUPS, refName, useLookups } from '../lib/useLookups';
import { PERMISSIONS, type Asset, type AssetAssignment, type AssetDetail } from '../types';

const STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'RETIRED', label: 'Retired' },
];

const CONDITION_OPTIONS = ['New', 'Good', 'Fair', 'Poor', 'Damaged'].map((value) => ({ value, label: value }));

function AssetFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const form = useForm({
    assetTag: '',
    category: '',
    serialNumber: '',
    condition: 'Good',
    location: '',
    purchaseDate: '',
    warrantyUntil: '',
    notes: '',
  });
  return (
    <FormModal
      open
      size="lg"
      title="Add asset"
      description="Register a new item in the asset register."
      submitLabel="Create asset"
      submitting={form.submitting}
      error={form.formError}
      onClose={onClose}
      onSubmit={() =>
        form.submit({
          validate: required(['assetTag', 'Asset tag'], ['category', 'Category']),
          action: (values) =>
            api.post(
              '/assets',
              toPayload({
                assetTag: values.assetTag.trim(),
                category: values.category.trim(),
                serialNumber: values.serialNumber.trim(),
                condition: values.condition,
                location: values.location.trim(),
                purchaseDate: values.purchaseDate,
                warrantyUntil: values.warrantyUntil,
                notes: values.notes.trim(),
              }),
            ),
          success: 'Asset created',
          onDone: () => {
            onSaved();
            onClose();
          },
        })
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Asset tag" required autoFocus placeholder="LAP-0042" {...form.bind('assetTag')} />
        <Input label="Category" required placeholder="Laptop" {...form.bind('category')} />
        <Input label="Serial number" {...form.bind('serialNumber')} />
        <Select label="Condition" options={CONDITION_OPTIONS} {...form.bind('condition')} />
        <Input label="Location" placeholder="HQ — IT store" {...form.bind('location')} />
        <span className="hidden sm:block" />
        <Input label="Purchase date" type="date" {...form.bind('purchaseDate')} />
        <Input label="Warranty until" type="date" {...form.bind('warrantyUntil')} />
      </div>
      <Textarea label="Notes" rows={3} {...form.bind('notes')} />
    </FormModal>
  );
}

function AssignModal({
  asset,
  employees,
  onClose,
  onSaved,
}: {
  asset: Asset;
  employees: { id: string; name: string; employeeNumber: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const form = useForm({ employeeId: '', conditionOut: asset.condition ?? 'Good', notes: '' });
  return (
    <FormModal
      open
      title="Assign asset"
      description={`${asset.assetTag} · ${asset.name}`}
      submitLabel="Assign"
      submitting={form.submitting}
      error={form.formError}
      onClose={onClose}
      onSubmit={() =>
        form.submit({
          validate: required(['employeeId', 'Employee']),
          action: (values) =>
            api.post(
              `/assets/${asset.id}/assignments`,
              toPayload({ employeeId: values.employeeId, conditionOut: values.conditionOut, notes: values.notes.trim() }),
            ),
          success: 'Asset assigned',
          onDone: () => {
            onSaved();
            onClose();
          },
        })
      }
    >
      <Select
        label="Assign to"
        required
        placeholder="Select employee"
        options={employees.map((e) => ({ value: e.id, label: `${e.name}${e.employeeNumber ? ` (${e.employeeNumber})` : ''}` }))}
        {...form.bind('employeeId')}
      />
      <Select label="Condition at hand-over" options={CONDITION_OPTIONS} {...form.bind('conditionOut')} />
      <Textarea label="Notes / accessories" rows={3} placeholder="Charger, bag…" {...form.bind('notes')} />
    </FormModal>
  );
}

function ReturnModal({ asset, onClose, onSaved }: { asset: Asset; onClose: () => void; onSaved: () => void }) {
  const form = useForm({ conditionIn: 'Good', notes: '' });
  return (
    <FormModal
      open
      title="Record return"
      description={`${asset.assetTag} · ${asset.name}`}
      submitLabel="Mark as returned"
      submitting={form.submitting}
      error={form.formError}
      onClose={onClose}
      onSubmit={() =>
        form.submit({
          action: async (values) => {
            let assignmentId = asset.currentAssignment?.id;
            if (!assignmentId) {
              assignmentId = normAssetDetail(await api.get<unknown>(`/assets/${asset.id}`)).currentAssignment?.id;
            }
            if (!assignmentId) throw new Error('This asset has no open assignment to return.');
            return api.post(`/assignments/${assignmentId}/return`, toPayload({ conditionIn: values.conditionIn, notes: values.notes.trim() }));
          },
          success: 'Return recorded — asset is ready for reassignment',
          onDone: () => {
            onSaved();
            onClose();
          },
        })
      }
    >
      <Select label="Condition on return" options={CONDITION_OPTIONS} {...form.bind('conditionIn')} />
      <Textarea label="Notes" rows={3} placeholder="Any damage or missing accessories" {...form.bind('notes')} />
    </FormModal>
  );
}

function DetailModal({
  assetId,
  employeeId,
  employees,
  onClose,
  onChanged,
}: {
  assetId: string;
  employeeId: string | null | undefined;
  employees: { id: string; name: string }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const state = useApi(async (signal) => normAssetDetail(await api.get<unknown>(`/assets/${assetId}`, undefined, signal)), [assetId]);
  const { run, isBusy } = useAction();

  const historyColumns: Column<AssetAssignment>[] = [
    { key: 'employee', header: 'Employee', render: (row) => refName(row.employee, employees) },
    { key: 'out', header: 'Assigned', render: (row) => fmtDateTime(row.assignedAt) },
    { key: 'in', header: 'Returned', render: (row) => (row.returnedAt ? fmtDateTime(row.returnedAt) : <StatusChip status="assigned" label="With employee" />) },
    { key: 'ack', header: 'Acknowledged', hideOnMobile: true, render: (row) => (row.acknowledgedAt ? fmtDate(row.acknowledgedAt) : '—') },
    { key: 'cond', header: 'Condition', hideOnMobile: true, render: (row) => [row.conditionOut, row.conditionOnReturn].filter(Boolean).join(' ? ') || '—' },
  ];

  return (
    <Modal open size="xl" title="Asset details" onClose={onClose}>
      <Async state={state}>
        {(asset: AssetDetail) => {
          const open = asset.currentAssignment;
          const mine = Boolean(open && employeeId && open.employee?.id === employeeId && !open.acknowledgedAt && open.id);
          return (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{asset.name}</h3>
                  <p className="font-mono text-xs text-slate-500">{asset.assetTag}</p>
                </div>
                <StatusChip status={asset.status} />
              </div>
              <DetailList
                columns={3}
                items={[
                  { label: 'Category', value: asset.category },
                  { label: 'Serial number', value: asset.serialNumber },
                  { label: 'Condition', value: asset.condition },
                  { label: 'Location', value: asset.location },
                  { label: 'Purchased', value: asset.purchaseDate ? fmtDate(asset.purchaseDate) : undefined },
                  { label: 'Warranty until', value: asset.warrantyUntil ? fmtDate(asset.warrantyUntil) : undefined },
                  { label: 'Assigned to', value: open?.employee ? refName(open.employee, employees) : undefined },
                  { label: 'Notes', value: asset.notes },
                ]}
              />
              {mine && open && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold-200 bg-gold-50 p-3 text-sm">
                  <span className="text-gold-700">This asset was assigned to you. Please confirm you've received it.</span>
                  <Button
                    size="sm"
                    variant="gold"
                    loading={isBusy('ack')}
                    onClick={() => void run('ack', () => api.post(`/assignments/${open.id}/acknowledge`), 'Receipt acknowledged', () => { state.reload(); onChanged(); })}
                  >
                    <PackageCheck className="h-4 w-4" aria-hidden /> Acknowledge receipt
                  </Button>
                </div>
              )}
              <div>
                <h4 className="mb-2 text-sm font-semibold text-navy">Assignment history</h4>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <Table columns={historyColumns} rows={asset.history} rowKey={(row) => row.id || `${row.employee?.id}-${row.assignedAt}`} maxHeightClass="max-h-64" emptyTitle="Never assigned" emptyDescription="Assignments will be tracked here." />
                </div>
              </div>
            </div>
          );
        }}
      </Async>
    </Modal>
  );
}

export function AssetListPage() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.assetManage);
  const canAssign = hasPermission(PERMISSIONS.assetAssign);
  const state = useApi((signal) => listAll('/assets', normAsset, {}, signal), []);
  const lookups = useLookups(['employees']);
  const lk = lookups.data ?? EMPTY_LOOKUPS;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<Asset | null>(null);
  const [returning, setReturning] = useState<Asset | null>(null);
  const query = useDebounce(search, 200).trim().toLowerCase();

  const categories = useMemo(
    () => [...new Set((state.data ?? []).map((asset) => asset.category).filter((value): value is string => Boolean(value)))].sort(),
    [state.data],
  );
  const rows = useMemo(
    () =>
      (state.data ?? []).filter((asset) => {
        if (status && asset.status.toUpperCase() !== status) return false;
        if (category && asset.category !== category) return false;
        if (!query) return true;
        return [asset.assetTag, asset.name, asset.serialNumber ?? '', asset.category ?? '', asset.currentAssignment?.employee?.name ?? '']
          .join(' ')
          .toLowerCase()
          .includes(query);
      }),
    [state.data, status, category, query],
  );
  const hasFilters = Boolean(search || status || category);

  const columns: Column<Asset>[] = [
    { key: 'tag', header: 'Tag', render: (row) => <span className="font-mono text-xs font-medium text-navy">{row.assetTag}</span> },
    {
      key: 'name',
      header: 'Asset',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{row.name}</p>
          {row.serialNumber && <p className="truncate text-xs text-slate-500">S/N {row.serialNumber}</p>}
        </div>
      ),
    },
    { key: 'category', header: 'Category', hideOnMobile: true, render: (row) => row.category || '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusChip status={row.status} /> },
    {
      key: 'assignee',
      header: 'Assigned to',
      hideOnMobile: true,
      render: (row) => (row.currentAssignment && !row.currentAssignment.returnedAt ? refName(row.currentAssignment.employee, lk.employees) : '—'),
    },
    { key: 'warranty', header: 'Warranty', hideOnMobile: true, render: (row) => (row.warrantyUntil ? fmtDate(row.warrantyUntil) : '—') },
    ...(canAssign
      ? [
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            className: 'text-right',
            render: (row: Asset) => (
              <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
                {isStatus(row.status, 'available') && (
                  <Button size="sm" variant="secondary" onClick={() => setAssigning(row)}>
                    <UserCheck className="h-3.5 w-3.5" aria-hidden /> Assign
                  </Button>
                )}
                {isStatus(row.status, 'assigned') && (
                  <Button size="sm" variant="secondary" onClick={() => setReturning(row)}>
                    <Undo2 className="h-3.5 w-3.5" aria-hidden /> Return
                  </Button>
                )}
              </div>
            ),
          } satisfies Column<Asset>,
        ]
      : []),
  ];

  const reload = () => state.reload();

  return (
    <div>
      <PageHeader
        title="Assets"
        description="Track company equipment, who has it and what condition it's in."
        actions={
          canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Add asset
            </Button>
          )
        }
      />
      <Card flush>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search tag, name, serial…" className="sm:w-72" />
          <Select aria-label="Status" placeholder="Any status" value={status} onChange={(e) => setStatus(e.target.value)} options={STATUS_OPTIONS} className="sm:w-40" />
          <Select
            aria-label="Category"
            placeholder="All categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={categories.map((value) => ({ value, label: value }))}
            className="sm:w-44"
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setStatus('');
                setCategory('');
              }}
            >
              Clear filters
            </Button>
          )}
        </FilterBar>
        <Async state={state} loadingLabel="Loading assets…">
          {() => (
            <Table
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              onRowClick={(row) => setViewing(row.id)}
              pageSize={15}
              emptyTitle={hasFilters ? 'No matching assets' : 'No assets yet'}
              emptyDescription={hasFilters ? 'Try adjusting your filters.' : 'Add laptops, phones and other equipment to start tracking them.'}
              emptyAction={
                canManage && !hasFilters ? (
                  <Button size="sm" onClick={() => setCreating(true)}>
                    <Boxes className="h-4 w-4" aria-hidden /> Add asset
                  </Button>
                ) : undefined
              }
            />
          )}
        </Async>
      </Card>

      {creating && <AssetFormModal onClose={() => setCreating(false)} onSaved={reload} />}
      {assigning && <AssignModal asset={assigning} employees={lk.employees} onClose={() => setAssigning(null)} onSaved={reload} />}
      {returning && <ReturnModal asset={returning} onClose={() => setReturning(null)} onSaved={reload} />}
      {viewing && (
        <DetailModal
          assetId={viewing}
          employeeId={user?.employeeId}
          employees={lk.employees}
          onClose={() => setViewing(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
