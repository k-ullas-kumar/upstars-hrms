import { Transaction } from 'sequelize';
import { Employee, Notification } from '../models';
import { RequestCtx } from '../utils/audit';
import { AppError } from '../utils/errors';
import { buildPagination, parsePagination } from '../utils/pagination';

export interface ResourceRef {
  type: string;
  id: string;
}

export async function notify(
  tenantId: string,
  userId: string | null | undefined,
  eventType: string,
  title: string,
  message: string | null,
  resource?: ResourceRef,
  transaction?: Transaction,
): Promise<void> {
  if (!userId) return;
  await Notification.create(
    {
      tenant_id: tenantId,
      user_id: userId,
      event_type: eventType,
      title,
      message,
      resource_type: resource?.type ?? null,
      resource_id: resource?.id ?? null,
    },
    { transaction },
  );
}

/** Notifies the user account linked to an employee (no-op when the employee has no login). */
export async function notifyEmployee(
  tenantId: string,
  employeeId: string,
  eventType: string,
  title: string,
  message: string | null,
  resource?: ResourceRef,
  transaction?: Transaction,
): Promise<void> {
  const emp = await Employee.findOne({ where: { id: employeeId, tenant_id: tenantId }, attributes: ['user_id'], transaction });
  await notify(tenantId, emp?.user_id, eventType, title, message, resource, transaction);
}

export async function list(ctx: RequestCtx, query: Record<string, unknown>) {
  const page = parsePagination(query, 200);
  const where: Record<string, unknown> = { tenant_id: ctx.tenantId, user_id: ctx.userId };
  if (query.unread === 'true' || query.unread === '1') where.read_at = null;
  const { rows, count } = await Notification.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: page.limit,
    offset: page.offset,
  });
  return { items: rows.map((r) => r.toJSON()), pagination: buildPagination(count, page) };
}

export async function unreadCount(ctx: RequestCtx): Promise<{ count: number }> {
  const count = await Notification.count({ where: { tenant_id: ctx.tenantId, user_id: ctx.userId, read_at: null } });
  return { count };
}

export async function markRead(ctx: RequestCtx, id: string) {
  const n = await Notification.findOne({ where: { id, tenant_id: ctx.tenantId, user_id: ctx.userId } });
  if (!n) throw AppError.notFound('Notification not found');
  if (!n.read_at) await n.update({ read_at: new Date() });
  return n.toJSON();
}

export async function markAllRead(ctx: RequestCtx) {
  const [updated] = await Notification.update(
    { read_at: new Date() },
    { where: { tenant_id: ctx.tenantId, user_id: ctx.userId, read_at: null } },
  );
  return { updated };
}
