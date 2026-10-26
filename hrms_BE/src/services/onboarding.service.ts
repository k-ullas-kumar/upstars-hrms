import { Op, WhereOptions } from 'sequelize';
import { sequelize } from '../config/database';
import { Employee, OnboardingChecklist, OnboardingItem, Row } from '../models';
import { RequestCtx } from '../utils/audit';
import { AppError } from '../utils/errors';
import { buildPagination, parsePagination } from '../utils/pagination';
import * as audit from './audit.service';
import { notifyEmployee } from './notification.service';
import { getTenantEmployee } from './scope';

const INCLUDES = [
  { model: Employee, as: 'employee', attributes: ['id', 'employee_number', 'full_name'] },
  { model: OnboardingItem, as: 'items' },
];

export interface ChecklistInput {
  employee_id: string;
  name: string;
  items?: Array<{ title: string; owner_user_id?: string | null; due_date?: string | null }>;
}

const canManage = (ctx: RequestCtx) => ctx.permissions.has('onboarding:manage');

async function loadChecklist(ctx: RequestCtx, id: string): Promise<Row> {
  const row = await OnboardingChecklist.findOne({
    where: { id, tenant_id: ctx.tenantId },
    include: INCLUDES,
    order: [[{ model: OnboardingItem, as: 'items' }, 'created_at', 'ASC']],
  });
  if (!row) throw AppError.notFound('Checklist not found');
  if (!canManage(ctx) && row.employee_id !== ctx.employeeId) throw AppError.forbidden();
  return row;
}

export async function list(ctx: RequestCtx, query: Record<string, unknown>) {
  const page = parsePagination(query);
  const where: WhereOptions[] = [{ tenant_id: ctx.tenantId }];
  if (!canManage(ctx)) {
    where.push({ employee_id: ctx.employeeId ?? '' });
  } else if (typeof query.employee_id === 'string' && query.employee_id) {
    where.push({ employee_id: query.employee_id });
  }
  if (typeof query.status === 'string' && query.status) where.push({ status: query.status });
  const { rows, count } = await OnboardingChecklist.findAndCountAll({
    where: { [Op.and]: where },
    include: INCLUDES,
    order: [['created_at', 'DESC']],
    limit: page.limit,
    offset: page.offset,
    distinct: true,
  });
  return { items: rows.map((r) => r.toJSON()), pagination: buildPagination(count, page) };
}

export async function get(ctx: RequestCtx, id: string) {
  return (await loadChecklist(ctx, id)).toJSON();
}

export async function create(ctx: RequestCtx, input: ChecklistInput) {
  const emp = await getTenantEmployee(ctx, input.employee_id).catch(() => {
    throw AppError.badRequest('Unknown employee');
  });
  const id = await sequelize.transaction(async (t) => {
    const checklist = await OnboardingChecklist.create(
      { tenant_id: ctx.tenantId, employee_id: emp.id, name: input.name, status: 'PENDING' },
      { transaction: t },
    );
    for (const item of input.items ?? []) {
      await OnboardingItem.create(
        {
          tenant_id: ctx.tenantId,
          checklist_id: checklist.id,
          employee_id: emp.id,
          title: item.title,
          owner_user_id: item.owner_user_id ?? null,
          due_date: item.due_date ?? null,
        },
        { transaction: t },
      );
    }
    await audit.log('CREATE', 'OnboardingChecklist', checklist.id, null, checklist, ctx.audit, t);
    return checklist.id as string;
  });
  await notifyEmployee(ctx.tenantId, emp.id, 'ONBOARDING_ASSIGNED', 'Onboarding checklist', `Your onboarding checklist "${input.name}" is ready.`, {
    type: 'OnboardingChecklist',
    id,
  });
  return (await loadChecklist(ctx, id)).toJSON();
}

export async function addItem(
  ctx: RequestCtx,
  checklistId: string,
  input: { title: string; owner_user_id?: string | null; due_date?: string | null },
) {
  const checklist = await loadChecklist(ctx, checklistId);
  if (!canManage(ctx)) throw AppError.forbidden();
  const item = await OnboardingItem.create({
    tenant_id: ctx.tenantId,
    checklist_id: checklist.id,
    employee_id: checklist.employee_id,
    title: input.title,
    owner_user_id: input.owner_user_id ?? null,
    due_date: input.due_date ?? null,
  });
  if (checklist.status === 'COMPLETED') await checklist.update({ status: 'IN_PROGRESS' });
  await audit.log('CREATE', 'OnboardingItem', item.id, null, item, ctx.audit);
  return item.toJSON();
}

export async function completeItem(ctx: RequestCtx, itemId: string) {
  const item = await OnboardingItem.findOne({ where: { id: itemId, tenant_id: ctx.tenantId } });
  if (!item) throw AppError.notFound('Checklist item not found');
  const allowed = canManage(ctx) || item.owner_user_id === ctx.userId || item.employee_id === ctx.employeeId;
  if (!allowed) throw AppError.forbidden();
  if (item.status === 'COMPLETED') throw AppError.conflict('Item is already completed');

  await sequelize.transaction(async (t) => {
    const [changed] = await OnboardingItem.update(
      { status: 'COMPLETED', completed_at: new Date() },
      { where: { id: itemId, tenant_id: ctx.tenantId, status: 'PENDING' }, transaction: t },
    );
    if (changed !== 1) throw AppError.conflict('Item is already completed');
    const remaining = await OnboardingItem.count({
      where: { tenant_id: ctx.tenantId, checklist_id: item.checklist_id, status: 'PENDING' },
      transaction: t,
    });
    await OnboardingChecklist.update(
      { status: remaining === 0 ? 'COMPLETED' : 'IN_PROGRESS' },
      { where: { id: item.checklist_id, tenant_id: ctx.tenantId }, transaction: t },
    );
    await audit.log('COMPLETE', 'OnboardingItem', itemId, { status: 'PENDING' }, { status: 'COMPLETED' }, ctx.audit, t);
  });
  return (await loadChecklist(ctx, item.checklist_id)).toJSON();
}
