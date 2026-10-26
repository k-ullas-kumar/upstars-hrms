import { useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Table, type Column } from '../../components/ui/Table';
import { useToast } from '../../context/ToastContext';
import { api, getErrorMessage } from '../../lib/api';
import { cn } from '../../lib/cn';
import { downloadTextFile, parseCsv } from '../../lib/csv';
import { normImportPreview, normImportResult } from '../../lib/normalize';
import { toPayload } from '../../lib/payload';
import type { ImportPreview, ImportPreviewRow, ImportResult } from '../../types';

const TEMPLATE_HEADERS = [
  'employee_number',
  'full_name',
  'work_email',
  'phone',
  'joining_date',
  'department',
  'designation',
  'branch',
  'manager_email',
];
const REQUIRED_HEADERS = ['full_name', 'work_email', 'joining_date'];
const MAX_BYTES = 5 * 1024 * 1024;

type Step = 'upload' | 'review' | 'done';

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
];

function Stepper({ step }: { step: Step }) {
  const current = STEPS.findIndex((item) => item.key === step);
  return (
    <ol className="mb-5 flex items-center gap-2">
      {STEPS.map((item, index) => (
        <li key={item.key} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
              index < current && 'bg-brand-600 text-white',
              index === current && 'bg-gold text-navy',
              index > current && 'bg-slate-200 text-slate-500',
            )}
          >
            {index < current ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : index + 1}
          </span>
          <span className={cn('text-sm font-medium', index <= current ? 'text-navy' : 'text-slate-400')}>{item.label}</span>
          {index < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

/** Local fallback when the server preview does not echo parsed rows. */
function localRows(table: string[][]): ImportPreviewRow[] {
  const [header, ...body] = table;
  if (!header) return [];
  const keys = header.map((cell) => cell.trim());
  return body.map((cells, index) => ({
    row: index + 1,
    values: Object.fromEntries(keys.map((key, i) => [key, cells[i]?.trim() ?? ''])),
    errors: [],
  }));
}

export function ImportEmployeesPage() {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [table, setTable] = useState<string[][]>([]);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setTable([]);
    setPreview(null);
    setResult(null);
    setFileError(null);
  };

  const acceptFile = async (candidate: File | undefined) => {
    if (!candidate) return;
    setFileError(null);
    if (!/\.csv$/i.test(candidate.name)) {
      setFileError('Please choose a .csv file.');
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setFileError('The file is larger than 5 MB.');
      return;
    }
    const parsed = parseCsv(await candidate.text());
    const headers = (parsed[0] ?? []).map((cell) => cell.trim().toLowerCase());
    const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
    if (parsed.length < 2) {
      setFileError('The file has no data rows.');
      return;
    }
    if (missing.length > 0) {
      setFileError(`Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`);
      return;
    }
    setFile(candidate);
    setTable(parsed);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void acceptFile(event.dataTransfer.files[0]);
  };

  const buildForm = () => {
    const form = new FormData();
    if (file) form.append('file', file);
    return form;
  };

  const runPreview = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const data = normImportPreview(await api.post<unknown>('/imports/employees/preview', buildForm()));
      setPreview({ ...data, rows: data.rows.length > 0 ? data.rows : localRows(table), total: data.total || table.length - 1 });
      setStep('review');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not preview the file'));
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!file || !preview) return;
    setBusy(true);
    try {
      const body = preview.importId ? toPayload({ importId: preview.importId }) : buildForm();
      const outcome = normImportResult(await api.post<unknown>('/imports/employees/confirm', body));
      setResult(outcome);
      setStep('done');
      toast.success(`Imported ${outcome.created} employee${outcome.created === 1 ? '' : 's'}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Import failed'));
    } finally {
      setBusy(false);
    }
  };

  const previewColumns: Column<ImportPreviewRow>[] = [
    { key: 'row', header: '#', className: 'w-12', render: (row) => <span className="text-xs text-slate-500">{row.row}</span> },
    { key: 'name', header: 'Name', render: (row) => row.values.full_name || row.values.name || '—' },
    { key: 'email', header: 'Email', render: (row) => row.values.work_email || row.values.email || '—' },
    { key: 'joining', header: 'Joining', hideOnMobile: true, render: (row) => row.values.joining_date || '—' },
    { key: 'dept', header: 'Department', hideOnMobile: true, render: (row) => row.values.department || '—' },
    {
      key: 'state',
      header: 'Result',
      render: (row) =>
        row.errors.length === 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Ready
          </span>
        ) : (
          <span className="text-xs font-medium text-red-600">{row.errors.join('; ')}</span>
        ),
    },
  ];

  return (
    <div>
      <Link to="/people/employees" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All employees
      </Link>
      <PageHeader
        title="Import employees"
        description="Bring people in from a CSV. You'll review every row before anything is saved."
        actions={
          <Button
            variant="secondary"
            onClick={() => downloadTextFile('employee-import-template.csv', `${TEMPLATE_HEADERS.join(',')}\nEMP-1001,Asha Rao,asha@example.com,+91 90000 00000,2026-01-15,Engineering,Developer,Bengaluru,\n`)}
          >
            <Download className="h-4 w-4" aria-hidden /> Download template
          </Button>
        }
      />
      <Stepper step={step} />

      {step === 'upload' && (
        <Card>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-12 text-center transition-colors',
              dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50',
            )}
          >
            {file ? (
              <>
                <FileSpreadsheet className="h-10 w-10 text-brand-600" aria-hidden />
                <p className="mt-3 text-sm font-medium text-navy">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {table.length - 1} data row{table.length - 1 === 1 ? '' : 's'} · {(file.size / 1024).toFixed(1)} KB
                </p>
              </>
            ) : (
              <>
                <UploadCloud className="h-10 w-10 text-slate-400" aria-hidden />
                <p className="mt-3 text-sm font-medium text-slate-700">Drag and drop your CSV here</p>
                <p className="text-xs text-slate-500">Required columns: {REQUIRED_HEADERS.join(', ')}</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => void acceptFile(event.target.files?.[0])}
            />
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                {file ? 'Choose a different file' : 'Browse files'}
              </Button>
              {file && (
                <Button onClick={runPreview} loading={busy}>
                  Preview import
                </Button>
              )}
            </div>
          </div>
          {fileError && (
            <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" aria-hidden /> {fileError}
            </p>
          )}
        </Card>
      )}

      {step === 'review' && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Rows', value: preview.total, tone: 'text-navy' },
              { label: 'Ready', value: preview.valid, tone: 'text-brand-700' },
              { label: 'Need attention', value: preview.invalid, tone: preview.invalid > 0 ? 'text-red-600' : 'text-slate-400' },
            ].map((stat) => (
              <div key={stat.label} className="card animate-fade-up p-4 text-center">
                <p className={cn('text-2xl font-semibold', stat.tone)}>{stat.value}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>

          {preview.errors.length > 0 && (
            <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">Some rows have problems and will be skipped:</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {preview.errors.slice(0, 8).map((error, index) => (
                  <li key={index}>
                    {error.row ? `Row ${error.row}: ` : ''}
                    {error.message}
                  </li>
                ))}
                {preview.errors.length > 8 && <li>…and {preview.errors.length - 8} more</li>}
              </ul>
            </div>
          )}

          <Card flush>
            <Table columns={previewColumns} rows={preview.rows} rowKey={(row) => String(row.row)} pageSize={10} />
          </Card>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={reset} disabled={busy}>
              Start over
            </Button>
            <Button onClick={confirmImport} loading={busy} disabled={preview.valid === 0}>
              Import {preview.valid} employee{preview.valid === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <Card>
          <div className="flex flex-col items-center py-8 text-center">
            <span className="rounded-full bg-brand-50 p-3 text-brand-600">
              <CheckCircle2 className="h-9 w-9" aria-hidden />
            </span>
            <h2 className="mt-3 text-lg font-semibold">Import complete</h2>
            <p className="mt-1 text-sm text-slate-500">
              {result.created} created{result.skipped > 0 ? ` · ${result.skipped} skipped` : ''}
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-left text-xs text-slate-500">
                {result.errors.slice(0, 5).map((error, index) => (
                  <li key={index}>
                    Row {error.row}: {error.message}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 flex gap-2">
              <Button variant="secondary" onClick={reset}>
                Import another file
              </Button>
              <Link to="/people/employees">
                <Button>View employees</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
