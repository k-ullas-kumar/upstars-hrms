import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { initials } from '../../lib/format';

/** Wrapping row for search + filter controls above a table. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-b border-slate-200 bg-white p-3 transition-all sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
    >
      {children}
    </div>
  );
}

const AVATAR_TONES = ['bg-navy text-white', 'bg-brand-600 text-white', 'bg-gold text-navy', 'bg-navy-500 text-white'];

export function Avatar({ name, size = 'md' }: { name: string | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const seed = (name ?? '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const dimension = size === 'sm' ? 'h-7 w-7 text-[11px]' : size === 'lg' ? 'h-16 w-16 text-xl' : 'h-9 w-9 text-xs';
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        dimension,
        AVATAR_TONES[seed % AVATAR_TONES.length],
      )}
    >
      {initials(name)}
    </span>
  );
}

export function DetailList({ items, columns = 2 }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3 }) {
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-4',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      )}
    >
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</dt>
          <dd className="mt-0.5 text-sm text-slate-800">{item.value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const tone = percent > 85 ? 'bg-red-500' : percent > 60 ? 'bg-gold' : 'bg-brand-500';
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-slate-100', className)} role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all duration-700 ease-out', tone)} style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Small inline segmented switch, e.g. "Pending / All". */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 bg-slate-100 p-0.5" role="group">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          onClick={() => onChange(option.key)}
          className={cn(
            'rounded px-3 py-1 text-xs font-medium transition-colors',
            value === option.key ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
