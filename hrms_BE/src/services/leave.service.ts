import { Op, WhereOptions } from 'sequelize';
import { sequelize } from '../config/database';
import { Employee, LeaveBalance, LeaveRequest, LeaveType, Row } from '../models';
import { isHrScope, RequestCtx } from '../utils/audit';
import { AppError } from '../utils/errors';
import { countWeekdays, findOverlappingLeave, isIsoDate, todayIso } from '../utils/leave';
import { buildPagination, parsePagination } from '../utils/pagination';
import * as audit from './audit.service';
import { notifyEmployee } from './notification.service';
import { canManageEmployee, requireEmployee, visibleEmployeeIds } from './scope';

const REQUEST_INCLUDES = [
  { model: Employee, as: 'employee', attributes: ['id', 'employee_number', 'full_name', 'manager_employee_id'] },
  { model: LeaveType, as: 'leave_type', attributes: ['id', 'name', 'code', 'paid'] },
];

/* ------------------------------- leave types ------------------------------- */

export interface LeaveTypeInput {
  name?: string;
  code?: string;
  paid?: boolean;
  max_days_per_year?: number;
  carry_forward?: boolean;
}

export async function listTypes(ctx: RequestCtx) {
  const rows = await LeaveType.findAll({ where: { tenant_id: ctx.tenantId }, order: [['name', 'ASC']] });
  return rows.map((r) => r.toJSON());
}

async function loadType(ctx: RequestCtx, id: string) {
  const row = await LeaveType.findOne({ where: { id, tenant_id: ctx.tenantId } });
  if (!row) throw AppError.notFound('Leave type not found');
  return row;
}

export async function createType(ctx: RequestCtx, input: LeaveTypeInput) {
  const code = (input.code as string).toUpperCase();
  const dup = await LeaveType.findOne({ where: { tenant_id: ctx.tenantId, code } });
  if (dup) throw AppError.conflict('A leave type with this code already exists');
  const row = await LeaveType.create({ ...input, code, tenant_id: ctx.tenantId });
  await audit.log('CREATE', 'LeaveType', row.id, null, row, ctx.audit);
  return row.toJSON();
}

export async function updateType(ctx: RequestCtx, id: string, input: LeaveTypeInput) {
  const row = await loadType(ctx, id);
  const before = audit.snapshot(row);
  const patch = { ...input, ...(input.code ? { code: input.code.toUpperCase() } : {}) };
  if (patch.code && patch.code !== row.code) {
    const dup = await LeaveType.findOne({ where: { tenant_id: ctx.tenantId, code: patch.code } });
    if (dup) throw AppError.conflict('A leave type with this code already exists');
  }
  await row.update(patch);
  await audit.log('UPDATE', 'LeaveType', id, before, row, ctx.audit);
  return row.toJSON();
}

export async function deleteType(ctx: RequestCtx, id: string) {
  const row = await loadType(ctx, id);
  const used = await LeaveRequest.count({ where: { tenant_id: ctx.tenantId, leave_type_id: id } });
  if (used > 0) throw AppError.conflict('Leave type is used by existing requests and cannot be deleted');
  const before = audit.snapshot(row);
  await sequelize.transaction(async (t) => {
    await LeaveBalance.destroy({ where: { tenant_id: ctx.tenantId, leave_type_id: id }, transaction: t });
    await row.destroy({ transaction: t });
    await audit.log('DELETE', 'LeaveType', id, before, null, ctx.audit, t);
  });
  return { id, deleted: true };
}

/* --------------------------------- balances -------------------------------- */

export async function listBalances(ctx: RequestCtx, query: Record<string, unknown>) {
  const year = Number.parseInt(String(query.year ?? ''), 10) || new Date().getUTCFullYear();
  const where: WhereOptions = { tenant_id: ctx.tenantId, year };
  const requested = typeof query.employee_id === 'string' && query.employee_id ? query.employee_id : null;
  const mayViewOthers = ctx.permissions.has('leave:manage_types') || isHrScope(ctx);

  let employeeFilter: string | string[] | null;
  if (requested && requested !== ctx.employeeId) {
    if (!mayViewOthers && !(await canManageEmployee(ctx, requested))) throw AppError.forbidden();
    employeeFilter = requested;
  } else if (!requested && mayViewOthers && query.scope === 'all') {
    employeeFilter = null;
  } else {
    employeeFilter = requireEmployee(ctx);
  }
  if (employeeFilter) Object.assign(where, { employee_id: employeeFilter });

  const rows = await LeaveBalance.findAll({
    where,
    include: [
      { model: LeaveType, as: 'leave_type', attributes: ['id', 'name', 'code'] },
      { model: Employee, as: 'employee', attributes: ['id', 'employee_number', 'full_name'] },
    ],
    order: [['created_at', 'ASC']],
  });
  return rows.map((r) => r.toJSON());
}

export async function upsertBalance(
  ctx: RequestCtx,
  input: { employee_id: string; leave_type_id: string; year: number; balance: number },
) {
  const emp = await Employee.findOne({ where: { id: input.employee_id, tenant_id: ctx.tenantId }, attributes: ['id'] });
  if (!emp) throw AppError.badRequest('Unknown employee');
  await loadType(ctx, input.leave_type_id);

  const existing = await LeaveBalance.findOne({
    where: {
      tenant_id: ctx.tenantId,
      employee_id: input.employee_id,
      leave_type_id: input.leave_type_id,
      year: input.year,
    },
  });
  if (existing) {
    const before = audit.snapshot(existing);
    await existing.update({ balance: input.balance });
    await audit.log('UPDATE', 'LeaveBalance', existing.id, before, existing, ctx.audit);
    return existing.toJSON();
  }
  const row = await LeaveBalance.create({ ...input, tenant_id: ctx.tenantId, used: 0 });
  await audit.log('CREATE', 'LeaveBalance', row.id, null, row, ctx.audit);
  return row.toJSON();
}

/* --------------------------------- requests -------------------------------- */

export async function listRequests(ctx: RequestCtx, query: Record<string, unknown>) {
  const page = parsePagination(query);
  const where: WhereOptions[] = [{ tenant_id: ctx.tenantId }];

  const visible = query.scope === 'mine' ? [requireEmployee(ctx)] : await visibleEmployeeIds(ctx);
  const mayApprove = ctx.permissions.has('leave:approve');
  if (visible !== null) {
    // Non-approvers only ever see their own requests, even if they have direct reports.
    const ids = mayApprove ? visible : ctx.employeeId ? [ctx.employeeId] : [];
    where.push({ employee_id: { [Op.in]: ids } });
  }
  if (typeof query.employee_id === 'string' && query.employee_id) where.push({ employee_id: query.employee_id });
  if (typeof query.status === 'string' && query.status) where.push({ status: query.status });
  if (typeof query.leave_type_id === 'string' && query.leave_type_id) where.push({ leave_type_id: query.leave_type_id });
  if (typeof query.from === 'string' && query.from) where.push({ end_date: { [Op.gte]: query.from } });
  if (typeof query.to === 'string' && query.to) where.push({ start_date: { [Op.lte]: query.to } });

  const { rows, count } = await LeaveRequest.findAndCountAll({
    where: { [Op.and]: where },
    include: REQUEST_INCLUDES,
    order: [['created_at', 'DESC']],
    limit: page.limit,
    offset: page.offset,
  });
  return { items: rows.map((r) => r.toJSON()), pagination: buildPagination(count, page) };
}

async function loadRequest(ctx: RequestCtx, id: string): Promise<Row> {
  const row = await LeaveRequest.findOne({ where: { id, tenant_id: ctx.tenantId }, include: REQUEST_INCLUDES });
  if (!row) throw AppError.notFound('Leave request not found');
  return row;
}

export async function getRequest(ctx: RequestCtx, id: string) {
  const row = await loadRequest(ctx, id);
  if (row.employee_id !== ctx.employeeId && !(await canManageEmployee(ctx, row.employee_id))) {
    throw AppError.forbidden();
  }
  return row.toJSON();
}

export async function createRequest(
  ctx: RequestCtx,
  input: { leave_type_id: string; start_date: string; end_date: string; reason?: string | null },
) {
  const employeeId = requireEmployee(ctx);
  if (!isIsoDate(input.start_date) || !isIsoDate(input.end_date)) throw AppError.badRequest('Dates must be YYYY-MM-DD');
  if (input.end_date < input.start_date) throw AppError.badRequest('End date cannot be before start date');
  if (input.start_date.slice(0, 4) !== input.end_date.slice(0, 4)) {
    throw AppError.badRequest('A leave request cannot span two calendar years; split it into two requests');
  }

  const type = await loadType(ctx, input.leave_type_id);
  const days = countWeekdays(input.start_date, input.end_date);
  if (days <= 0) throw AppError.badRequest('The selected range contains no working days');

  const existing = await LeaveRequest.findAll({
    where: { tenant_id: ctx.tenantId, employee_id: employeeId, status: { [Op.in]: ['PENDING', 'APPROVED'] } },
  });
  const overlaps = findOverlappingLeave(
    existing.map((e) => e.toJSON() as { id: string; status: string; start_date: string; end_date: string }),
    input,
  );
  if (overlaps.length) throw AppError.conflict('You already have leave requested or approved for these dates');

  if (Number(type.max_days_per_year) > 0) {
    const year = Number(input.start_date.slice(0, 4));
    const bal = await LeaveBalance.findOne({
      where: { tenant_id: ctx.tenantId, employee_id: employeeId, leave_type_id: type.id, year },
    });
    const reserved = existing
      .filter((r) => r.status === 'PENDING' && r.leave_type_id === type.id && String(r.start_date).startsWith(String(year)))
      .reduce((sum, r) => sum + Number(r.days), 0);
    const available = (bal ? Number(bal.balance) : 0) - reserved;
    if (available < days) {
      throw AppError.unprocessable(`Insufficient ${type.name} balance: ${Math.max(0, available)} day(s) available, ${days} requested`);
    }
  }

  const row = await LeaveRequest.create({
    tenant_id: ctx.tenantId,
    employee_id: employeeId,
    leave_type_id: type.id,
    start_date: input.start_date,
    end_date: input.end_date,
    days,
    reason: input.reason ?? null,
    status: 'PENDING',
  });
  await audit.log('CREATE', 'LeaveRequest', row.id, null, row, ctx.audit);

  const emp = await Employee.findOne({ where: { id: employeeId, tenant_id: ctx.tenantId } });
  if (emp?.manager_employee_id) {
    await notifyEmployee(
      ctx.tenantId,
      emp.manager_employee_id,
      'LEAVE_REQUESTED',
      'New leave request',
      `${emp.full_name} requested ${days} day(s) of ${type.name} (${input.start_date} to ${input.end_date}).`,
      { type: 'LeaveRequest', id: row.id },
    );
  }
  return (await loadRequest(ctx, row.id)).toJSON();
}

async function assertCanDecide(ctx: RequestCtx, request: Row) {
  if (request.employee_id === ctx.employeeId) throw AppError.forbidden('You cannot decide your own leave request');
  if (!(await canManageEmployee(ctx, request.employee_id))) throw AppError.forbidden();
  if (request.status !== 'PENDING') throw AppError.conflict(`Request is already ${String(request.status).toLowerCase()}`);
}

export async function approve(ctx: RequestCtx, id: string, note?: string | null) {
  const request = await loadRequest(ctx, id);
  await assertCanDecide(ctx, request);
  const year = Number(String(request.start_date).slice(0, 4));
  const type = await loadType(ctx, request.leave_type_id);

  await sequelize.transaction(async (t) => {
    // Atomic PENDING -> APPROVED transition guards against double approval.
    const [changed] = await LeaveRequest.update(
      { status: 'APPROVED', approver_id: ctx.userId, decided_at: new Date(), decision_note: note ?? null },
      { where: { id, tenant_id: ctx.tenantId, status: 'PENDING' }, transaction: t },
    );
    if (changed !== 1) throw AppError.conflict('Request was already decided');

    const bal = await LeaveBalance.findOne({
      where: { tenant_id: ctx.tenantId, employee_id: request.employee_id, leave_type_id: type.id, year },
      transaction: t,
    });
    const days = Number(request.days);
    if (bal) {
      if (Number(type.max_days_per_year) > 0 && Number(bal.balance) < days) {
        throw AppError.unprocessable('Employee no longer has enough leave balance');
      }
      await bal.update({ balance: Number(bal.balance) - days, used: Number(bal.used) + days }, { transaction: t });
    } else if (Number(type.max_days_per_year) > 0) {
      throw AppError.unprocessable('Employee has no leave balance for this type and year');
    }
    await audit.log('APPROVE', 'LeaveRequest', id, { status: 'PENDING' }, { status: 'APPROVED', note }, ctx.audit, t);
  });

  await notifyEmployee(
    ctx.tenantId,
    request.employee_id,
    'LEAVE_APPROVED',
    'Leave approved',
    `Your ${type.name} request for ${request.start_date} to ${request.end_date} was approved.`,
    { type: 'LeaveRequest', id },
  );
  return (await loadRequest(ctx, id)).toJSON();
}

export async function reject(ctx: RequestCtx, id: string, note?: string | null) {
  const request = await loadRequest(ctx, id);
  await assertCanDecide(ctx, request);
  const [changed] = await LeaveRequest.update(
    { status: 'REJECTED', approver_id: ctx.userId, decided_at: new Date(), decision_note: note ?? null },
    { where: { id, tenant_id: ctx.tenantId, status: 'PENDING' } },
  );
  if (changed !== 1) throw AppError.conflict('Request was already decided');
  await audit.log('REJECT', 'LeaveRequest', id, { status: 'PENDING' }, { status: 'REJECTED', note }, ctx.audit);
  await notifyEmployee(
    ctx.tenantId,
    request.employee_id,
    'LEAVE_REJECTED',
    'Leave rejected',
    `Your ${request.leave_type?.name ?? 'leave'} request for ${request.start_date} to ${request.end_date} was rejected.${note ? ` Note: ${note}` : ''}`,
    { type: 'LeaveRequest', id },
  );
  return (await loadRequest(ctx, id)).toJSON();
}

export async function cancel(ctx: RequestCtx, id: string) {
  const request = await loadRequest(ctx, id);
  const isOwner = request.employee_id === ctx.employeeId;
  if (!isOwner && !isHrScope(ctx)) throw AppError.forbidden();
  if (request.status === 'CANCELLED' || request.status === 'REJECTED') {
    throw AppError.conflict(`Request is already ${String(request.status).toLowerCase()}`);
  }
  if (request.status === 'APPROVED' && isOwner && !isHrScope(ctx) && request.start_date < todayIso()) {
    throw AppError.conflict('Leave that has already started cannot be cancelled; contact HR');
  }
  const wasApproved = request.status === 'APPROVED';
  const year = Number(String(request.start_date).slice(0, 4));

  await sequelize.transaction(async (t) => {
    const [changed] = await LeaveRequest.update(
      { status: 'CANCELLED', decided_at: new Date() },
      { where: { id, tenant_id: ctx.tenantId, status: request.status }, transaction: t },
    );
    if (changed !== 1) throw AppError.conflict('Request status changed; please retry');
    if (wasApproved) {
      const bal = await LeaveBalance.findOne({
        where: { tenant_id: ctx.tenantId, employee_id: request.employee_id, leave_type_id: request.leave_type_id, year },
        transaction: t,
      });
      if (bal) {
        const days = Number(request.days);
        await bal.update(
          { balance: Number(bal.balance) + days, used: Math.max(0, Number(bal.used) - days) },
          { transaction: t },
        );
      }
    }
    await audit.log('CANCEL', 'LeaveRequest', id, { status: request.status }, { status: 'CANCELLED' }, ctx.audit, t);
  });

  if (!isOwner) {
    await notifyEmployee(ctx.tenantId, request.employee_id, 'LEAVE_CANCELLED', 'Leave cancelled', 'Your leave request was cancelled by HR.', {
      type: 'LeaveRequest',
      id,
    });
  } else if (request.employee?.manager_employee_id) {
    await notifyEmployee(
      ctx.tenantId,
      request.employee.manager_employee_id,
      'LEAVE_CANCELLED',
      'Leave cancelled',
      `${request.employee.full_name} cancelled a leave request.`,
      { type: 'LeaveRequest', id },
    );
  }
  return (await loadRequest(ctx, id)).toJSON();
}
