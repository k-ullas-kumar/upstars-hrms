import { differenceInSeconds, isValid, parseISO } from 'date-fns';
import type { AttendanceEvent } from '../types';

export function sortAttendanceAsc(events: AttendanceEvent[]): AttendanceEvent[] {
  return [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/** Open check-in means the last unmatched event is a check-in. */
export function isCheckedIn(events: AttendanceEvent[]): boolean {
  let open = false;
  for (const event of sortAttendanceAsc(events)) {
    if (event.type === 'check_in') open = true;
    else if (event.type === 'check_out') open = false;
  }
  return open;
}

/** Total worked seconds today; open check-in counts up to `now`. */
export function workedSeconds(events: AttendanceEvent[], now: Date): number {
  let total = 0;
  let openSince: Date | null = null;
  for (const event of sortAttendanceAsc(events)) {
    const at = parseISO(event.timestamp);
    if (!isValid(at)) continue;
    if (event.type === 'check_in') {
      openSince ??= at;
    } else if (openSince) {
      total += Math.max(0, differenceInSeconds(at, openSince));
      openSince = null;
    }
  }
  if (openSince) total += Math.max(0, differenceInSeconds(now, openSince));
  return total;
}

export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export const ATTENDANCE_CHANGED_EVENT = 'hrms:attendance-changed';

export function notifyAttendanceChanged(): void {
  window.dispatchEvent(new Event(ATTENDANCE_CHANGED_EVENT));
}
