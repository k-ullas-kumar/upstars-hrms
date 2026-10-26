import { Op } from 'sequelize';
import { env } from '../config/env';
import { Employee, Permission, Role, Row, Tenant, User } from '../models';
import { AuthContext } from '../types/auth';
import { AuditContext } from '../utils/audit';
import { hashPassword, randomToken, sha256, signToken, verifyPassword } from '../utils/crypto';
import { AppError } from '../utils/errors';
import * as audit from './audit.service';

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  employeeId: string | null;
  tenantId: string | null;
  tenantName: string | null;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function loadUserWithRoles(userId: string) {
  return User.findByPk(userId, {
    include: [{ model: Role, as: 'roles', include: [{ model: Permission, as: 'permissions' }] }],
  });
}

/** Resolves the full auth context for a verified JWT subject. Returns null when the session is not valid. */
export async function loadAuthContext(userId: string, tokenTenantId: string | null): Promise<AuthContext | null> {
  const user = await loadUserWithRoles(userId);
  if (!user || user.status !== 'ACTIVE') return null;
  // The token's tenant must match the user's tenant: tenant is never taken from client input.
  if ((user.tenant_id ?? null) !== (tokenTenantId ?? null)) return null;

  if (user.tenant_id) {
    const tenant = await Tenant.findByPk(user.tenant_id, { attributes: ['id', 'status'] });
    if (!tenant || tenant.status !== 'ACTIVE') return null;
  }

  const roles: Row[] = user.roles ?? [];
  const permissions = new Set<string>();
  for (const role of roles) for (const p of role.permissions ?? []) permissions.add(p.key as string);

  let employeeId: string | null = null;
  if (user.tenant_id) {
    const emp = await Employee.findOne({
      where: { user_id: user.id, tenant_id: user.tenant_id },
      attributes: ['id'],
    });
    employeeId = emp?.id ?? null;
  }

  return {
    userId: user.id,
    tenantId: user.tenant_id ?? null,
    email: user.email,
    fullName: user.full_name,
    roles: roles.map((r) => r.name as string).sort(),
    permissions,
    employeeId,
  };
}

export async function buildUserPayload(auth: AuthContext): Promise<UserPayload> {
  let tenantName: string | null = null;
  if (auth.tenantId) {
    const tenant = await Tenant.findByPk(auth.tenantId, { attributes: ['name'] });
    tenantName = tenant?.name ?? null;
  }
  return {
    id: auth.userId,
    email: auth.email,
    name: auth.fullName,
    roles: auth.roles,
    permissions: [...auth.permissions].sort(),
    employeeId: auth.employeeId,
    tenantId: auth.tenantId,
    tenantName,
  };
}

export async function login(email: string, password: string, auditCtx: AuditContext) {
  const user = await User.findOne({ where: { email: normalizeEmail(email) } });
  const valid = await verifyPassword(password, user?.password_hash);
  if (!user || !valid || user.status !== 'ACTIVE') {
    throw AppError.unauthorized('Invalid email or password');
  }
  const auth = await loadAuthContext(user.id, user.tenant_id ?? null);
  if (!auth) throw AppError.unauthorized('Your account or organisation is not active');

  await user.update({ last_login_at: new Date() });
  const ctx: AuditContext = { ...auditCtx, tenant_id: auth.tenantId, actor_user_id: auth.userId };
  await audit.log('LOGIN', 'User', user.id, null, null, ctx);

  return { token: signToken(user.id, user.tenant_id ?? null), user: await buildUserPayload(auth) };
}

export async function logout(auditCtx: AuditContext, userId: string) {
  await audit.log('LOGOUT', 'User', userId, null, null, auditCtx);
  return { loggedOut: true };
}

export async function forgotPassword(email: string, auditCtx: AuditContext) {
  const user = await User.findOne({ where: { email: normalizeEmail(email), status: 'ACTIVE' } });
  const result: { message: string; reset_token?: string } = {
    message: 'If that email is registered, a reset link has been sent.',
  };
  if (!user) return result;

  const token = randomToken(32);
  await user.update({
    password_reset_token: sha256(token),
    password_reset_expires: new Date(Date.now() + env.resetTokenTtlMinutes * 60_000),
  });
  await audit.log(
    'PASSWORD_RESET_REQUESTED',
    'User',
    user.id,
    null,
    null,
    { ...auditCtx, tenant_id: user.tenant_id ?? null, actor_user_id: user.id },
  );
  // No mail transport is configured: outside production the token is returned so the flow can be exercised.
  if (!env.isProduction) result.reset_token = token;
  return result;
}

export async function resetPassword(token: string, newPassword: string, auditCtx: AuditContext) {
  const user = await User.findOne({
    where: { password_reset_token: sha256(token), password_reset_expires: { [Op.gt]: new Date() } },
  });
  if (!user) throw AppError.badRequest('Reset token is invalid or has expired');
  await user.update({
    password_hash: await hashPassword(newPassword),
    password_reset_token: null,
    password_reset_expires: null,
  });
  await audit.log(
    'PASSWORD_RESET',
    'User',
    user.id,
    null,
    null,
    { ...auditCtx, tenant_id: user.tenant_id ?? null, actor_user_id: user.id },
  );
  return { message: 'Password updated. You can now sign in.' };
}
