import { Op, WhereOptions } from 'sequelize';
import { sequelize } from '../config/database';
import { AttendanceCorrection, AttendanceEvent, Employee, Geofence, Row } from '../models';
import { RequestCtx } from '../utils/audit';
import { AppError } from '../utils/errors';
import { haversineMeters } from '../utils/geo';
import { buildPagination, parsePagination } from '../utils/pagination';
import * as audit from './audit.service';
import { notifyEmployee } from './notification.service';
import { canManageEmployee, requireEmployee, visibleEmployeeIds } from './scope';

/** GPS fixes less precise than this cannot be trusted for geofence verification. */
const MAX_ACCURACY_METERS = 150;

export interface PunchInput {
  latitude?: number | null;
  longitude?: number | null;
  accuracy_meters?: number | null;
  notes?: string | null;
  source?: 'WEB' | 'MOBILE' | 'KIOSK';
}

interface LocationResult {
  location_verification_status: string;
  status: 'ACCEPTED' | 'FLAGGED';
  geofence_id: string | null;
}

async function verifyLocation(ctx: RequestCtx, input: PunchInput): Promise<LocationResult> {
  const fences = await Geofence.findAll({ where: { tenant_id: ctx.tenantId, status: 'ACTIVE' } });
  if (fences.length === 0) return { location_verification_status: 'NOT_REQUIRED', status: 'ACCEPTED', geofence_id: null };

  const { latitude, longitude, accuracy_meters } = input;
  if (latitude == null || longitude == null) {
    return { location_verification_status: 'PERMISSION_DENIED', status: 'FLAGGED', geofence_id: null };
  }
  if (accuracy_meters != null && accuracy_meters > MAX_ACCURACY_METERS) {
    return { location_verification_status: 'ACCURACY_INSUFFICIENT', status: 'FLAGGED', geofence_id: null };
  }
  let nearest: { id: string; distance: number; radius: number } | null = null;
  for (const f of fences) {
    const distance = haversineMeters(latitude, longitude, Number(f.latitude), Number(f.longitude));
    if (!nearest || distance < nearest.distance) nearest = { id: f.id, distance, radius: Number(f.radius_meters) };
    if (distance <= Number(f.radius_meters)) {
      return { location_verification_status: 'INSIDE', status: 'ACCEPTED', geofence_id: f.id };
    }
  }
  return { location_verification_status: 'OUTSIDE', status: 'FLAGGED', geofence_id: nearest?.id ?? null };
}

async function lastEvent(ctx: RequestCtx, employeeId: string) {
  return AttendanceEvent.findOne({
    where: { tenant_id: ctx.tenantId, employee_id: employeeId, status: { [Op.ne]: 'REJECTED' } },
    order: [['timestamp', 'DESC']],
  });
}

async function punch(ctx: RequestCtx, type: 'CHECK_IN' | 'CHECK_OUT', input: PunchInput) {
  const employeeId = requireEmployee(ctx);
  const emp = await Employee.findOne({ where: { id: employeeId, tenant_id: ctx.tenantId }, attributes: ['employment_status'] });
  if (!emp || emp.employment_status !== 'ACTIVE') throw AppError.forbidden('Only active employees can record attendance');

  const last = await lastEvent(ctx, employeeId);
  if (type === 'CHECK_IN' && last?.event_type === 'CHECK_IN') throw AppError.conflict('You are already checked in');
  if (type === 'CHECK_OUT' && last?.event_type !== 'CHECK_IN') throw AppError.conflict('You are not checked in');

  const loc = await verifyLocation(ctx, input);
  const event = await AttendanceEvent.create({
    tenant_id: ctx.tenantId,
    employee_id: employeeId,
    event_type: type,
    timestamp: new Date(),
    source: input.source ?? 'WEB',
    status: loc.status,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    accuracy_meters: input.accuracy_meters ?? null,
    location_verification_status: loc.location_verification_status,
    geofence_id: loc.geofence_id,
    notes: input.notes ?? null,
  });
  await audit.log(type, 'AttendanceEvent', event.id, null, event, ctx.audit);
  return event.toJSON();
}

export const checkIn = (ctx: RequestCtx, input: PunchInput) => punch(ctx, 'CHECK_IN', input);
export const checkOut = (ctx: RequestCtx, input: PunchInput) => punch(ctx, 'CHECK_OUT', input);

/** Resolves which employee ids the caller may read for attendance. `null` = everyone. */
async function resolveScope(ctx: RequestCtx, query: Record<string, unknown>): Promise<string[] | null> {
  const requested = typeof query.employee_id === 'string' && query.employee_id ? query.employee_id : null;
  if (requested && requested !== ctx.employeeId) {
    if (!ctx.permissions.has('attendance:view_team')) throw AppError.forbidden();
    if (!(await canManageEmployee(ctx, requested))) throw AppError.forbidden();
    return [requested];
  }
  if (!requested && query.scope === 'team') {
    if (!ctx.permissions.has('attendance:view_team')) throw AppError.forbidden();
    return visibleEmployeeIds(ctx);
  }
  return [requireEmployee(ctx)];
}

export async function status(ctx: RequestCtx) {
  const employeeId = requireEmployee(ctx);
  const last = await lastEvent(ctx, employeeId);
  return { checked_in: last?.event_type === 'CHECK_IN', last_event: last ? last.toJSON() : null };
}

export async function listEvents(ctx: RequestCtx, query: Record<string, unknown>) {
  const page = parsePagination(query, 200);
  const ids = await resolveScope(ctx, query);
  const where: WhereOptions[] = [{ tenant_id: ctx.tenantId }];
  if (ids) where.push({ employee_id: { [Op.in]: ids } });
  if (typeof query.from === 'string' && query.from) where.push({ timestamp: { [Op.gte]: new Date(`${query.from}T00:00:00.000Z`) } });
  if (typeof query.to === 'string' && query.to) where.push({ timestamp: { [Op.lte]: new Date(`${query.to}T23:59:59.999Z`) } });

  const { rows, count } = await AttendanceEvent.findAndCountAll({
    where: { [Op.and]: where },
    include: [{ model: Employee, as: 'employee', attributes: ['id', 'employee_number', 'full_name'] }],
    order: [['timestamp', 'DESC']],
    limit: page.limit,
    offset: page.offset,
  });
  return { items: rows.map((r) => r.toJSON()), pagination: buildPagination(count, page) };
}

/* ------------------------------- corrections ------------------------------- */

const CORRECTION_INCLUDES = [{ model: Employee, as: 'employee', attributes: ['id', 'employee_number', 'full_name'] }];

export async function listCorrections(ctx: RequestCtx, query: Record<string, unknown>) {
  const page = parsePagination(query);
  const where: WhereOptions[] = [{ tenant_id: ctx.tenantId }];
  const canApprove = ctx.permissions.has('attendance:approve');
  if (query.scope === 'team' && canApprove) {
    const ids = await visibleEmployeeIds(ctx);
    if (ids) where.push({ employee_id: { [Op.in]: ids } });
  } else {
    where.push({ employee_id: requireEmployee(ctx) });
  }
  if (typeof query.status === 'string' && query.status) where.push({ status: query.status });

  const { rows, count } = await AttendanceCorrection.findAndCountAll({
    where: { [Op.and]: where },
    include: CORRECTION_INCLUDES,
    order: [['created_at', 'DESC']],
    limit: page.limit,
    offset: page.offset,
  });
  return { items: rows.map((r) => r.toJSON()), pagination: buildPagination(count, page) };
}

export async function createCorrection(
  ctx: RequestCtx,
  input: {
    date: string;
    proposed_event_type: 'CHECK_IN' | 'CHECK_OUT';
    proposed_timestamp: Date;
    reason: string;
    attendance_event_id?: string | null;
  },
) {
  const employeeId = requireEmployee(ctx);
  if (input.proposed_timestamp.getTime() > Date.now() + 5 * 60_000) {
    throw AppError.badRequest('Corrections cannot be dated in the future');
  }
  if (input.attendance_event_id) {
    const ev = await AttendanceEvent.findOne({
      where: { id: input.attendance_event_id, tenant_id: ctx.tenantId, employee_id: employeeId },
      attributes: ['id'],
    });
    if (!ev) throw AppError.badRequest('Attendance event not found');
  }
  const row = await AttendanceCorrection.create({ ...input, tenant_id: ctx.tenantId, employee_id: employeeId, status: 'PENDING' });
  await audit.log('CREATE', 'AttendanceCorrection', row.id, null, row, ctx.audit);

  const emp = await Employee.findOne({ where: { id: employeeId, tenant_id: ctx.tenantId } });
  if (emp?.manager_employee_id) {
    await notifyEmployee(
      ctx.tenantId,
      emp.manager_employee_id,
      'ATTENDANCE_CORRECTION_REQUESTED',
      'Attendance correction requested',
      `${emp.full_name} requested a correction for ${input.date}.`,
      { type: 'AttendanceCorrection', id: row.id },
    );
  }
  return row.toJSON();
}

async function loadPendingCorrection(ctx: RequestCtx, id: string): Promise<Row> {
  const row = await AttendanceCorrection.findOne({ where: { id, tenant_id: ctx.tenantId } });
  if (!row) throw AppError.notFound('Correction not found');
  if (row.employee_id === ctx.employeeId) throw AppError.forbidden('You cannot decide your own correction');
  if (!(await canManageEmployee(ctx, row.employee_id))) throw AppError.forbidden();
  if (row.status !== 'PENDING') throw AppError.conflict(`Correction is already ${String(row.status).toLowerCase()}`);
  return row;
}

export async function approveCorrection(ctx: RequestCtx, id: string, note?: string | null) {
  const correction = await loadPendingCorrection(ctx, id);
  await sequelize.transaction(async (t) => {
    const [changed] = await AttendanceCorrection.update(
      { status: 'APPROVED', approver_id: ctx.userId, decided_at: new Date(), decision_note: note ?? null },
      { where: { id, tenant_id: ctx.tenantId, status: 'PENDING' }, transaction: t },
    );
    if (changed !== 1) throw AppError.conflict('Correction was already decided');
    // The original event is preserved; the correction is appended as a new event.
    const event = await AttendanceEvent.create(
      {
        tenant_id: ctx.tenantId,
        employee_id: correction.employee_id,
        event_type: correction.proposed_event_type,
        timestamp: correction.proposed_timestamp,
        source: 'CORRECTION',
        status: 'ACCEPTED',
        location_verification_status: 'NOT_REQUIRED',
        notes: `Correction ${correction.id}: ${correction.reason}`,
      },
      { transaction: t },
    );
    await audit.log(
      'APPROVE',
      'AttendanceCorrection',
      id,
      { status: 'PENDING' },
      { status: 'APPROVED', created_event_id: event.id, note },
      ctx.audit,
      t,
    );
  });
  await notifyEmployee(ctx.tenantId, correction.employee_id, 'ATTENDANCE_CORRECTION_APPROVED', 'Attendance correction approved', `Your correction for ${correction.date} was approved.`, {
    type: 'AttendanceCorrection',
    id,
  });
  return (await AttendanceCorrection.findByPk(id, { include: CORRECTION_INCLUDES }))?.toJSON();
}

export async function rejectCorrection(ctx: RequestCtx, id: string, note?: string | null) {
  const correction = await loadPendingCorrection(ctx, id);
  const [changed] = await AttendanceCorrection.update(
    { status: 'REJECTED', approver_id: ctx.userId, decided_at: new Date(), decision_note: note ?? null },
    { where: { id, tenant_id: ctx.tenantId, status: 'PENDING' } },
  );
  if (changed !== 1) throw AppError.conflict('Correction was already decided');
  await audit.log('REJECT', 'AttendanceCorrection', id, { status: 'PENDING' }, { status: 'REJECTED', note }, ctx.audit);
  await notifyEmployee(
    ctx.tenantId,
    correction.employee_id,
    'ATTENDANCE_CORRECTION_REJECTED',
    'Attendance correction rejected',
    `Your correction for ${correction.date} was rejected.${note ? ` Note: ${note}` : ''}`,
    { type: 'AttendanceCorrection', id },
  );
  return (await AttendanceCorrection.findByPk(id, { include: CORRECTION_INCLUDES }))?.toJSON();
}
