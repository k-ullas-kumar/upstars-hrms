import { format, isValid, parseISO } from 'date-fns';

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : parseISO(value);
  return isValid(date) ? date : null;
}

export function fmtDate(value: string | Date | null | undefined, pattern = 'dd MMM yyyy'): string {
  const date = toDate(value);
  return date ? format(date, pattern) : '—';
}

export function fmtDateTime(value: string | Date | null | undefined): string {
  return fmtDate(value, 'dd MMM yyyy, HH:mm');
}

export function fmtTime(value: string | Date | null | undefined): string {
  return fmtDate(value, 'HH:mm');
}

export function fmtDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Local-calendar day bounds as ISO datetimes (avoids UTC midnight cutting off early IST punches). */
export function localDayBoundsIso(day = todayIso()): { from: string; to: string } {
  const [y, m, d] = day.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function greeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
