import type { CSSProperties, ReactNode } from 'react';
import { CalendarCheck, FileText, ShieldCheck, Sparkles } from 'lucide-react';
import { UpstarsLogo } from '../../components/brand/UpstarsLogo';
import { CursorAura } from '../../components/effects/CursorAura';

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
    <div
      className="relative flex min-h-full flex-col lg:flex-row"
      style={
        {
          '--parallax-x': '0px',
          '--parallax-y': '0px',
        } as CSSProperties
      }
    >
      <CursorAura />

      <aside className="relative hidden min-h-full overflow-hidden bg-gradient-to-br from-navy via-navy-800 to-[#062a22] lg:flex lg:w-[46%] lg:flex-col lg:p-12">
        <div
          className="pointer-events-none absolute inset-[-12%] opacity-[0.14] will-change-transform"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1.5px, transparent 0)',
            backgroundSize: '26px 26px',
            transform: 'translate3d(var(--parallax-x), var(--parallax-y), 0)',
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gold/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-28 -left-16 h-96 w-96 rounded-full bg-brand-500/25 blur-3xl" aria-hidden />

        <div className="relative flex flex-1 flex-col">
          <div className="flex flex-col items-start gap-8">
            <UpstarsLogo size="hero" />
            <div className="max-w-md">
              <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                <Sparkles className="h-3 w-3" aria-hidden />
                HRMS Platform
              </p>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white">
                The people who
                <br />
                <span className="bg-gradient-to-r from-gold-300 via-gold to-gold-600 bg-clip-text text-transparent">
                  power your product.
                </span>
              </h1>
              <p className="mt-4 text-base text-navy-100">
                One workspace for your team's attendance, leave, assets and documents.
              </p>
            </div>
          </div>

          <ul className="relative mt-10 max-w-md space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li
                key={item.title}
                className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-3 backdrop-blur-sm"
              >
                <span className="mt-0.5 rounded-lg bg-gradient-to-br from-gold/30 to-brand-500/20 p-2 text-gold">
                  <item.icon className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="text-sm text-navy-200">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="relative mt-auto pt-16 text-xs text-navy-300">
            © {new Date().getFullYear()} UPSTARS. All rights reserved.
          </p>
        </div>
      </aside>

      <header className="relative overflow-hidden bg-gradient-to-r from-navy via-navy-700 to-brand-800 px-5 py-4 lg:hidden">
        <div className="pointer-events-none absolute inset-0 bg-auth-mesh opacity-60" aria-hidden />
        <div className="relative">
          <UpstarsLogo size="sm" withWordmark light />
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-navy-900 px-4 py-10 sm:px-8">
        <div
          className="pointer-events-none absolute inset-[-16%] opacity-90 will-change-transform"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(201,162,39,0.34), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 20%, rgba(15,107,76,0.42), transparent 50%), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(42,82,127,0.5), transparent 55%), radial-gradient(circle at 1px 1px, rgba(255,255,255,0.16) 1.2px, transparent 0)',
            backgroundSize: 'auto, auto, auto, 24px 24px',
            transform: 'translate3d(var(--parallax-x), var(--parallax-y), 0) scale(1.12)',
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-gold/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -right-16 bottom-8 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" aria-hidden />

        <div className="relative z-20 w-full max-w-md">
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-gold/50 via-brand-400/30 to-navy-300/40 opacity-80" aria-hidden />
          <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/95 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold via-brand-500 to-navy-400" aria-hidden />
            <div className="mb-5 flex flex-col items-center text-center">
              <UpstarsLogo size="lg" />
              <p className="mt-3 text-sm font-bold uppercase tracking-[0.18em] text-gold">UPSTARS</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-navy">{title}</h2>
              {subtitle && <p className="mt-1.5 max-w-sm text-sm text-slate-500">{subtitle}</p>}
            </div>
            <div>{children}</div>
          </div>
          {footer && <div className="relative mt-5 text-center text-sm text-navy-100/80">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
