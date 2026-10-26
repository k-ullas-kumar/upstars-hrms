export interface AuthContext {
  userId: string;
  /** null for platform users (SAAS_SUPER_ADMIN). */
  tenantId: string | null;
  email: string;
  fullName: string;
  roles: string[];
  permissions: Set<string>;
  employeeId: string | null;
}
