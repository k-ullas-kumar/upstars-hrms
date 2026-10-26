import { Op, Transaction } from 'sequelize';
import { AuditEvent, Row, User } from '../models';
import { AuditContext, RequestCtx } from '../utils/audit';
import { buildPagination, parsePagination } from '../utils/pagination';

const SENSITIVE_KEYS = new Set(['password', 'password_hash', 'password_reset_token', 'token', 'new_password']);

/** Plain-object snapshot with secrets removed, safe to store in the audit log. */
export function snapshot(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  const raw =
    typeof (value as { get?: unknown }).get === 'function'
      ? ((value as Row).get({ plain: true }) as Record<string, unknown>)
      : (value as Record<string, unknown>);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (SENSITIVE_KEYS.has(k)) continue;
    if (v !== null && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) continue; // skip associations
    out[k] = v;
  }
  return out;
}

export async function log(
  action: string,
  entityType: string,
  entityId: string | null,
  oldValues: unknown,
  newValues: unknown,
  audit: AuditContext,
  transaction?: Transaction,
): Promise<void> {
  await AuditEvent.create(
    {
      tenant_id: audit.tenant_id,
      actor_user_id: audit.actor_user_id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: snapshot(oldValues),
      new_values: snapshot(newValues),
      ip_address: audit.ip_address,
      user_agent: audit.user_agent,
      request_id: audit.request_id,
    },
    { transaction },
  );
}

export async function listEvents(ctx: RequestCtx, query: Record<string, unknown>) {
  const page = parsePagination(query);
  const where: Record<string | symbol, unknown> = { tenant_id: ctx.tenantId };
  if (typeof query.entity_type === 'string' && query.entity_type) where.entity_type = query.entity_type;
  if (typeof query.entity_id === 'string' && query.entity_id) where.entity_id = query.entity_id;
  if (typeof query.action === 'string' && query.action) where.action = query.action;
  if (typeof query.actor_user_id === 'string' && query.actor_user_id) where.actor_user_id = query.actor_user_id;
  const range: Record<symbol, Date> = {};
  if (typeof query.from === 'string' && query.from) range[Op.gte] = new Date(query.from);
  if (typeof query.to === 'string' && query.to) range[Op.lte] = new Date(`${query.to}T23:59:59.999Z`);
  if (Reflect.ownKeys(range).length) where.created_at = range;

  const { rows, count } = await AuditEvent.findAndCountAll({
    where,
    include: [{ model: User, as: 'actor', attributes: ['id', 'full_name', 'email'] }],
    order: [['created_at', 'DESC']],
    limit: page.limit,
    offset: page.offset,
  });
  return { items: rows.map((r) => r.toJSON()), pagination: buildPagination(count, page) };
}

export async function recent(ctx: RequestCtx, limit = 10) {
  const rows = await AuditEvent.findAll({
    where: { tenant_id: ctx.tenantId },
    include: [{ model: User, as: 'actor', attributes: ['id', 'full_name', 'email'] }],
    order: [['created_at', 'DESC']],
    limit,
  });
  return rows.map((r) => r.toJSON());
}
