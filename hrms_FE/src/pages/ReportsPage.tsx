import { useState } from 'react';
import { format, startOfMonth } from 'date-fns';
import { CalendarCheck, CalendarDays, Download, Lock, Users, Boxes, type LucideIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, getErrorMessage } from '../lib/api';
import { todayIso } from '../lib/format';
import { PERMISSIONS } from '../types';

interface ReportDef {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Whether the report honours a from/to date range. */
  ranged: boolean;
}

const REPORTS: ReportDef[] = [
  { slug: 'employees', title: 'Employee directory', description: 'Everyone in the organisation with department, designation, manager and status.', icon: Users, ranged: false },
  { slug: 'attendance', title: 'Attendance', description: 'Daily check-in and check-out records, including flagged entries.', icon: CalendarCheck, ranged: true },
  { slug: 'leave', title: 'Leave requests', description: 'Leave requests with type, duration, approver and decision.', icon: CalendarDays, ranged: true },
  { slug: 'assets', title: 'Asset register', description: 'All assets with status, condition and current assignee.', icon: Boxes, ranged: false },
];

export function ReportsPage() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const canExport = hasPermission(PERMISSIONS.reportExport);
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to, setTo] = useState(todayIso());
  const [busy, setBusy] = useState<string | null>(null);
  const rangeInvalid = Boolean(from && to && to < from);

  const download = async (report: ReportDef) => {
    setBusy(report.slug);
    try {
      await api.download(
        `/reports/${report.slug}.csv`,
        report.ranged ? { from, to } : undefined,
        `${report.slug}-${todayIso()}.csv`,
      );
      toast.success(`${report.title} report downloaded`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Download failed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="Reports" description="Export your workforce data as CSV. Every export is recorded in the audit log." />

      <Card className="mb-5" title="Date range">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="From" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
          <Input
            label="To"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
            error={rangeInvalid ? 'End date must be after the start date' : undefined}
          />
          <p className="self-end pb-2 text-xs text-slate-500">Applies to attendance and leave reports.</p>
        </div>
      </Card>

      {!canExport && (
        <div className="mb-5 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <Lock className="h-4 w-4 text-slate-400" aria-hidden /> You can view reports but don't have permission to export them.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {REPORTS.map((report, index) => (
          <div key={report.slug} className="card card-hover flex animate-fade-up flex-col p-5" style={{ animationDelay: `${index * 70}ms` }}>
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-brand-50 p-2.5 text-brand-600">
                <report.icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-semibold text-navy">{report.title}</h3>
                <p className="mt-0.5 text-sm text-slate-500">{report.description}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs text-slate-400">CSV{report.ranged ? ` · ${from || '…'} → ${to || '…'}` : ''}</span>
              <Button
                variant="secondary"
                size="sm"
                disabled={!canExport || (report.ranged && rangeInvalid)}
                loading={busy === report.slug}
                onClick={() => void download(report)}
              >
                <Download className="h-4 w-4" aria-hidden /> Download
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
