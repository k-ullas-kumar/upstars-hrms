import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, CheckCircle2, ClipboardCheck, Clock, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Async } from '../components/ui/Async';
import { EmptyState } from '../components/ui/EmptyState';
import { KpiCard } from '../components/ui/KpiCard';
import { Avatar } from '../components/ui/Misc';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { fmtDate, greeting } from '../lib/format';
import { normDashboard } from '../lib/normalize';
import { useApi } from '../lib/useApi';
import { timeAgo } from '../components/layout/NotificationsMenu';

export function DashboardPage() {
  const { user } = useAuth();
  const state = useApi(async (signal) => normDashboard(await api.get<unknown>('/dashboard/summary', undefined, signal)), []);
  const firstName = (user?.name ?? '').split(' ')[0] || 'there';

  return (
    <div>
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="animate-fade-up">
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}, <span className="text-brand-700">{firstName}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {fmtDate(new Date(), 'EEEE, d MMMM yyyy')}
            {user?.tenantName ? ` · ${user.tenantName}` : ''}
          </p>
        </div>
        <Link to="/attendance" className="animate-fade-up [animation-delay:100ms]">
          <Button variant="gold">
            <Clock className="h-4 w-4" aria-hidden /> Go to attendance
          </Button>
        </Link>
      </div>

      <Async state={state} loadingLabel="Loading your dashboard…">
        {(summary) => (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Active employees"
                value={summary.activeEmployees ?? '—'}
                icon={Users}
                tone="brand"
                to="/people/employees"
                hint="Currently employed"
                delayMs={0}
              />
              <KpiCard
                label="Pending approvals"
                value={summary.pendingApprovals}
                icon={CheckCircle2}
                tone="gold"
                hint="Waiting for a decision"
                delayMs={80}
              />
              <KpiCard
                label="Open tasks"
                value={summary.openTasks ?? '—'}
                icon={ClipboardCheck}
                tone="navy"
                to="/tasks"
                hint="Across your teams"
                delayMs={160}
              />
              <KpiCard
                label="Present today"
                value={summary.presentToday ?? '—'}
                icon={CalendarCheck}
                tone="brand"
                to="/attendance"
                hint="Checked in so far"
                delayMs={240}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
              <Card title="Pending approvals" className="animate-fade-up lg:col-span-3 [animation-delay:150ms]" flush>
                {summary.pendingActions.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="You're all caught up"
                    description="Nothing is waiting for your approval right now."
                  />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {summary.pendingActions.map((action) => (
                      <li key={action.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
                        <span className="rounded-full bg-gold-50 p-2 text-gold-600">
                          <Clock className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{action.title}</p>
                          {action.subtitle && <p className="truncate text-xs text-slate-500">{action.subtitle}</p>}
                        </div>
                        {action.href && (
                          <Link
                            to={action.href}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                          >
                            Review <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Recent activity" className="animate-fade-up lg:col-span-2 [animation-delay:220ms]" flush>
                {summary.recentActivity.length === 0 ? (
                  <EmptyState title="No recent activity" description="Updates from your workspace will show up here." />
                ) : (
                  <ul className="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto">
                    {summary.recentActivity.map((item) => (
                      <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                        <Avatar name={item.actor ?? item.text} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm text-slate-700">{item.text}</p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {item.actor ? `${item.actor} · ` : ''}
                            {item.createdAt ? timeAgo(item.createdAt) : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {(summary.attendanceTrend.length > 0 || summary.headcountByDepartment.length > 0) && (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {summary.attendanceTrend.length > 0 && (
                  <Card title="Attendance trend" className="animate-fade-up [animation-delay:280ms]">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={summary.attendanceTrend} margin={{ left: -20, right: 8, top: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="date" tickFormatter={(value: string) => fmtDate(value, 'dd MMM')} tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip labelFormatter={(value: string) => fmtDate(value)} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="present" name="Present" fill="#0F6B4C" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="absent" name="Absent" fill="#C9A227" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}
                {summary.headcountByDepartment.length > 0 && (
                  <Card title="Headcount by department" className="animate-fade-up [animation-delay:340ms]">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={summary.headcountByDepartment} layout="vertical" margin={{ left: 8, right: 16, top: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="count" name="Employees" fill="#0B1F33" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
      </Async>
    </div>
  );
}
