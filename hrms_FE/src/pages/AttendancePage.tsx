import { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInMinutes, format, isValid, parseISO, subDays } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  MapPinOff,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { Async } from '../components/ui/Async';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DecisionModal } from '../components/ui/DecisionModal';
import { EmptyState } from '../components/ui/EmptyState';
import { FormModal } from '../components/ui/FormModal';
import { Input, Textarea } from '../components/ui/Input';
import { Avatar, FilterBar } from '../components/ui/Misc';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { StatusChip } from '../components/ui/StatusChip';
import { Table, type Column } from '../components/ui/Table';
import { Tabs } from '../components/ui/Tabs';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, getErrorMessage } from '../lib/api';
import { notifyAttendanceChanged } from '../lib/attendanceTime';
import { cn } from '../lib/cn';
import { fmtDate, fmtDuration, fmtTime, localDayBoundsIso, titleCase, todayIso } from '../lib/format';
import { listAll } from '../lib/listAll';
import { isStatus, normAttendanceEvent, normCorrection } from '../lib/normalize';
import { toPayload } from '../lib/payload';
import { useApi } from '../lib/useApi';
import { required, useForm } from '../lib/useForm';
import { EMPTY_LOOKUPS, refName, useLookups } from '../lib/useLookups';
import { PERMISSIONS, type AttendanceCorrection, type AttendanceDay, type AttendanceEvent } from '../types';

type TabKey = 'today' | 'history' | 'corrections' | 'approvals' | 'team';

const GEO_ACK_KEY = 'hrms_geo_ack';

/* ------------------------------ Helpers ------------------------------ */

const dayKey = (timestamp: string): string => {
  const date = parseISO(timestamp);
  return isValid(date) ? format(date, 'yyyy-MM-dd') : '';
};

function sortAsc(events: AttendanceEvent[]): AttendanceEvent[] {
  return [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/** Sums time between each check-in and the next check-out; an open check-in runs until `now`. */
function workedMinutes(events: AttendanceEvent[], now: Date): number {
  let total = 0;
  let openSince: Date | null = null;
  sortAsc(events).forEach((event) => {
    const at = parseISO(event.timestamp);
    if (!isValid(at)) return;
    if (event.type === 'check_in') {
      openSince ??= at;
    } else if (openSince) {
      total += Math.max(0, differenceInMinutes(at, openSince));
      openSince = null;
    }
  });
  if (openSince) total += Math.max(0, differenceInMinutes(now, openSince));
  return total;
}

function groupByDay(events: AttendanceEvent[], now: Date): AttendanceDay[] {
  const groups = new Map<string, AttendanceEvent[]>();
  events.forEach((event) => {
    const key = dayKey(event.timestamp);
    if (key) groups.set(key, [...(groups.get(key) ?? []), event]);
  });
  return [...groups.entries()]
    .map(([date, dayEvents]) => {
      const ordered = sortAsc(dayEvents);
      const firstIn = ordered.find((event) => event.type === 'check_in')?.timestamp ?? null;
      const lastOut = [...ordered].reverse().find((event) => event.type === 'check_out')?.timestamp ?? null;
      return { date, firstIn, lastOut, workedMinutes: workedMinutes(ordered, date === todayIso() ? now : parseISO(`${date}T23:59:59`)), events: ordered };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

const LOCATION_COPY: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'muted' }> = {
  inside: { label: 'Inside approved work zone', tone: 'ok' },
  outside: { label: 'Outside approved work zone — flagged for review', tone: 'bad' },
  accuracy_insufficient: { label: 'GPS accuracy too low to verify', tone: 'warn' },
  permission_denied: { label: 'Location permission denied', tone: 'warn' },
  not_required: { label: 'Location not required', tone: 'muted' },
};

type GeoOutcome =
  | { kind: 'ok'; latitude: number; longitude: number; accuracy: number }
  | { kind: 'denied' }
  | { kind: 'unavailable' };

function requestPosition(): Promise<GeoOutcome> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ kind: 'unavailable' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          kind: 'ok',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) => resolve({ kind: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    );
  });
}

type GeoPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

function useGeoPermission(): GeoPermission {
  const [state, setState] = useState<GeoPermission>('prompt');
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setState('unsupported');
      return;
    }
    if (!('permissions' in navigator)) return;
    let status: PermissionStatus | null = null;
    let active = true;
    const sync = () => status && active && setState(status.state);
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((result) => {
        status = result;
        sync();
        result.addEventListener('change', sync);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      status?.removeEventListener('change', sync);
    };
  }, []);
  return state;
}

function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/* --------------------------- Check-in card --------------------------- */

interface PunchResult {
  type: 'check_in' | 'check_out';
  at: string;
  locationStatus?: string | null;
  flagged: boolean;
}

function LocationPrompt({ onChoose, onClose }: { onChoose: (share: boolean) => void; onClose: () => void }) {
  return (
    <Modal
      open
      size="md"
      title="Share your location?"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => onChoose(false)}>
            Continue without location
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => onChoose(true)}>
            <MapPin className="h-4 w-4" aria-hidden /> Allow &amp; continue
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-600">
        <p>
          Your company may require attendance to be recorded at an approved work site. To verify this, we read your
          location <strong className="text-navy">once</strong>, at the moment you check in or out.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
          <li>We never track you in the background.</li>
          <li>Only a pass/fail verification and the coordinates for that punch are stored.</li>
          <li>You can decline, but the entry may be flagged for review.</li>
        </ul>
      </div>
    </Modal>
  );
}

function PunchCard({
  todayEvents,
  canPunch,
  onPunched,
}: {
  todayEvents: AttendanceEvent[];
  canPunch: boolean;
  onPunched: () => void;
}) {
  const toast = useToast();
  const now = useNow();
  const geoPermission = useGeoPermission();
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [result, setResult] = useState<PunchResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [askLocation, setAskLocation] = useState(false);

  const ordered = useMemo(() => sortAsc(todayEvents), [todayEvents]);
  const last = ordered[ordered.length - 1];
  const checkedIn = last?.type === 'check_in';
  const minutes = workedMinutes(ordered, now);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const secs = checkedIn ? now.getSeconds() : 0;
  const firstIn = ordered.find((event) => event.type === 'check_in');

  const punch = async (share: boolean) => {
    const endpoint = checkedIn ? '/attendance/check-out' : '/attendance/check-in';
    setBusy(true);
    setProblem(null);
    setResult(null);
    try {
      let geo: GeoOutcome = { kind: 'unavailable' };
      if (share) {
        setLocating(true);
        geo = await requestPosition();
        setLocating(false);
        if (geo.kind === 'denied') toast.info('Location was blocked, so this entry may be flagged for review.');
      }
      const body = toPayload({
        source: 'WEB',
        latitude: geo.kind === 'ok' ? geo.latitude : undefined,
        longitude: geo.kind === 'ok' ? geo.longitude : undefined,
        accuracyMeters: geo.kind === 'ok' ? Math.round(geo.accuracy) : undefined,
      });
      const event = normAttendanceEvent(await api.post<unknown>(endpoint, body));
      const flagged = isStatus(event.status, 'flagged', 'rejected') || isStatus(event.locationStatus, 'outside');
      setResult({
        type: checkedIn ? 'check_out' : 'check_in',
        at: event.timestamp || new Date().toISOString(),
        locationStatus: event.locationStatus,
        flagged,
      });
      toast.success(checkedIn ? 'Checked out. Have a great evening!' : 'Checked in. Have a productive day!');
      onPunched();
      notifyAttendanceChanged();
    } catch (error) {
      setLocating(false);
      const message = getErrorMessage(error, 'Could not record attendance');
      setProblem(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const onPress = () => {
    if (geoPermission === 'unsupported' || geoPermission === 'denied') {
      void punch(false);
    } else if (geoPermission === 'prompt' && localStorage.getItem(GEO_ACK_KEY) !== '1') {
      setAskLocation(true);
    } else {
      void punch(true);
    }
  };

  const geoNote =
    geoPermission === 'granted'
      ? { icon: MapPin, text: 'Location access allowed', tone: 'text-brand-700' }
      : geoPermission === 'denied'
        ? { icon: MapPinOff, text: 'Location blocked in your browser — entries may be flagged', tone: 'text-amber-700' }
        : geoPermission === 'unsupported'
          ? { icon: MapPinOff, text: 'Location is not available on this device', tone: 'text-slate-500' }
          : { icon: MapPin, text: "We'll ask for your location when you punch", tone: 'text-slate-500' };
  const GeoIcon = geoNote.icon;
  const locationInfo = result?.locationStatus ? LOCATION_COPY[result.locationStatus.toLowerCase()] : undefined;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col items-center py-4 text-center">
        <p className="text-sm font-medium text-slate-500">{format(now, 'EEEE, d MMMM')}</p>
        <p className="mt-1 font-mono text-4xl font-semibold tracking-tight text-navy tabular-nums">{format(now, 'HH:mm:ss')}</p>

        <button
          type="button"
          onClick={onPress}
          disabled={!canPunch || busy}
          aria-label={checkedIn ? 'Check out' : 'Check in'}
          className={cn(
            'relative mt-6 flex h-44 w-44 flex-col items-center justify-center gap-1 rounded-full text-white shadow-lift transition-transform duration-200 hover:scale-[1.04] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100',
            checkedIn
              ? 'bg-gradient-to-br from-navy-500 to-navy ring-4 ring-gold/60'
              : 'bg-gradient-to-br from-brand-400 to-brand-700 ring-4 ring-brand-200',
            !busy && canPunch && !checkedIn && 'animate-pulse-ring',
          )}
        >
          {busy ? (
            <>
              <Clock className="h-9 w-9 animate-spin" aria-hidden />
              <span className="text-sm font-medium">{locating ? 'Locating…' : 'Saving…'}</span>
            </>
          ) : checkedIn ? (
            <>
              <LogOut className="h-9 w-9" aria-hidden />
              <span className="text-lg font-semibold">Check out</span>
            </>
          ) : (
            <>
              <LogIn className="h-9 w-9" aria-hidden />
              <span className="text-lg font-semibold">{last ? 'Check in again' : 'Check in'}</span>
            </>
          )}
        </button>

        {!canPunch && <p className="mt-3 text-xs text-slate-500">Your role can't record attendance.</p>}

        <div className="mt-6 grid w-full max-w-sm grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">First in</p>
            <p className="mt-0.5 text-sm font-semibold text-navy">{firstIn ? fmtTime(firstIn.timestamp) : '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Worked</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-navy">
              {String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}
              <span className="text-slate-400">:{String(secs).padStart(2, '0')}</span>
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Status</p>
            <p className="mt-0.5 text-sm font-semibold text-navy">{checkedIn ? 'On shift' : last ? 'Off shift' : 'Not in'}</p>
          </div>
        </div>

        <p className={cn('mt-4 inline-flex items-center gap-1.5 text-xs', geoNote.tone)}>
          <GeoIcon className="h-3.5 w-3.5" aria-hidden /> {geoNote.text}
        </p>

        {result && (
          <div
            role="status"
            className={cn(
              'mt-4 w-full max-w-sm animate-scale-in rounded-lg border p-3 text-left text-sm',
              result.flagged ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-brand-200 bg-brand-50 text-brand-900',
            )}
          >
            <p className="flex items-center gap-2 font-medium">
              {result.flagged ? <AlertTriangle className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
              {result.type === 'check_in' ? 'Checked in' : 'Checked out'} at {fmtTime(result.at)}
            </p>
            {locationInfo && <p className="mt-1 text-xs">{locationInfo.label}</p>}
            {result.flagged && (
              <p className="mt-1 text-xs">This entry was flagged. Your manager may review it, or you can request a correction.</p>
            )}
          </div>
        )}
        {problem && (
          <p role="alert" className="mt-4 flex max-w-sm items-start gap-2 text-left text-sm text-red-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {problem}
          </p>
        )}
      </div>

      {askLocation && (
        <LocationPrompt
          onClose={() => setAskLocation(false)}
          onChoose={(share) => {
            localStorage.setItem(GEO_ACK_KEY, '1');
            setAskLocation(false);
            void punch(share);
          }}
        />
      )}
    </Card>
  );
}

function Timeline({ events }: { events: AttendanceEvent[] }) {
  const ordered = sortAsc(events);
  if (ordered.length === 0) {
    return <EmptyState icon={Clock} title="No activity yet today" description="Your check-ins and check-outs will appear here." />;
  }
  return (
    <ol className="relative ml-3 space-y-5 border-l-2 border-slate-200 py-1 pl-6">
      {ordered.map((event) => {
        const isIn = event.type === 'check_in';
        const location = event.locationStatus ? LOCATION_COPY[event.locationStatus.toLowerCase()] : undefined;
        return (
          <li key={event.id || event.timestamp} className="relative animate-fade-up">
            <span
              className={cn(
                'absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full text-white ring-4 ring-white',
                isIn ? 'bg-brand-600' : 'bg-navy',
              )}
            >
              {isIn ? <LogIn className="h-3 w-3" aria-hidden /> : <LogOut className="h-3 w-3" aria-hidden />}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-navy">{isIn ? 'Checked in' : 'Checked out'}</p>
              <span className="text-sm tabular-nums text-slate-600">{fmtTime(event.timestamp)}</span>
              {event.status && !isStatus(event.status, 'accepted') && <StatusChip status={event.status} />}
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              {location ? (
                <>
                  <ShieldCheck className={cn('h-3.5 w-3.5', location.tone === 'ok' ? 'text-brand-600' : location.tone === 'bad' ? 'text-red-500' : 'text-slate-400')} aria-hidden />
                  {location.label}
                </>
              ) : (
                titleCase(event.source)
              )}
              {event.note ? ` · ${event.note}` : ''}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/* ----------------------------- Corrections ----------------------------- */

function CorrectionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const form = useForm({ date: todayIso(), eventType: 'CHECK_IN', time: '09:00', reason: '' });
  return (
    <FormModal
      open
      title="Request a correction"
      description="Missed a punch or recorded the wrong time? Ask your manager to fix it."
      submitLabel="Submit request"
      submitting={form.submitting}
      error={form.formError}
      onClose={onClose}
      onSubmit={() =>
        form.submit({
          validate: (values) => {
            const errors = required(['date', 'Date'], ['time', 'Time'], ['reason', 'Reason'])(values);
            if (!errors.date && values.date > todayIso()) errors.date = 'Date cannot be in the future';
            return errors;
          },
          action: (values) =>
            api.post(
              '/attendance/corrections',
              toPayload({
                date: values.date,
                proposedEventType: values.eventType,
                proposedTimestamp: new Date(`${values.date}T${values.time}`).toISOString(),
                reason: values.reason.trim(),
              }),
            ),
          success: 'Correction submitted for approval',
          onDone: () => {
            onSaved();
            onClose();
          },
        })
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input label="Date" type="date" max={todayIso()} required {...form.bind('date')} />
        <Select
          label="Punch"
          options={[
            { value: 'CHECK_IN', label: 'Check in' },
            { value: 'CHECK_OUT', label: 'Check out' },
          ]}
          {...form.bind('eventType')}
        />
        <Input label="Time" type="time" required {...form.bind('time')} />
      </div>
      <Textarea label="Reason" required rows={3} placeholder="e.g. Forgot to check out after the client visit" {...form.bind('reason')} />
    </FormModal>
  );
}

function correctionColumns(showEmployee: boolean, employees: { id: string; name: string }[]): Column<AttendanceCorrection>[] {
  return [
    ...(showEmployee
      ? [
          {
            key: 'employee',
            header: 'Employee',
            render: (row: AttendanceCorrection) => (
              <div className="flex items-center gap-2">
                <Avatar name={refName(row.employee, employees)} size="sm" />
                {refName(row.employee, employees)}
              </div>
            ),
          } satisfies Column<AttendanceCorrection>,
        ]
      : []),
    { key: 'date', header: 'Date', render: (row) => fmtDate(row.date) },
    {
      key: 'proposed',
      header: 'Requested',
      render: (row) => `${row.proposedType === 'check_out' ? 'Check out' : 'Check in'} at ${fmtTime(row.proposedTimestamp)}`,
    },
    { key: 'reason', header: 'Reason', hideOnMobile: true, render: (row) => <span className="line-clamp-2 max-w-xs">{row.reason}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusChip status={row.status} /> },
  ];
}

/* --------------------------------- Page -------------------------------- */

export function AttendancePage() {
  const { user, hasPermission } = useAuth();
  const canPunch = hasPermission(PERMISSIONS.attendanceCheckin);
  const canCorrect = hasPermission(PERMISSIONS.attendanceCorrect);
  const canApprove = hasPermission(PERMISSIONS.attendanceApprove);
  const canViewTeam = hasPermission(PERMISSIONS.attendanceViewTeam);

  const [tab, setTab] = useState<TabKey>('today');
  const [correcting, setCorrecting] = useState(false);
  const [deciding, setDeciding] = useState<{ item: AttendanceCorrection; decision: 'approve' | 'reject' } | null>(null);
  const [teamDate, setTeamDate] = useState(todayIso());
  const now = useNow(30_000);

  const lookups = useLookups(['employees'], canApprove || canViewTeam);
  const employees = (lookups.data ?? EMPTY_LOOKUPS).employees;

  const historyFrom = localDayBoundsIso(format(subDays(new Date(), 31), 'yyyy-MM-dd')).from;
  const historyTo = localDayBoundsIso().to;
  const teamBounds = localDayBoundsIso(teamDate);
  const events = useApi(
    (signal) => listAll('/attendance/events', normAttendanceEvent, { from: historyFrom, to: historyTo }, signal),
    [],
    canPunch || canCorrect,
  );
  const corrections = useApi(
    (signal) => listAll('/attendance/corrections', normCorrection, {}, signal),
    [],
    canCorrect || canApprove,
  );
  const team = useApi(
    (signal) =>
      listAll('/attendance/events', normAttendanceEvent, {
        scope: 'team',
        date: teamDate,
        from: teamBounds.from,
        to: teamBounds.to,
      }, signal),
    [teamDate],
    canViewTeam && tab === 'team',
  );

  const ownEvents = useMemo(
    () => (events.data ?? []).filter((event) => !event.employee?.id || !user?.employeeId || event.employee.id === user.employeeId),
    [events.data, user?.employeeId],
  );
  const today = todayIso();
  const todayEvents = useMemo(() => ownEvents.filter((event) => dayKey(event.timestamp) === today), [ownEvents, today]);
  const days = useMemo(() => groupByDay(ownEvents, now), [ownEvents, now]);

  const mine = useMemo(
    () => (corrections.data ?? []).filter((item) => !item.employee?.id || !user?.employeeId || item.employee.id === user.employeeId),
    [corrections.data, user?.employeeId],
  );
  const pending = useMemo(
    () => (corrections.data ?? []).filter((item) => isStatus(item.status, 'pending') && item.employee?.id !== user?.employeeId),
    [corrections.data, user?.employeeId],
  );

  const reloadAll = useCallback(() => {
    events.reload();
    corrections.reload();
  }, [events, corrections]);

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'today', label: 'Today' },
    { key: 'history', label: 'History' },
    ...(canCorrect ? [{ key: 'corrections' as const, label: 'My corrections' }] : []),
    ...(canApprove ? [{ key: 'approvals' as const, label: 'Approvals', count: pending.length }] : []),
    ...(canViewTeam ? [{ key: 'team' as const, label: 'Team' }] : []),
  ];

  const historyColumns: Column<AttendanceDay>[] = [
    { key: 'date', header: 'Date', render: (row) => <span className="font-medium">{fmtDate(row.date, 'EEE, dd MMM')}</span> },
    { key: 'in', header: 'First in', render: (row) => fmtTime(row.firstIn) },
    { key: 'out', header: 'Last out', render: (row) => (row.lastOut ? fmtTime(row.lastOut) : <span className="text-slate-400">—</span>) },
    { key: 'worked', header: 'Worked', render: (row) => fmtDuration(row.workedMinutes) },
    {
      key: 'flags',
      header: 'Flags',
      hideOnMobile: true,
      render: (row) => {
        const flagged = row.events.some((event) => isStatus(event.status, 'flagged', 'rejected'));
        return flagged ? <StatusChip status="flagged" /> : <span className="text-slate-400">—</span>;
      },
    },
  ];

  const teamColumns: Column<AttendanceEvent>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Avatar name={refName(row.employee, employees)} size="sm" />
          {refName(row.employee, employees)}
        </div>
      ),
    },
    { key: 'type', header: 'Punch', render: (row) => <StatusChip status={row.type} label={row.type === 'check_in' ? 'Check in' : 'Check out'} /> },
    { key: 'time', header: 'Time', render: (row) => fmtTime(row.timestamp) },
    {
      key: 'location',
      header: 'Location',
      hideOnMobile: true,
      render: (row) => (row.locationStatus ? LOCATION_COPY[row.locationStatus.toLowerCase()]?.label ?? titleCase(row.locationStatus) : '—'),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusChip status={row.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Check in, review your day and manage corrections."
        actions={
          canCorrect && (
            <Button variant="secondary" onClick={() => setCorrecting(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Request correction
            </Button>
          )
        }
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-5" />

      {tab === 'today' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <PunchCard todayEvents={todayEvents} canPunch={canPunch} onPunched={events.reload} />
          </div>
          <Card title="Today's timeline" className="lg:col-span-2">
            <Async state={events} loadingLabel="Loading timeline…">
              {() => <Timeline events={todayEvents} />}
            </Async>
          </Card>
        </div>
      )}

      {tab === 'history' && (
        <Card title="Last 30 days" flush>
          <Async state={events}>
            {() => (
              <Table
                columns={historyColumns}
                rows={days}
                rowKey={(row) => row.date}
                pageSize={12}
                emptyTitle="No attendance recorded"
                emptyDescription="Once you check in, your daily records will show up here."
              />
            )}
          </Async>
        </Card>
      )}

      {tab === 'corrections' && (
        <Card title="My correction requests" flush>
          <Async state={corrections}>
            {() => (
              <Table
                columns={correctionColumns(false, employees)}
                rows={mine}
                rowKey={(row) => row.id}
                pageSize={10}
                emptyTitle="No correction requests"
                emptyDescription="Forgot to punch out? Request a correction and your manager will review it."
                emptyAction={
                  <Button size="sm" onClick={() => setCorrecting(true)}>
                    <Plus className="h-4 w-4" aria-hidden /> Request correction
                  </Button>
                }
              />
            )}
          </Async>
        </Card>
      )}

      {tab === 'approvals' && (
        <Card title="Corrections awaiting approval" flush>
          <Async state={corrections}>
            {() => (
              <Table
                columns={[
                  ...correctionColumns(true, employees).filter((column) => column.key !== 'status'),
                  {
                    key: 'actions',
                    header: <span className="sr-only">Actions</span>,
                    className: 'text-right',
                    render: (row) => (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setDeciding({ item: row, decision: 'reject' })}>
                          Reject
                        </Button>
                        <Button size="sm" onClick={() => setDeciding({ item: row, decision: 'approve' })}>
                          Approve
                        </Button>
                      </div>
                    ),
                  },
                ]}
                rows={pending}
                rowKey={(row) => row.id}
                pageSize={10}
                emptyTitle="Nothing to approve"
                emptyDescription="Correction requests from your team will appear here."
              />
            )}
          </Async>
        </Card>
      )}

      {tab === 'team' && (
        <Card flush>
          <FilterBar>
            <Input
              aria-label="Date"
              type="date"
              max={todayIso()}
              value={teamDate}
              onChange={(event) => setTeamDate(event.target.value || todayIso())}
              className="sm:w-44"
            />
          </FilterBar>
          <Async state={team}>
            {(rows) => (
              <Table
                columns={teamColumns}
                rows={[...rows].sort((a, b) => b.timestamp.localeCompare(a.timestamp))}
                rowKey={(row) => row.id || `${row.employee?.id}-${row.timestamp}`}
                pageSize={15}
                emptyTitle="No attendance for this day"
                emptyDescription="Pick another date to see your team's punches."
              />
            )}
          </Async>
        </Card>
      )}

      {correcting && <CorrectionModal onClose={() => setCorrecting(false)} onSaved={reloadAll} />}
      {deciding && (
        <DecisionModal
          decision={deciding.decision}
          subject={`${refName(deciding.item.employee, employees)} · ${fmtDate(deciding.item.date)}`}
          onClose={() => setDeciding(null)}
          onDone={reloadAll}
          onConfirm={(note) =>
            api.post(`/attendance/corrections/${deciding.item.id}/${deciding.decision}`, toPayload({ note, decisionNote: note }))
          }
        />
      )}
    </div>
  );
}
