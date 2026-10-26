import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { NotificationProvider } from '../../context/NotificationContext';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <NotificationProvider>
      <div className="flex h-full">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header onMenuClick={() => setMenuOpen(true)} />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6">
              <div key={pathname} className="animate-fade-up">
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
}
