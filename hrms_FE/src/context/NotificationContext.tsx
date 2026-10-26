import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../lib/api';
import { normNotification } from '../lib/normalize';
import type { NotificationItem } from '../types';

interface NotificationContextValue {
  items: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  error: boolean;
  reload: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);
const POLL_MS = 60_000;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    try {
      const list = await api.list<unknown>('/notifications', { limit: 50 });
      setItems(list.map(normNotification));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const id = window.setInterval(() => void reload(), POLL_MS);
    return () => window.clearInterval(id);
  }, [reload]);

  const markRead = useCallback(async (id: string) => {
    const stamp = new Date().toISOString();
    setItems((current) => current.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: stamp } : n)));
    try {
      await api.post(`/notifications/${id}/read`);
    } catch {
      void reload();
    }
  }, [reload]);

  const markAllRead = useCallback(async () => {
    const stamp = new Date().toISOString();
    setItems((current) => current.map((n) => (n.readAt ? n : { ...n, readAt: stamp })));
    try {
      await api.post('/notifications/read-all');
    } catch {
      void reload();
    }
  }, [reload]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      items,
      unreadCount: items.filter((n) => !n.readAt).length,
      loading,
      error,
      reload,
      markRead,
      markAllRead,
    }),
    [items, loading, error, reload, markRead, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
