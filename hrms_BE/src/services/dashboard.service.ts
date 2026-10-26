import { Op } from 'sequelize';
import { AttendanceCorrection, Employee, LeaveRequest, Task } from '../models';
import { RequestCtx } from '../utils/audit';
import * as audit from './audit.service';
import { visibleEmployeeIds } from './scope';

export async function summary(ctx: RequestCtx) {
  const tenant = { tenant_id: ctx.tenantId };
  const canApproveLeave = ctx.permissions.has('leave:approve');
  const canApproveAttendance = ctx.permissions.has('attendance:approve');
  const visible = await visibleEmployeeIds(ctx, false); // null = all
  const scopeEmployees = visible === null ? {} : { employee_id: { [Op.in]: visible } };

  const taskWhere: Record<string | symbol, unknown> = { ...tenant, status: { [Op.in]: ['TODO', 'IN_PROGRESS', 'BLOCKED'] } };
  if (visible !== null) {
    const owners = [...visible, ...(ctx.employeeId ? [ctx.employeeId] : [])];
    taskWhere.owner_employee_id = { [Op.in]: owners };
  }

  const [activeEmployees, pendingLeave, pendingCorrections, openTasks, myOpenTasks, recentAudit] = await Promise.all([
    Employee.count({ where: { ...tenant, employment_status: 'ACTIVE' } }),
    canApproveLeave ? LeaveRequest.count({ where: { ...tenant, status: 'PENDING', ...scopeEmployees } }) : Promise.resolve(0),
    canApproveAttendance ? AttendanceCorrection.count({ where: { ...tenant, status: 'PENDING', ...scopeEmployees } }) : Promise.resolve(0),
    Task.count({ where: taskWhere }),
    ctx.employeeId
      ? Task.count({ where: { ...tenant, owner_employee_id: ctx.employeeId, status: { [Op.in]: ['TODO', 'IN_PROGRESS', 'BLOCKED'] } } })
      : Promise.resolve(0),
    ctx.permissions.has('audit:view') ? audit.recent(ctx, 10) : Promise.resolve([]),
  ]);

  const recentActivity = (recentAudit as Array<Record<string, unknown>>).map((row) => ({
    id: row.id,
    type: row.action,
    title: String(row.action ?? 'Activity'),
    subtitle: [row.entity_type, row.entity_id].filter(Boolean).join(' · ') || null,
    created_at: row.created_at,
    actor: row.actor ?? null,
  }));

  return {
    active_employees: activeEmployees,
    pending_leave: pendingLeave,
    pending_corrections: pendingCorrections,
    pending_approvals: pendingLeave + pendingCorrections,
    open_tasks: openTasks,
    my_open_tasks: myOpenTasks,
    recent_audit: recentAudit,
    recent_activity: recentActivity,
  };
}
