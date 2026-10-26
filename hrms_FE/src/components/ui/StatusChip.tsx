import { cn } from '../../lib/cn';
import { titleCase } from '../../lib/format';

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'slate' | 'gold';

const toneClasses: Record<Tone, string> = {
  green: 'bg-brand-50 text-brand-700 ring-brand-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  gold: 'bg-gold-50 text-gold-700 ring-gold-200',
};

const statusTone: Record<string, Tone> = {
  active: 'green',
  approved: 'green',
  present: 'green',
  done: 'green',
  completed: 'green',
  available: 'green',
  generated: 'green',
  published: 'green',
  pending: 'amber',
  probation: 'amber',
  in_progress: 'amber',
  late: 'amber',
  half_day: 'amber',
  maintenance: 'amber',
  draft: 'amber',
  medium: 'amber',
  onboarding: 'blue',
  assigned: 'blue',
  todo: 'blue',
  open: 'blue',
  on_leave: 'blue',
  low: 'slate',
  rejected: 'red',
  absent: 'red',
  cancelled: 'slate',
  exited: 'slate',
  inactive: 'slate',
  retired: 'slate',
  lost: 'red',
  high: 'red',
  urgent: 'red',
  notice: 'gold',
  accepted: 'green',
  inside: 'green',
  not_required: 'slate',
  flagged: 'amber',
  outside: 'red',
  accuracy_insufficient: 'amber',
  permission_denied: 'red',
  issued: 'green',
  pending_approval: 'amber',
  blocked: 'red',
  check_in: 'green',
  check_out: 'blue',
  suspended: 'red',
  preview: 'blue',
  failed: 'red',
  returned: 'slate',
};

interface StatusChipProps {
  status: string | null | undefined;
  label?: string;
  className?: string;
}

export function StatusChip({ status, label, className }: StatusChipProps) {
  const key = (status ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  const tone = statusTone[key] ?? 'slate';
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        toneClasses[tone],
        className,
      )}
    >
      {label ?? titleCase(status)}
    </span>
  );
}
