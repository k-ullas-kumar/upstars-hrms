/** Pure date/leave helpers. Dates are ISO `YYYY-MM-DD` strings (lexicographic order == chronological). */

export const ACTIVE_LEAVE_STATUSES = ['PENDING', 'APPROVED'] as const;

export interface DateRange {
  start_date: string;
  end_date: string;
}

export interface LeaveLike extends DateRange {
  id?: string;
  status: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Inclusive range overlap. */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start_date <= b.end_date && b.start_date <= a.end_date;
}

/** Returns existing PENDING/APPROVED requests that overlap the candidate (ignoring `candidate.id`). */
export function findOverlappingLeave<T extends LeaveLike>(
  existing: T[],
  candidate: DateRange & { id?: string },
): T[] {
  return existing.filter(
    (r) =>
      r.id !== candidate.id &&
      (ACTIVE_LEAVE_STATUSES as readonly string[]).includes(r.status) &&
      rangesOverlap(r, candidate),
  );
}

/** Counts Mon-Fri days in the inclusive range. */
export function countWeekdays(start: string, end: string): number {
  if (!isIsoDate(start) || !isIsoDate(end) || end < start) return 0;
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  let count = 0;
  while (cursor <= last) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/** Number of calendar days in the inclusive range. */
export function countCalendarDays(start: string, end: string): number {
  const ms = new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
