import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { Async } from '../components/ui/Async';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Avatar, DetailList, FilterBar } from '../components/ui/Misc';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { Table, type Column } from '../components/ui/Table';
import { fmtDateTime, titleCase } from '../lib/format';
import { listAll } from '../lib/listAll';
import { normAudit } from '../lib/normalize';
import { useApi } from '../lib/useApi';
import { useDebounce } from '../lib/useDebounce';
import type { AuditEvent } from '../types';

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <pre className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export function AuditPage() {
  const state = useApi((signal) => listAll('/audit-events', normAudit, {}, signal), []);
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const query = useDebounce(search, 200).trim().toLowerCase();

  const entities = useMemo(() => [...new Set((state.data ?? []).map((e) => e.entityType).filter(Boolean))].sort(), [state.data]);
  const actions = useMemo(() => [...new Set((state.data ?? []).map((e) => e.action).filter(Boolean))].sort(), [state.data]);
  const rows = useMemo(
    () =>
      (state.data ?? [])
        .filter((event) => {
          if (entity && event.entityType !== entity) return false;
          if (action && event.action !== action) return false;
          return !query || [event.action, event.entityType, event.entityId ?? '', event.actor?.name ?? '', event.summary ?? ''].join(' ').toLowerCase().includes(query);
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.data, entity, action, query],
  );
  const hasFilters = Boolean(search || entity || action);

  const columns: Column<AuditEvent>[] = [
    { key: 'when', header: 'When', render: (row) => <span className="whitespace-nowrap text-xs text-slate-600">{fmtDateTime(row.createdAt)}</span> },
    {
      key: 'actor',
      header: 'Actor',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Avatar name={row.actor?.name || 'System'} size="sm" />
          <span>{row.actor?.name || 'System'}</span>
        </div>
      ),
    },
    { key: 'action', header: 'Action', render: (row) => <span className="font-medium text-slate-900">{titleCase(row.action)}</span> },
    { key: 'entity', header: 'Entity', hideOnMobile: true, render: (row) => titleCase(row.entityType) },
    { key: 'summary', header: 'Summary', hideOnMobile: true, render: (row) => <span className="line-clamp-1 max-w-xs text-slate-500">{row.summary || row.entityId || '—'}</span> },
  ];

  return (
    <div>
      <PageHeader title="Audit log" description="A tamper-evident record of important changes across the workspace." />
      <Card flush>
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search actor, action, entity…" className="sm:w-72" />
          <Select aria-label="Entity" placeholder="All entities" value={entity} onChange={(e) => setEntity(e.target.value)} options={entities.map((value) => ({ value, label: titleCase(value) }))} className="sm:w-44" />
          <Select aria-label="Action" placeholder="All actions" value={action} onChange={(e) => setAction(e.target.value)} options={actions.map((value) => ({ value, label: titleCase(value) }))} className="sm:w-44" />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setEntity('');
                setAction('');
              }}
            >
              Clear filters
            </Button>
          )}
        </FilterBar>
        <Async state={state} loadingLabel="Loading audit events…">
          {() => (
            <Table
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              onRowClick={setSelected}
              pageSize={20}
              emptyTitle={hasFilters ? 'No matching events' : 'No audit events yet'}
              emptyDescription={hasFilters ? 'Try adjusting your filters.' : 'Changes made in the workspace will be recorded here.'}
            />
          )}
        </Async>
      </Card>

      <Modal open={Boolean(selected)} size="lg" title="Audit event" description={selected ? fmtDateTime(selected.createdAt) : undefined} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4">
            <DetailList
              items={[
                { label: 'Actor', value: selected.actor?.name || 'System' },
                { label: 'Action', value: titleCase(selected.action) },
                { label: 'Entity', value: titleCase(selected.entityType) },
                { label: 'Entity ID', value: selected.entityId ? <span className="break-all font-mono text-xs">{selected.entityId}</span> : undefined },
                { label: 'IP address', value: selected.ipAddress },
                { label: 'Summary', value: selected.summary },
              ]}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <JsonBlock label="Before" value={selected.oldValues} />
              <JsonBlock label="After" value={selected.newValues} />
            </div>
            {selected.oldValues == null && selected.newValues == null && (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <History className="h-4 w-4" aria-hidden /> No field-level changes were recorded for this event.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
