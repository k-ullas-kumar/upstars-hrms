import type { ReactNode } from 'react';
import { CalendarCheck, FileText, ShieldCheck } from 'lucide-react';
import { UpstarsLogo } from '../../components/brand/UpstarsLogo';

const HIGHLIGHTS = [
  { icon: CalendarCheck, title: 'Attendance you can trust', text: 'Geofenced check-in, clear timelines and one-tap corrections.' },
  { icon: ShieldCheck, title: 'Approvals without the chase', text: 'Leave, corrections and documents routed to the right manager.' },
  { icon: FileText, title: 'Assets & documents in one place', text: 'Assign equipment, generate letters and keep a full audit trail.' },
];

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Split-screen frame shared by login, forgot-password and reset-password. */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-navy via-navy-800 to-navy-600 lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/15 blur-3xl animate-drift" aria-hidden />
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-brand-500/25 blur-3xl animate-drift [animation-delay:-3s]" aria-hidden />

        <div className="relative flex flex-col items-start gap-8 animate-fade-up">
          <UpstarsLogo size="hero" imgClassName="ring-2 ring-gold/40 shadow-2xl shadow-gold/20" />
          <div className="max-w-md">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white">
              The people who
              <br />
              <span className="text-gold">power your product.</span>
            </h1>
            <p className="mt-4 text-navy-100">
              One workspace for your team's attendance, leave, assets and documents.
            </p>
          </div>
        </div>

        <ul className="relative mt-8 max-w-md space-y-5">
          {HIGHLIGHTS.map((item, index) => (
            <li
              key={item.title}
              className="flex animate-fade-up items-start gap-3"
              style={{ animationDelay: `${200 + index * 120}ms` }}
            >
              <span className="mt-0.5 rounded-lg bg-white/10 p-2 text-gold">
                <item.icon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium text-white">{item.title}</p>
                <p className="text-sm text-navy-200">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="relative animate-fade-in text-xs text-navy-300 [animation-delay:700ms]">
          © {new Date().getFullYear()} UPstars. All rights reserved.
        </p>
      </aside>

      <header className="bg-gradient-to-r from-navy to-navy-700 px-5 py-4 lg:hidden">
        <UpstarsLogo size="sm" withWordmark light />
      </header>

      <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md animate-scale-in">
          <div className="card p-6 shadow-lift sm:p-8">
            <div className="mb-5 flex justify-center">
              <UpstarsLogo size="md" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-navy">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-5 text-center text-sm text-slate-500">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
