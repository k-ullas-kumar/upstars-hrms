import { likeOp } from '../config/database';
import { Branch, Department, Designation, Employee, HrModel, Row, Tenant } from '../models';
import { RequestCtx } from '../utils/audit';
import { AppError } from '../utils/errors';
import * as audit from './audit.service';

export type OrgKind = 'Branch' | 'Department' | 'Designation';

const MODELS: Record<OrgKind, { model: HrModel; employeeFk: string }> = {
  Branch: { model: Branch, employeeFk: 'branch_id' },
  Department: { model: Department, employeeFk: 'department_id' },
  Designation: { model: Designation, employeeFk: 'designation_id' },
};

export interface OrgInput {
  name?: string;
  parent_id?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

async function withEmployeeCount(kind: OrgKind, rows: Row[], tenantId: string) {
  const { employeeFk } = MODELS[kind];
  const counts = await Employee.count({
    where: { tenant_id: tenantId, employment_status: 'ACTIVE' },
    group: [employeeFk],
  });
  const byId = new Map<string, number>();
  for (const c of counts as unknown as Array<Record<string, unknown>>) {
    const id = c[employeeFk] as string | null;
    if (id) byId.set(id, Number(c.count));
  }
  return rows.map((r) => ({ ...(r.toJSON() as object), employee_count: byId.get(r.id) ?? 0 }));
}

export async function listOrg(ctx: RequestCtx, kind: OrgKind, query: Record<string, unknown>) {
  const { model } = MODELS[kind];
  const where: Record<string, unknown> = { tenant_id: ctx.tenantId };
  if (typeof query.status === 'string' && query.status) where.status = query.status;
  if (typeof query.search === 'string' && query.search.trim()) where.name = { [likeOp]: `%${query.search.trim()}%` };
  const rows = await model.findAll({ where, order: [['name', 'ASC']] });
  return withEmployeeCount(kind, rows, ctx.tenantId);
}

async function loadOrg(ctx: RequestCtx, kind: OrgKind, id: string) {
  const row = await MODELS[kind].model.findOne({ where: { id, tenant_id: ctx.tenantId } });
  if (!row) throw AppError.notFound(`${kind} not found`);
  return row;
}

export async function getOrg(ctx: RequestCtx, kind: OrgKind, id: string) {
  const row = await loadOrg(ctx, kind, id);
  const [withCount] = await withEmployeeCount(kind, [row], ctx.tenantId);
  return withCount;
}

async function assertParent(ctx: RequestCtx, kind: OrgKind, parentId: string | null | undefined, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw AppError.badRequest('An item cannot be its own parent');
  const parent = await MODELS[kind].model.findOne({ where: { id: parentId, tenant_id: ctx.tenantId } });
  if (!parent) throw AppError.badRequest('Parent not found');
}

export async function createOrg(ctx: RequestCtx, kind: OrgKind, input: OrgInput) {
  await assertParent(ctx, kind, input.parent_id);
  const row = await MODELS[kind].model.create({
    tenant_id: ctx.tenantId,
    name: input.name,
    parent_id: input.parent_id ?? null,
    status: input.status ?? 'ACTIVE',
  });
  await audit.log('CREATE', kind, row.id, null, row, ctx.audit);
  return row.toJSON();
}

export async function updateOrg(ctx: RequestCtx, kind: OrgKind, id: string, input: OrgInput) {
  const row = await loadOrg(ctx, kind, id);
  const before = audit.snapshot(row);
  await assertParent(ctx, kind, input.parent_id, id);
  await row.update({
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.parent_id !== undefined ? { parent_id: input.parent_id } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  });
  await audit.log('UPDATE', kind, row.id, before, row, ctx.audit);
  return row.toJSON();
}

export async function deleteOrg(ctx: RequestCtx, kind: OrgKind, id: string) {
  const row = await loadOrg(ctx, kind, id);
  const { model, employeeFk } = MODELS[kind];
  const inUse = await Employee.count({ where: { tenant_id: ctx.tenantId, [employeeFk]: id } });
  if (inUse > 0) throw AppError.conflict(`${kind} is assigned to ${inUse} employee(s); mark it inactive instead`);
  const children = await model.count({ where: { tenant_id: ctx.tenantId, parent_id: id } });
  if (children > 0) throw AppError.conflict(`${kind} has child items; remove or re-parent them first`);
  const before = audit.snapshot(row);
  await row.destroy();
  await audit.log('DELETE', kind, id, before, null, ctx.audit);
  return { id, deleted: true };
}

export async function getTenant(ctx: RequestCtx) {
  const tenant = await Tenant.findByPk(ctx.tenantId);
  if (!tenant) throw AppError.notFound('Tenant not found');
  return tenant.toJSON();
}

export async function updateTenant(ctx: RequestCtx, input: { name?: string; timezone?: string }) {
  const tenant = await Tenant.findByPk(ctx.tenantId);
  if (!tenant) throw AppError.notFound('Tenant not found');
  const before = audit.snapshot(tenant);
  await tenant.update({
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
  });
  await audit.log('UPDATE', 'Tenant', tenant.id, before, tenant, ctx.audit);
  return tenant.toJSON();
}
