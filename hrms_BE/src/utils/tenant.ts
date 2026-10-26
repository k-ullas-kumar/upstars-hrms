/**
 * Pure helpers enforcing the "tenant comes from the JWT only" rule.
 * Kept free of DB/framework imports so they are trivially unit-testable.
 */

const TENANT_KEYS = ['tenant_id', 'tenantId'] as const;

/** Returns a copy of `where` that is always constrained to `tenantId`, overriding any client-supplied value. */
export function withTenant<T extends Record<string, unknown>>(
  tenantId: string,
  where: T = {} as T,
): T & { tenant_id: string } {
  if (!tenantId) {
    throw new Error('withTenant requires a tenantId');
  }
  return { ...where, tenant_id: tenantId };
}

/** Returns a copy of `data` with any client-supplied tenant identifiers removed. */
export function stripTenantFields<T extends Record<string, unknown>>(data: T): Omit<T, 'tenant_id' | 'tenantId'> {
  const copy: Record<string, unknown> = { ...data };
  for (const key of TENANT_KEYS) delete copy[key];
  return copy as Omit<T, 'tenant_id' | 'tenantId'>;
}

/** Builds a record for insertion: client data (sans tenant fields) + server-trusted tenant id. */
export function forTenantInsert<T extends Record<string, unknown>>(
  tenantId: string,
  data: T,
): Omit<T, 'tenant_id' | 'tenantId'> & { tenant_id: string } {
  return { ...stripTenantFields(data), tenant_id: tenantId };
}

/** True when a row belongs to the given tenant. */
export function belongsToTenant(row: { tenant_id?: string | null } | null | undefined, tenantId: string): boolean {
  return !!row && !!tenantId && row.tenant_id === tenantId;
}
