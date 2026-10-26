import { Employee, Row } from '../models';
import { isHrScope, RequestCtx } from '../utils/audit';
import { AppError } from '../utils/errors';

/** Returns the plain-object JSON for a row, or null. */
export const plain = (row: Row | null | undefined) => (row ? (row.toJSON() as Record<string, unknown>) : null);

/** Direct-report employee ids of the caller. */
export async function directReportIds(ctx: RequestCtx): Promise<string[]> {
  if (!ctx.employeeId) return [];
  const reports = await Employee.findAll({
    where: { tenant_id: ctx.tenantId, manager_employee_id: ctx.employeeId },
    attributes: ['id'],
  });
  return reports.map((r) => r.id as string);
}

/**
 * Employee ids the caller may see in team-scoped views.
 * `null` means "everyone in the tenant" (HR scope). Otherwise self + direct reports.
 */
export async function visibleEmployeeIds(ctx: RequestCtx, includeSelf = true): Promise<string[] | null> {
  if (isHrScope(ctx)) return null;
  const ids = await directReportIds(ctx);
  if (includeSelf && ctx.employeeId) ids.push(ctx.employeeId);
  return ids;
}

/** HR scope, or the direct line manager of the employee. */
export async function canManageEmployee(ctx: RequestCtx, employeeId: string): Promise<boolean> {
  if (isHrScope(ctx)) return true;
  if (!ctx.employeeId) return false;
  const emp = await Employee.findOne({
    where: { id: employeeId, tenant_id: ctx.tenantId },
    attributes: ['manager_employee_id'],
  });
  return !!emp && emp.manager_employee_id === ctx.employeeId;
}

export function requireEmployee(ctx: RequestCtx): string {
  if (!ctx.employeeId) throw AppError.forbidden('Your account is not linked to an employee record');
  return ctx.employeeId;
}

/** Loads an employee of the caller's tenant or throws 404. */
export async function getTenantEmployee(ctx: RequestCtx, employeeId: string): Promise<Row> {
  const emp = await Employee.findOne({ where: { id: employeeId, tenant_id: ctx.tenantId } });
  if (!emp) throw AppError.notFound('Employee not found');
  return emp;
}
