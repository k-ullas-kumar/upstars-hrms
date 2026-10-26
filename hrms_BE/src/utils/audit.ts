import { Request } from 'express';
import { AppError } from './errors';
import { AuthContext } from '../types/auth';

export interface AuditContext {
  tenant_id: string | null;
  actor_user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
}

/** Everything a service needs to know about the caller. Tenant id is always taken from the verified JWT/user. */
export interface RequestCtx {
  tenantId: string;
  userId: string;
  employeeId: string | null;
  roles: string[];
  permissions: Set<string>;
  audit: AuditContext;
}

export function getAuditContext(req: Request, auth?: AuthContext): AuditContext {
  const a = auth ?? req.auth;
  return {
    tenant_id: a?.tenantId ?? null,
    actor_user_id: a?.userId ?? null,
    ip_address: req.ip ?? null,
    user_agent: (req.get('user-agent') ?? '').slice(0, 400) || null,
    request_id: req.requestId ?? null,
  };
}

/** Builds the tenant-scoped request context; throws if the caller has no tenant. */
export function buildCtx(req: Request): RequestCtx {
  const auth = req.auth;
  if (!auth) throw AppError.unauthorized();
  if (!auth.tenantId) throw AppError.forbidden('This action requires a tenant context');
  return {
    tenantId: auth.tenantId,
    userId: auth.userId,
    employeeId: auth.employeeId,
    roles: auth.roles,
    permissions: auth.permissions,
    audit: getAuditContext(req, auth),
  };
}

export const can = (ctx: RequestCtx, permission: string) => ctx.permissions.has(permission);
/** HR-level scope: may see/modify any employee in the tenant. */
export const isHrScope = (ctx: RequestCtx) => ctx.permissions.has('employee:update');
