import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

/** Eases a number from 0 to `target` for a subtle "counting up" effect. */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || target === 0) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}

type KpiTone = 'brand' | 'gold' | 'navy';

const toneStyles: Record<KpiTone, string> = {
  brand: 'bg-brand-50 text-brand-600',
  gold: 'bg-gold-50 text-gold-600',
  navy: 'bg-navy-50 text-navy-600',
};

interface KpiCardProps {
  label: string;
  value: number | string | undefined;
  icon: LucideIcon;
  tone?: KpiTone;
  hint?: string;
  to?: string;
  delayMs?: number;
}

function CountValue({ value }: { value: number }) {
  const animated = useCountUp(value);
  return <>{animated.toLocaleString()}</>;
}

export function KpiCard({ label, value, icon: Icon, tone = 'brand', hint, to, delayMs = 0 }: KpiCardProps) {
  const body = (
    <div
      className="card card-hover relative h-full animate-fade-up overflow-hidden p-4"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-navy">
            {typeof value === 'number' ? <CountValue value={value} /> : (value ?? '—')}
          </p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        <span className={cn('rounded-lg p-2.5', toneStyles[tone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <span className={cn('absolute inset-x-0 bottom-0 h-0.5', tone === 'gold' ? 'bg-gold' : tone === 'navy' ? 'bg-navy' : 'bg-brand-500')} aria-hidden />
    </div>
  );
  return to ? (
    <Link to={to} className="block rounded-lg focus-visible:ring-offset-2">
      {body}
    </Link>
  ) : (
    body
  );
}
