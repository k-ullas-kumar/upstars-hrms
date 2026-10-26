import { NavLink } from 'react-router-dom';
import { Star, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';
import { NAV, type NavLinkItem } from './navConfig';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function SidebarLink({ item, onNavigate }: { item: NavLinkItem; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-navy-100 hover:translate-x-0.5 hover:bg-white/10 hover:text-white',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {item.label}
    </NavLink>
  );
}

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const { hasAnyPermission } = useAuth();
  const canSee = (item: NavLinkItem) => !item.anyOf || hasAnyPermission(item.anyOf);

  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Main navigation">
      {NAV.map((entry) => {
        switch (entry.kind) {
          case 'link':
            return canSee(entry.item) ? (
              <SidebarLink key={entry.item.to} item={entry.item} onNavigate={onNavigate} />
            ) : null;
          case 'section': {
            const visible = entry.items.filter(canSee);
            if (visible.length === 0) return null;
            return (
              <div key={entry.label}>
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-gold-300">
                  {entry.label}
                </p>
                <div className="space-y-0.5">
                  {visible.map((item) => (
                    <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
                  ))}
                </div>
              </div>
            );
          }
          default: {
            const unreachable: never = entry;
            return unreachable;
          }
        }
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-5 py-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold text-navy">
        <Star className="h-4 w-4 fill-navy" aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">UPstars</p>
        <p className="text-[11px] uppercase tracking-wider text-navy-200">HRMS</p>
      </div>
    </div>
  );
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col bg-navy lg:flex">
        <Brand />
        <SidebarContent onNavigate={() => undefined} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-navy/60" onClick={onClose} aria-hidden />
          <aside className="relative flex h-full w-64 animate-slide-in-left flex-col bg-navy shadow-xl">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-4 rounded p-1 text-navy-200 hover:bg-white/10 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <Brand />
            <SidebarContent onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
