import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Eye, FilePlus2, FileText, Plus, Send } from 'lucide-react';
import { Async } from '../components/ui/Async';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormModal } from '../components/ui/FormModal';
import { Input, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { StatusChip } from '../components/ui/StatusChip';
import { Table, type Column } from '../components/ui/Table';
import { Tabs } from '../components/ui/Tabs';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, getErrorMessage } from '../lib/api';
import { fmtDateTime, titleCase } from '../lib/format';
import { listAll } from '../lib/listAll';
import { isStatus, normGeneratedDocument, normTemplate } from '../lib/normalize';
import { toPayload } from '../lib/payload';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';
import { required, useForm } from '../lib/useForm';
import { EMPTY_LOOKUPS, refName, useLookups, type Lookups } from '../lib/useLookups';
import { PERMISSIONS, type DocumentTemplate, type GeneratedDocument } from '../types';

type TabKey = 'templates' | 'generated';

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;
/** Placeholders under these prefixes are resolved by the server from employee/company records. */
const AUTO_PREFIXES = ['employee.', 'company.', 'tenant.'];

const extractPlaceholders = (body: string): string[] => [...new Set([...body.matchAll(PLACEHOLDER)].map((match) => match[1]))];

function TemplateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const form = useForm({
    name: '',
    code: '',
    bodyTemplate: 'Dear {{employee.full_name}},\n\nThis letter confirms your employment with us effective {{effective_date}}.\n\nRegards,\nHR Team',
  });
  const placeholders = extractPlaceholders(form.values.bodyTemplate);

  return (
    <FormModal
      open
      size="lg"
      title="New document template"
      description="Use {{placeholders}} for values that change per employee."
      submitLabel="Create template"
      submitting={form.submitting}
      error={form.formError}
      onClose={onClose}
      onSubmit={() =>
        form.submit({
          validate: required(['name', 'Name'], ['code', 'Code'], ['bodyTemplate', 'Template body']),
          action: (values) =>
            api.post(
              '/document-templates',
              toPayload({
                name: values.name.trim(),
                code: values.code.trim().toUpperCase(),
                bodyTemplate: values.bodyTemplate,
                requiredFields: extractPlaceholders(values.bodyTemplate),
              }),
            ),
          success: 'Template created',
          onDone: () => {
            onSaved();
            onClose();
          },
        })
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Name" required autoFocus placeholder="Employment letter" {...form.bind('name')} />
        <Input label="Code" required placeholder="EMP-LETTER" {...form.bind('code')} />
      </div>
      <Textarea label="Template body" required rows={9} className="[&_textarea]:font-mono [&_textarea]:text-xs" {...form.bind('bodyTemplate')} />
      <div>
        <p className="field-label">Detected placeholders</p>
        {placeholders.length === 0 ? (
          <p className="text-xs text-slate-500">None yet — wrap field names in double curly braces.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {placeholders.map((name) => (
              <span key={name} className="rounded-full bg-brand-50 px-2 py-0.5 font-mono text-xs text-brand-700 ring-1 ring-inset ring-brand-200">
                {name}
              </span>
            ))}
          </div>
        )}
      </div>
    </FormModal>
  );
}

function PreviewBody({ doc }: { doc: GeneratedDocument }) {
  const preview = doc.preview;
  // Server HTML is flattened to plain text instead of being injected into the page.
  const text = preview?.text ?? (preview?.html ? (new DOMParser().parseFromString(preview.html, 'text/html').body.textContent ?? '') : '');
  return (
    <div className="space-y-3">
      {preview && preview.missing.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Missing values: {preview.missing.join(', ')}</span>
        </div>
      )}
      <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-5 font-sans text-sm leading-relaxed text-slate-800">
        {text || 'No preview available for this document.'}
      </pre>
    </div>
  );
}

function GenerateModal({
  templates,
  lookups,
  canApprove,
  onClose,
  onSaved,
}: {
  templates: DocumentTemplate[];
  lookups: Lookups;
  canApprove: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const form = useForm({ templateId: '', employeeId: '' });
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [generated, setGenerated] = useState<GeneratedDocument | null>(null);
  const [approving, setApproving] = useState(false);

  const template = templates.find((item) => item.id === form.values.templateId);
  const manualFields = (template?.requiredFields ?? []).filter((field) => !AUTO_PREFIXES.some((prefix) => field.startsWith(prefix)));

  if (generated) {
    const approve = async () => {
      setApproving(true);
      try {
        await api.post(`/generated-documents/${generated.id}/approve`);
        toast.success('Document approved');
        onSaved();
        onClose();
      } catch (error) {
        toast.error(getErrorMessage(error));
        setApproving(false);
      }
    };
    return (
      <Modal
        open
        size="lg"
        title="Document generated"
        description={`${template?.name ?? 'Document'} for ${refName(generated.employee, lookups.employees) !== '—' ? refName(generated.employee, lookups.employees) : lookups.employees.find((e) => e.id === form.values.employeeId)?.name}`}
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {canApprove && !isStatus(generated.status, 'approved', 'issued') && (
              <Button onClick={approve} loading={approving}>
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Approve now
              </Button>
            )}
          </>
        }
      >
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
          Status: <StatusChip status={generated.status} />
        </div>
        <PreviewBody doc={generated} />
      </Modal>
    );
  }

  return (
    <FormModal
      open
      size="lg"
      title="Generate document"
      description="Pick a template and an employee, then fill in anything the system can't."
      submitLabel="Generate preview"
      submitting={form.submitting}
      error={form.formError}
      onClose={onClose}
      onSubmit={() =>
        form.submit({
          validate: (values) => {
            const errors = required(['templateId', 'Template'], ['employeeId', 'Employee'])(values);
            manualFields.forEach((field) => {
              if (!extra[field]?.trim()) errors[`field:${field}`] = `${titleCase(field)} is required`;
            });
            return errors;
          },
          action: async (values) => {
            const data = Object.fromEntries(Object.entries(extra).filter(([, value]) => value.trim() !== ''));
            const doc = normGeneratedDocument(
              await api.post<unknown>('/generated-documents', toPayload({ templateId: values.templateId, employeeId: values.employeeId, data, fields: data })),
            );
            setGenerated(doc);
            onSaved();
          },
          success: 'Document generated',
        })
      }
    >
      <Select
        label="Template"
        required
        placeholder="Choose a template"
        options={templates.filter((item) => !item.status || isStatus(item.status, 'active')).map((item) => ({ value: item.id, label: item.name }))}
        {...form.bind('templateId')}
      />
      <Select
        label="Employee"
        required
        placeholder="Choose an employee"
        options={lookups.employees.map((e) => ({ value: e.id, label: `${e.name}${e.employeeNumber ? ` (${e.employeeNumber})` : ''}` }))}
        {...form.bind('employeeId')}
      />
      {manualFields.length > 0 && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Additional details</p>
          {manualFields.map((field) => (
            <Input
              key={field}
              label={titleCase(field)}
              required
              value={extra[field] ?? ''}
              error={form.errors[`field:${field}`]}
              onChange={(event) => {
                setExtra((current) => ({ ...current, [field]: event.target.value }));
                form.setErrors((current) => {
                  const { [`field:${field}`]: _removed, ...rest } = current;
                  return rest;
                });
              }}
            />
          ))}
        </div>
      )}
    </FormModal>
  );
}

function ViewModal({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useApi(async (signal) => normGeneratedDocument(await api.get<unknown>(`/generated-documents/${id}`, undefined, signal)), [id]);
  return (
    <Modal open size="lg" title="Document preview" onClose={onClose}>
      <Async state={state}>
        {(doc) => (
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
              Status: <StatusChip status={doc.status} />
            </div>
            <PreviewBody doc={doc} />
          </div>
        )}
      </Async>
    </Modal>
  );
}

export function DocumentsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.documentManage);
  const canGenerate = hasPermission(PERMISSIONS.documentGenerate);
  const canApprove = hasPermission(PERMISSIONS.documentApprove);

  const [tab, setTab] = useState<TabKey>('generated');
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const { run, isBusy } = useAction();

  const templates = useApi((signal) => listAll('/document-templates', normTemplate, {}, signal), []);
  const generated = useApi((signal) => listAll('/generated-documents', normGeneratedDocument, {}, signal), []);
  const lookups = useLookups(['employees']);
  const lk = lookups.data ?? EMPTY_LOOKUPS;

  const pendingCount = useMemo(
    () => (generated.data ?? []).filter((doc) => isStatus(doc.status, 'draft', 'pending_approval')).length,
    [generated.data],
  );

  const templateColumns: Column<DocumentTemplate>[] = [
    {
      key: 'name',
      header: 'Template',
      render: (row) => (
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-brand-50 p-1.5 text-brand-600">
            <FileText className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="font-medium text-slate-900">{row.name}</p>
            {row.code && <p className="font-mono text-xs text-slate-500">{row.code}</p>}
          </div>
        </div>
      ),
    },
    { key: 'fields', header: 'Fields', hideOnMobile: true, render: (row) => `${row.requiredFields.length} placeholder${row.requiredFields.length === 1 ? '' : 's'}` },
    { key: 'version', header: 'Version', hideOnMobile: true, render: (row) => `v${row.version ?? 1}` },
    { key: 'status', header: 'Status', render: (row) => <StatusChip status={row.status ?? 'active'} /> },
  ];

  const generatedColumns: Column<GeneratedDocument>[] = [
    { key: 'template', header: 'Document', render: (row) => <span className="font-medium text-slate-900">{refName(row.template, templates.data) }</span> },
    { key: 'employee', header: 'Employee', render: (row) => refName(row.employee, lk.employees) },
    { key: 'created', header: 'Created', hideOnMobile: true, render: (row) => fmtDateTime(row.createdAt) },
    { key: 'status', header: 'Status', render: (row) => <StatusChip status={row.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setViewing(row.id)} aria-label="View document">
            <Eye className="h-4 w-4" aria-hidden />
          </Button>
          {canApprove && isStatus(row.status, 'draft', 'pending_approval') && (
            <Button
              size="sm"
              variant="secondary"
              loading={isBusy(`approve-${row.id}`)}
              onClick={() => void run(`approve-${row.id}`, () => api.post(`/generated-documents/${row.id}/approve`), 'Document approved', generated.reload)}
            >
              Approve
            </Button>
          )}
          {(canGenerate || canApprove) && isStatus(row.status, 'approved') && (
            <Button
              size="sm"
              loading={isBusy(`issue-${row.id}`)}
              onClick={() => void run(`issue-${row.id}`, () => api.post(`/generated-documents/${row.id}/issue`), 'Document issued', generated.reload)}
            >
              <Send className="h-3.5 w-3.5" aria-hidden /> Issue
            </Button>
          )}
          {isStatus(row.status, 'issued') && (
            <Button
              size="sm"
              variant="secondary"
              loading={isBusy(`dl-${row.id}`)}
              onClick={() => void run(`dl-${row.id}`, () => api.download(`/generated-documents/${row.id}/download`, undefined, 'document.pdf'))}
              aria-label="Download document"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Letters and certificates generated from approved templates."
        actions={
          <>
            {canManage && tab === 'templates' && (
              <Button variant="secondary" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" aria-hidden /> New template
              </Button>
            )}
            {canGenerate && (
              <Button onClick={() => setGenerating(true)}>
                <FilePlus2 className="h-4 w-4" aria-hidden /> Generate document
              </Button>
            )}
          </>
        }
      />
      <Tabs
        className="mb-5"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'generated', label: 'Generated documents', count: pendingCount },
          { key: 'templates', label: 'Templates' },
        ]}
      />

      {tab === 'generated' && (
        <Card flush>
          <Async state={generated} loadingLabel="Loading documents…">
            {(rows) => (
              <Table
                columns={generatedColumns}
                rows={rows}
                rowKey={(row) => row.id}
                pageSize={12}
                emptyTitle="No documents yet"
                emptyDescription="Generate an employment letter, experience certificate or any template-based document."
                emptyAction={
                  canGenerate ? (
                    <Button size="sm" onClick={() => setGenerating(true)}>
                      <FilePlus2 className="h-4 w-4" aria-hidden /> Generate document
                    </Button>
                  ) : undefined
                }
              />
            )}
          </Async>
        </Card>
      )}

      {tab === 'templates' && (
        <Card flush>
          <Async state={templates} loadingLabel="Loading templates…">
            {(rows) => (
              <Table
                columns={templateColumns}
                rows={rows}
                rowKey={(row) => row.id}
                emptyTitle="No templates yet"
                emptyDescription="Create a template with {{placeholders}} to start generating documents."
                emptyAction={
                  canManage ? (
                    <Button size="sm" onClick={() => setCreating(true)}>
                      <Plus className="h-4 w-4" aria-hidden /> New template
                    </Button>
                  ) : undefined
                }
              />
            )}
          </Async>
        </Card>
      )}

      {creating && <TemplateModal onClose={() => setCreating(false)} onSaved={templates.reload} />}
      {generating && (
        <GenerateModal
          templates={templates.data ?? []}
          lookups={lk}
          canApprove={canApprove}
          onClose={() => setGenerating(false)}
          onSaved={generated.reload}
        />
      )}
      {viewing && <ViewModal id={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
