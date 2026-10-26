import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { useNotifications } from '../../context/NotificationContext';
import { useClickOutside } from '../../lib/useClickOutside';
import { cn } from '../../lib/cn';
import type { NotificationItem } from '../../types';

export function timeAgo(value: string): string {
  const date = parseISO(value);
  return isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : '';
}

export function NotificationsMenu() {
  const { items, unreadCount, loading, error, markRead, markAllRead, reload } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  const onSelect = (item: NotificationItem) => {
    void markRead(item.id);
    setOpen(false);
    if (item.href) navigate(item.href);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <h3 className="text-sm font-semibold">Notifications</h3>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0}
              className="text-xs font-medium text-brand-600 hover:underline disabled:text-slate-400 disabled:no-underline"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">Loading…</p>
            ) : error && items.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                Couldn't load notifications.{' '}
                <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => void reload()}>
                  Retry
                </button>
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">You're all caught up.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.slice(0, 8).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      className={cn(
                        'flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50',
                        !item.readAt && 'bg-brand-50/50',
                      )}
                    >
                      <span
                        className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.readAt ? 'bg-transparent' : 'bg-gold')}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{item.title}</span>
                        {item.body && <span className="block truncate text-xs text-slate-500">{item.body}</span>}
                        <span className="mt-0.5 block text-[11px] text-slate-400">{timeAgo(item.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            to="/notifications"
            onClick={close}
            className="block border-t border-slate-200 px-4 py-2.5 text-center text-xs font-medium text-brand-600 hover:bg-slate-50"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
