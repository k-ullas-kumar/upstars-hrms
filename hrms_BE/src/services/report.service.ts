import { Op, WhereOptions } from 'sequelize';
import { Asset, AssetAssignment, AttendanceEvent, Branch, Department, Designation, Employee, LeaveRequest, LeaveType } from '../models';
import { RequestCtx } from '../utils/audit';
import { toCsv } from '../utils/csv';
import { AppError } from '../utils/errors';
import { todayIso } from '../utils/leave';
import * as audit from './audit.service';

export const REPORT_TYPES = ['employees', 'attendance', 'leave', 'assets'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface CsvReport {
  filename: string;
  csv: string;
}

const REQUIRED_PERMISSION: Record<ReportType, string> = {
  employees: 'employee:export',
  attendance: 'report:export',
  leave: 'report:export',
  assets: 'report:export',
};

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v ?? ''));

function dateRange(query: Record<string, unknown>, field: string, asTimestamp: boolean): WhereOptions | null {
  const range: Record<symbol, unknown> = {};
  if (typeof query.from === 'string' && query.from) range[Op.gte] = asTimestamp ? new Date(`${query.from}T00:00:00.000Z`) : query.from;
  if (typeof query.to === 'string' && query.to) range[Op.lte] = asTimestamp ? new Date(`${query.to}T23:59:59.999Z`) : query.to;
  return Reflect.ownKeys(range).length ? { [field]: range } : null;
}

async function employeesReport(ctx: RequestCtx) {
  const rows = await Employee.findAll({
    where: { tenant_id: ctx.tenantId },
    include: [
      { model: Branch, as: 'branch', attributes: ['name'] },
      { model: Department, as: 'department', attributes: ['name'] },
      { model: Designation, as: 'designation', attributes: ['name'] },
      { model: Employee, as: 'manager', attributes: ['full_name'] },
    ],
    order: [['employee_number', 'ASC']],
  });
  const columns = ['employee_number', 'full_name', 'work_email', 'phone', 'department', 'designation', 'branch', 'manager', 'employment_status', 'joining_date', 'exit_date'];
  const data = rows.map((e) => ({
    employee_number: e.employee_number,
    full_name: e.full_name,
    work_email: e.work_email,
    phone: e.phone,
    department: e.department?.name,
    designation: e.designation?.name,
    branch: e.branch?.name,
    manager: e.manager?.full_name,
    employment_status: e.employment_status,
    joining_date: e.joining_date,
    exit_date: e.exit_date,
  }));
  return { columns, data };
}

async function attendanceReport(ctx: RequestCtx, query: Record<string, unknown>) {
  const where: WhereOptions[] = [{ tenant_id: ctx.tenantId }];
  const range = dateRange(query, 'timestamp', true);
  if (range) where.push(range);
  const rows = await AttendanceEvent.findAll({
    where: { [Op.and]: where },
    include: [{ model: Employee, as: 'employee', attributes: ['employee_number', 'full_name'] }],
    order: [['timestamp', 'ASC']],
  });
  const columns = ['employee_number', 'full_name', 'event_type', 'timestamp', 'source', 'status', 'location_verification_status', 'latitude', 'longitude', 'notes'];
  const data = rows.map((e) => ({
    employee_number: e.employee?.employee_number,
    full_name: e.employee?.full_name,
    event_type: e.event_type,
    timestamp: iso(e.timestamp),
    source: e.source,
    status: e.status,
    location_verification_status: e.location_verification_status,
    latitude: e.latitude,
    longitude: e.longitude,
    notes: e.notes,
  }));
  return { columns, data };
}

async function leaveReport(ctx: RequestCtx, query: Record<string, unknown>) {
  const where: WhereOptions[] = [{ tenant_id: ctx.tenantId }];
  if (typeof query.from === 'string' && query.from) where.push({ end_date: { [Op.gte]: query.from } });
  if (typeof query.to === 'string' && query.to) where.push({ start_date: { [Op.lte]: query.to } });
  if (typeof query.status === 'string' && query.status) where.push({ status: query.status });
  const rows = await LeaveRequest.findAll({
    where: { [Op.and]: where },
    include: [
      { model: Employee, as: 'employee', attributes: ['employee_number', 'full_name'] },
      { model: LeaveType, as: 'leave_type', attributes: ['name', 'code'] },
    ],
    order: [['start_date', 'ASC']],
  });
  const columns = ['employee_number', 'full_name', 'leave_type', 'start_date', 'end_date', 'days', 'status', 'reason', 'decision_note', 'decided_at'];
  const data = rows.map((r) => ({
    employee_number: r.employee?.employee_number,
    full_name: r.employee?.full_name,
    leave_type: r.leave_type?.name,
    start_date: r.start_date,
    end_date: r.end_date,
    days: r.days,
    status: r.status,
    reason: r.reason,
    decision_note: r.decision_note,
    decided_at: iso(r.decided_at),
  }));
  return { columns, data };
}

async function assetsReport(ctx: RequestCtx) {
  const rows = await Asset.findAll({
    where: { tenant_id: ctx.tenantId },
    include: [
      {
        model: AssetAssignment,
        as: 'assignments',
        required: false,
        where: { returned_at: null },
        include: [{ model: Employee, as: 'employee', attributes: ['employee_number', 'full_name'] }],
      },
    ],
    order: [['asset_tag', 'ASC']],
  });
  const columns = ['asset_tag', 'category', 'serial_number', 'status', 'condition', 'location', 'purchase_date', 'warranty_until', 'assigned_to', 'assigned_at'];
  const data = rows.map((a) => {
    const current = a.assignments?.[0];
    return {
      asset_tag: a.asset_tag,
      category: a.category,
      serial_number: a.serial_number,
      status: a.status,
      condition: a.condition,
      location: a.location,
      purchase_date: a.purchase_date,
      warranty_until: a.warranty_until,
      assigned_to: current?.employee ? `${current.employee.full_name} (${current.employee.employee_number})` : '',
      assigned_at: iso(current?.assigned_at),
    };
  });
  return { columns, data };
}

export async function exportCsv(ctx: RequestCtx, type: ReportType, query: Record<string, unknown>): Promise<CsvReport> {
  if (!ctx.permissions.has(REQUIRED_PERMISSION[type])) throw AppError.forbidden();
  let result: { columns: string[]; data: Record<string, unknown>[] };
  switch (type) {
    case 'employees':
      result = await employeesReport(ctx);
      break;
    case 'attendance':
      result = await attendanceReport(ctx, query);
      break;
    case 'leave':
      result = await leaveReport(ctx, query);
      break;
    case 'assets':
      result = await assetsReport(ctx);
      break;
    default: {
      const unreachable: never = type;
      throw AppError.badRequest(`Unknown report type: ${String(unreachable)}`);
    }
  }
  await audit.log('EXPORT', 'Report', null, null, { type, rows: result.data.length }, ctx.audit);
  return { filename: `${type}-${todayIso()}.csv`, csv: toCsv(result.data, result.columns) };
}
