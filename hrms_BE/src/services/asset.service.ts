import { Op, WhereOptions } from 'sequelize';
import { likeOp, sequelize } from '../config/database';
import { Asset, AssetAssignment, Employee, Row } from '../models';
import { RequestCtx } from '../utils/audit';
import { AppError } from '../utils/errors';
import { buildPagination, parsePagination } from '../utils/pagination';
import * as audit from './audit.service';
import { notifyEmployee } from './notification.service';

export interface AssetInput {
  asset_tag?: string;
  category?: string;
  serial_number?: string | null;
  status?: 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'RETIRED';
  condition?: string | null;
  location?: string | null;
  purchase_date?: string | null;
  warranty_until?: string | null;
  notes?: string | null;
}

const ASSIGNMENT_INCLUDES = [
  { model: Asset, as: 'asset', attributes: ['id', 'asset_tag', 'category', 'serial_number', 'status'] },
  { model: Employee, as: 'employee', attributes: ['id', 'employee_number', 'full_name'] },
];

async function loadAsset(ctx: RequestCtx, id: string): Promise<Row> {
  const row = await Asset.findOne({ where: { id, tenant_id: ctx.tenantId } });
  if (!row) throw AppError.notFound('Asset not found');
  return row;
}

export async function list(ctx: RequestCtx, query: Record<string, unknown>) {
  const page = parsePagination(query, 200);
  const where: WhereOptions[] = [{ tenant_id: ctx.tenantId }];
  if (typeof query.status === 'string' && query.status) where.push({ status: query.status });
  if (typeof query.category === 'string' && query.category) where.push({ category: query.category });
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const pattern = `%${search}%`;
    where.push({
      [Op.or]: [
        { asset_tag: { [likeOp]: pattern } },
        { serial_number: { [likeOp]: pattern } },
        { category: { [likeOp]: pattern } },
      ],
    });
  }
  const { rows, count } = await Asset.findAndCountAll({
    where: { [Op.and]: where },
    order: [['asset_tag', 'ASC']],
    limit: page.limit,
    offset: page.offset,
  });

  // Attach the current holder for assigned assets.
  const assignedIds = rows.filter((r) => r.status === 'ASSIGNED').map((r) => r.id as string);
  const holders = assignedIds.length
    ? await AssetAssignment.findAll({
        where: { tenant_id: ctx.tenantId, asset_id: { [Op.in]: assignedIds }, returned_at: null },
        include: [{ model: Employee, as: 'employee', attributes: ['id', 'employee_number', 'full_name'] }],
      })
    : [];
  const holderByAsset = new Map(holders.map((h) => [h.asset_id as string, h.employee?.toJSON() ?? null]));
  const items = rows.map((r) => ({ ...r.toJSON(), assigned_to: holderByAsset.get(r.id) ?? null }));
  return { items, pagination: buildPagination(count, page) };
}

export async function get(ctx: RequestCtx, id: string) {
  const asset = await Asset.findOne({
    where: { id, tenant_id: ctx.tenantId },
    include: [{ model: AssetAssignment, as: 'assignments', include: [{ model: Employee, as: 'employee', attributes: ['id', 'employee_number', 'full_name'] }] }],
    order: [[{ model: AssetAssignment, as: 'assignments' }, 'assigned_at', 'DESC']],
  });
  if (!asset) throw AppError.notFound('Asset not found');
  return asset.toJSON();
}

export async function create(ctx: RequestCtx, input: AssetInput) {
  const dup = await Asset.findOne({ where: { tenant_id: ctx.tenantId, asset_tag: input.asset_tag }, attributes: ['id'] });
  if (dup) throw AppError.conflict('An asset with this tag already exists');
  if (input.status === 'ASSIGNED') throw AppError.badRequest('Use the assignment endpoint to assign an asset');
  const row = await Asset.create({ ...input, tenant_id: ctx.tenantId });
  await audit.log('CREATE', 'Asset', row.id, null, row, ctx.audit);
  return row.toJSON();
}

export async function update(ctx: RequestCtx, id: string, input: AssetInput) {
  const row = await loadAsset(ctx, id);
  if (input.status && input.status !== row.status && (input.status === 'ASSIGNED' || row.status === 'ASSIGNED')) {
    throw AppError.badRequest('Use the assignment endpoints to assign or return an asset');
  }
  if (input.asset_tag && input.asset_tag !== row.asset_tag) {
    const dup = await Asset.findOne({ where: { tenant_id: ctx.tenantId, asset_tag: input.asset_tag }, attributes: ['id'] });
    if (dup) throw AppError.conflict('An asset with this tag already exists');
  }
  const before = audit.snapshot(row);
  await row.update(input);
  await audit.log('UPDATE', 'Asset', id, before, row, ctx.audit);
  return row.toJSON();
}

export async function remove(ctx: RequestCtx, id: string) {
  const row = await loadAsset(ctx, id);
  if (row.status === 'ASSIGNED') throw AppError.conflict('Return the asset before deleting it');
  const history = await AssetAssignment.count({ where: { tenant_id: ctx.tenantId, asset_id: id } });
  const before = audit.snapshot(row);
  if (history > 0) {
    await row.update({ status: 'RETIRED' });
    await audit.log('RETIRE', 'Asset', id, before, row, ctx.audit);
    return { id, deleted: false, retired: true };
  }
  await row.destroy();
  await audit.log('DELETE', 'Asset', id, before, null, ctx.audit);
  return { id, deleted: true };
}

/* ------------------------------- assignments ------------------------------- */

export async function listAssignments(ctx: RequestCtx, query: Record<string, unknown>) {
  const page = parsePagination(query, 200);
  const where: WhereOptions[] = [{ tenant_id: ctx.tenantId }];
  const manager = ctx.permissions.has('asset:assign') || ctx.permissions.has('asset:manage');
  if (!manager || query.scope === 'mine') {
    if (!ctx.employeeId) throw AppError.forbidden('Your account is not linked to an employee record');
    where.push({ employee_id: ctx.employeeId });
  } else if (typeof query.employee_id === 'string' && query.employee_id) {
    where.push({ employee_id: query.employee_id });
  }
  if (typeof query.asset_id === 'string' && query.asset_id) where.push({ asset_id: query.asset_id });
  if (query.active === 'true' || query.active === '1') where.push({ returned_at: null });

  const { rows, count } = await AssetAssignment.findAndCountAll({
    where: { [Op.and]: where },
    include: ASSIGNMENT_INCLUDES,
    order: [['assigned_at', 'DESC']],
    limit: page.limit,
    offset: page.offset,
  });
  return { items: rows.map((r) => r.toJSON()), pagination: buildPagination(count, page) };
}

export async function assign(
  ctx: RequestCtx,
  input: { asset_id: string; employee_id: string; condition_out?: string | null; accessories?: string[] | null; notes?: string | null },
) {
  const asset = await loadAsset(ctx, input.asset_id);
  const emp = await Employee.findOne({ where: { id: input.employee_id, tenant_id: ctx.tenantId } });
  if (!emp) throw AppError.badRequest('Unknown employee');
  if (emp.employment_status !== 'ACTIVE') throw AppError.badRequest('Assets can only be assigned to active employees');
  if (asset.status !== 'AVAILABLE') throw AppError.conflict(`Asset is not available (current status: ${asset.status})`);

  const assignmentId = await sequelize.transaction(async (t) => {
    // Atomic AVAILABLE -> ASSIGNED transition prevents double assignment.
    const [changed] = await Asset.update(
      { status: 'ASSIGNED' },
      { where: { id: asset.id, tenant_id: ctx.tenantId, status: 'AVAILABLE' }, transaction: t },
    );
    if (changed !== 1) throw AppError.conflict('Asset is no longer available');
    const assignment = await AssetAssignment.create(
      {
        tenant_id: ctx.tenantId,
        asset_id: asset.id,
        employee_id: emp.id,
        assigned_at: new Date(),
        assigned_by: ctx.userId,
        condition_out: input.condition_out ?? asset.condition ?? null,
        accessories: input.accessories ?? null,
        notes: input.notes ?? null,
      },
      { transaction: t },
    );
    await audit.log('ASSIGN', 'AssetAssignment', assignment.id, null, assignment, ctx.audit, t);
    return assignment.id as string;
  });

  await notifyEmployee(ctx.tenantId, emp.id, 'ASSET_ASSIGNED', 'Asset assigned', `${asset.category} ${asset.asset_tag} was assigned to you. Please acknowledge receipt.`, {
    type: 'AssetAssignment',
    id: assignmentId,
  });
  return (await AssetAssignment.findByPk(assignmentId, { include: ASSIGNMENT_INCLUDES }))?.toJSON();
}

export async function acknowledge(ctx: RequestCtx, assignmentId: string) {
  const row = await AssetAssignment.findOne({ where: { id: assignmentId, tenant_id: ctx.tenantId } });
  if (!row) throw AppError.notFound('Assignment not found');
  if (!ctx.employeeId || row.employee_id !== ctx.employeeId) throw AppError.forbidden('Only the assignee can acknowledge this asset');
  if (row.returned_at) throw AppError.conflict('Asset was already returned');
  if (!row.acknowledged_at) {
    await row.update({ acknowledged_at: new Date() });
    await audit.log('ACKNOWLEDGE', 'AssetAssignment', row.id, null, row, ctx.audit);
  }
  return (await AssetAssignment.findByPk(row.id, { include: ASSIGNMENT_INCLUDES }))?.toJSON();
}

export async function returnAsset(
  ctx: RequestCtx,
  assignmentId: string,
  input: { condition_in?: string | null; notes?: string | null },
) {
  const row = await AssetAssignment.findOne({ where: { id: assignmentId, tenant_id: ctx.tenantId } });
  if (!row) throw AppError.notFound('Assignment not found');
  if (row.returned_at) throw AppError.conflict('Asset was already returned');

  await sequelize.transaction(async (t) => {
    const [changed] = await AssetAssignment.update(
      {
        returned_at: new Date(),
        returned_by: ctx.userId,
        condition_in: input.condition_in ?? null,
        notes: input.notes ?? row.notes ?? null,
      },
      { where: { id: row.id, tenant_id: ctx.tenantId, returned_at: null }, transaction: t },
    );
    if (changed !== 1) throw AppError.conflict('Asset was already returned');
    await Asset.update(
      { status: 'AVAILABLE', ...(input.condition_in ? { condition: input.condition_in } : {}) },
      { where: { id: row.asset_id, tenant_id: ctx.tenantId }, transaction: t },
    );
    await audit.log('RETURN', 'AssetAssignment', row.id, { returned_at: null }, { returned_at: new Date() }, ctx.audit, t);
  });
  return (await AssetAssignment.findByPk(row.id, { include: ASSIGNMENT_INCLUDES }))?.toJSON();
}
