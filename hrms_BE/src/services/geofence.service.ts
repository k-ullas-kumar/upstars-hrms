import { Geofence } from '../models';
import { RequestCtx } from '../utils/audit';
import { AppError } from '../utils/errors';
import * as audit from './audit.service';

export interface GeofenceInput {
  name?: string;
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
  status?: 'ACTIVE' | 'INACTIVE';
}

async function load(ctx: RequestCtx, id: string) {
  const row = await Geofence.findOne({ where: { id, tenant_id: ctx.tenantId } });
  if (!row) throw AppError.notFound('Geofence not found');
  return row;
}

export async function list(ctx: RequestCtx, query: Record<string, unknown> = {}) {
  const where: Record<string, unknown> = { tenant_id: ctx.tenantId };
  if (typeof query.status === 'string' && query.status) where.status = query.status;
  const rows = await Geofence.findAll({ where, order: [['name', 'ASC']] });
  return rows.map((r) => r.toJSON());
}

export async function get(ctx: RequestCtx, id: string) {
  return (await load(ctx, id)).toJSON();
}

export async function create(ctx: RequestCtx, input: GeofenceInput) {
  const row = await Geofence.create({ ...input, tenant_id: ctx.tenantId });
  await audit.log('CREATE', 'Geofence', row.id, null, row, ctx.audit);
  return row.toJSON();
}

export async function update(ctx: RequestCtx, id: string, input: GeofenceInput) {
  const row = await load(ctx, id);
  const before = audit.snapshot(row);
  await row.update(input);
  await audit.log('UPDATE', 'Geofence', id, before, row, ctx.audit);
  return row.toJSON();
}

export async function remove(ctx: RequestCtx, id: string) {
  const row = await load(ctx, id);
  const before = audit.snapshot(row);
  await row.destroy();
  await audit.log('DELETE', 'Geofence', id, before, null, ctx.audit);
  return { id, deleted: true };
}
