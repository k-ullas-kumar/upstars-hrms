import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Clock, LogOut, Menu, Search, X } from 'lucide-react';
import { useTodaySession } from '../../hooks/useTodaySession';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { notifyAttendanceChanged } from '../../lib/attendanceTime';
import { toPayload } from '../../lib/payload';
import { initials, titleCase } from '../../lib/format';
import { useClickOutside } from '../../lib/useClickOutside';
import { cn } from '../../lib/cn';
import { NotificationsMenu } from './NotificationsMenu';

interface HeaderProps {
  onMenuClick: () => void;
}

const CHECKOUT_COUNTDOWN_SEC = 5;

function useCheckoutShortcut() {
  const session = useTodaySession();
  const refreshRef = useRef(session.refresh);
  refreshRef.current = session.refresh;
  const [pending, setPending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(CHECKOUT_COUNTDOWN_SEC);
  const [busy, setBusy] = useState(false);
  const cancelled = useRef(false);
  const finishing = useRef(false);

  const cancel = useCallback(() => {
    cancelled.current = true;
    finishing.current = false;
    setPending(false);
    setSecondsLeft(CHECKOUT_COUNTDOWN_SEC);
  }, []);

  const finish = useCallback(async () => {
    if (finishing.current || cancelled.current) return;
    finishing.current = true;
    setBusy(true);
    try {
      await api.post('/attendance/check-out', toPayload({ source: 'WEB' }));
      notifyAttendanceChanged();
      await refreshRef.current();
    } catch {
      // Banner dismisses; user can retry from Attendance.
    } finally {
      setBusy(false);
      setPending(false);
      setSecondsLeft(CHECKOUT_COUNTDOWN_SEC);
      finishing.current = false;
    }
  }, []);

  const begin = useCallback(() => {
    if (!session.checkedIn || pending || busy) return;
    cancelled.current = false;
    finishing.current = false;
    setSecondsLeft(CHECKOUT_COUNTDOWN_SEC);
    setPending(true);
  }, [session.checkedIn, pending, busy]);

  useEffect(() => {
    if (!pending) return;
    if (secondsLeft <= 0) {
      void finish();
      return;
    }
    const id = window.setTimeout(() => {
      if (!cancelled.current) setSecondsLeft((s) => s - 1);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [pending, secondsLeft, finish]);

  return { session, pending, secondsLeft, busy, begin, cancel };
}

function ProfileMenu({
  onSignOut,
  session,
}: {
  onSignOut: () => void;
  session: ReturnType<typeof useTodaySession>;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-slate-100"
        aria-expanded={open}
        aria-label="Profile menu"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
          {initials(user.name)}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium text-slate-800">{user.name}</span>
          <span className="block text-[11px] text-slate-500">{titleCase(user.roles[0])}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            {user.tenantName && <p className="mt-1 truncate text-[11px] text-gold-700">{user.tenantName}</p>}
            {user.employeeId && (
              <div
                className={cn(
                  'mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium',
                  session.checkedIn ? 'bg-brand-50 text-brand-800' : 'bg-slate-50 text-slate-500',
                )}
              >
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {session.checkedIn ? (
                  <span>
                    Total time{' '}
                    <span className="font-mono tabular-nums tracking-wide">{session.elapsedLabel}</span>
                  </span>
                ) : (
                  <span>Not checked in</span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function CheckoutCountdownBanner({
  secondsLeft,
  onCancel,
}: {
  secondsLeft: number;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-3 sm:px-4">
      <div
        role="alertdialog"
        aria-live="assertive"
        className="flex w-full max-w-lg items-center gap-3 rounded-xl border border-gold/40 bg-navy px-4 py-3 text-white shadow-2xl shadow-black/30"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/20 font-mono text-sm font-bold text-gold">
          {secondsLeft}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Checking out in {secondsLeft}s</p>
          <p className="text-xs text-navy-200">Cancel if this was accidental.</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-xs font-bold text-navy hover:bg-gold-400"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Cancel
        </button>
      </div>
    </div>
  );
}

export function Header({ onMenuClick }: HeaderProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { session, pending, secondsLeft, busy, begin, cancel } = useCheckoutShortcut();

  const signOut = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  return (
    <>
      {pending && <CheckoutCountdownBanner secondsLeft={secondsLeft} onCancel={cancel} />}
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-5">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative hidden max-w-md flex-1 sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            disabled
            placeholder="Search employees, assets, documents… (coming soon)"
            aria-label="Global search (coming soon)"
            className="field-control bg-slate-50 pl-9"
          />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {session.checkedIn && (
            <div className="mr-1 hidden items-center gap-1.5 md:flex">
              <div
                className="flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200"
                title="Today's total work time"
              >
                <Clock className="h-3.5 w-3.5" aria-hidden />
                <span className="font-mono tabular-nums">{session.elapsedLabel}</span>
              </div>
              <button
                type="button"
                onClick={begin}
                disabled={pending || busy}
                className="rounded-full bg-navy px-2.5 py-1 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-60"
                aria-label="Check out"
              >
                Check out
              </button>
            </div>
          )}
          <NotificationsMenu />
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:px-3"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
          <ProfileMenu onSignOut={() => void signOut()} session={session} />
        </div>
      </header>
    </>
  );
}
