import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  ATTENDANCE_CHANGED_EVENT,
  formatElapsed,
  isCheckedIn,
  workedSeconds,
} from '../lib/attendanceTime';
import { localDayBoundsIso } from '../lib/format';
import { listAll } from '../lib/listAll';
import { asRec, bool, normAttendanceEvent } from '../lib/normalize';
import type { AttendanceEvent } from '../types';

export interface TodaySession {
  events: AttendanceEvent[];
  checkedIn: boolean;
  elapsedLabel: string;
  loading: boolean;
  refresh: () => Promise<void>;
}

interface StatusPayload {
  checked_in?: boolean;
  checkedIn?: boolean;
  last_event?: unknown;
  lastEvent?: unknown;
}

function mergeLastEvent(rows: AttendanceEvent[], lastRaw: unknown): AttendanceEvent[] {
  if (lastRaw == null) return rows;
  const last = normAttendanceEvent(lastRaw);
  if (!last.id) return rows;
  if (rows.some((row) => row.id === last.id)) return rows;
  return [...rows, last];
}

/** Live today-session timer for the signed-in employee (header / logout). */
export function useTodaySession(): TodaySession {
  const { user } = useAuth();
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const refresh = useCallback(async () => {
    if (!user?.employeeId) {
      setEvents([]);
      setCheckedIn(false);
      return;
    }
    setLoading(true);
    try {
      const day = localDayBoundsIso();
      const [statusRaw, rows] = await Promise.all([
        api.get<StatusPayload>('/attendance/status'),
        listAll('/attendance/events', normAttendanceEvent, { from: day.from, to: day.to, limit: 100 }),
      ]);
      const status = asRec(statusRaw);
      const fromStatus = bool(status, 'checked_in', 'checkedIn');
      const merged = mergeLastEvent(rows, status.last_event ?? status.lastEvent);
      setEvents(merged);
      setCheckedIn(fromStatus ?? isCheckedIn(merged));
    } catch {
      // Keep last known session if refresh fails.
    } finally {
      setLoading(false);
    }
  }, [user?.employeeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(ATTENDANCE_CHANGED_EVENT, onChange);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    const poll = window.setInterval(() => void refresh(), 15_000);
    return () => {
      window.removeEventListener(ATTENDANCE_CHANGED_EVENT, onChange);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(poll);
    };
  }, [refresh]);

  useEffect(() => {
    if (!checkedIn) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [checkedIn]);

  const elapsedLabel = formatElapsed(workedSeconds(events, now));

  return { events, checkedIn, elapsedLabel, loading, refresh };
}
