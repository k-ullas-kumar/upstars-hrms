export const PERMISSION_DEFS = [
  { key: 'tenant:manage', name: 'Manage tenants', description: 'Create and manage tenants (platform level)' },
  { key: 'org:manage', name: 'Manage organisation', description: 'Branches, departments, designations, tenant settings' },
  { key: 'employee:create', name: 'Create employees', description: 'Create employee records' },
  { key: 'employee:view', name: 'View employees', description: 'View the employee directory' },
  { key: 'employee:update', name: 'Update employees', description: 'Edit employee records and see sensitive fields' },
  { key: 'employee:deactivate', name: 'Deactivate employees', description: 'Deactivate or exit employees' },
  { key: 'employee:import', name: 'Import employees', description: 'Bulk import employees via CSV' },
  { key: 'employee:export', name: 'Export employees', description: 'Export employee data' },
  { key: 'leave:request', name: 'Request leave', description: 'Submit and cancel own leave requests' },
  { key: 'leave:approve', name: 'Approve leave', description: 'Approve or reject leave requests' },
  { key: 'leave:manage_types', name: 'Manage leave types', description: 'Configure leave types and balances' },
  { key: 'attendance:checkin', name: 'Check in/out', description: 'Record own attendance' },
  { key: 'attendance:correct', name: 'Request corrections', description: 'Request attendance corrections' },
  { key: 'attendance:approve', name: 'Approve corrections', description: 'Approve or reject attendance corrections' },
  { key: 'attendance:view_team', name: 'View team attendance', description: 'View attendance of team members' },
  { key: 'asset:manage', name: 'Manage assets', description: 'Create and edit assets' },
  { key: 'asset:assign', name: 'Assign assets', description: 'Assign and collect assets' },
  { key: 'document:manage', name: 'Manage document templates', description: 'Create and edit document templates' },
  { key: 'document:generate', name: 'Generate documents', description: 'Generate and issue documents' },
  { key: 'document:approve', name: 'Approve documents', description: 'Approve generated documents' },
  { key: 'team:manage', name: 'Manage teams', description: 'Create teams and memberships' },
  { key: 'task:manage', name: 'Manage tasks', description: 'Create and assign tasks' },
  { key: 'report:view', name: 'View reports', description: 'View reports' },
  { key: 'report:export', name: 'Export reports', description: 'Export reports to CSV' },
  { key: 'audit:view', name: 'View audit log', description: 'View audit events' },
  { key: 'notification:view', name: 'View notifications', description: 'View own notifications' },
  { key: 'onboarding:manage', name: 'Manage onboarding', description: 'Manage onboarding checklists' },
  { key: 'geofence:manage', name: 'Manage geofences', description: 'Manage attendance geofences' },
] as const;

export type PermissionKey = (typeof PERMISSION_DEFS)[number]['key'];
export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_DEFS.map((p) => p.key);

export const ROLE_NAMES = [
  'SAAS_SUPER_ADMIN',
  'COMPANY_ADMIN',
  'HR_MANAGER',
  'MANAGER',
  'EMPLOYEE',
  'ASSET_MANAGER',
] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

const SELF_SERVICE: PermissionKey[] = ['leave:request', 'attendance:checkin', 'attendance:correct', 'notification:view'];

export const ROLE_DEFS: Record<RoleName, { description: string; permissions: PermissionKey[] }> = {
  SAAS_SUPER_ADMIN: {
    description: 'Platform operator. Creates tenants; has no access to tenant HR content.',
    permissions: ['tenant:manage', 'notification:view'],
  },
  COMPANY_ADMIN: {
    description: 'Full administrative access within a tenant.',
    permissions: ALL_PERMISSION_KEYS.filter((k) => k !== 'tenant:manage'),
  },
  HR_MANAGER: {
    description: 'Manages people operations within a tenant.',
    permissions: [
      ...SELF_SERVICE,
      'org:manage',
      'employee:create',
      'employee:view',
      'employee:update',
      'employee:deactivate',
      'employee:import',
      'employee:export',
      'leave:approve',
      'leave:manage_types',
      'attendance:approve',
      'attendance:view_team',
      'document:manage',
      'document:generate',
      'document:approve',
      'team:manage',
      'task:manage',
      'report:view',
      'report:export',
      'onboarding:manage',
      'geofence:manage',
    ],
  },
  MANAGER: {
    description: 'Line manager: approves requests of direct reports.',
    permissions: [
      ...SELF_SERVICE,
      'employee:view',
      'leave:approve',
      'attendance:approve',
      'attendance:view_team',
      'task:manage',
      'report:view',
    ],
  },
  EMPLOYEE: {
    description: 'Standard employee self-service.',
    permissions: [...SELF_SERVICE],
  },
  ASSET_MANAGER: {
    description: 'Manages company assets and assignments.',
    permissions: [...SELF_SERVICE, 'employee:view', 'asset:manage', 'asset:assign', 'report:view'],
  },
};

/** Roles that only a COMPANY_ADMIN may grant (prevents privilege escalation by HR). */
export const ADMIN_ONLY_ROLES: RoleName[] = ['COMPANY_ADMIN', 'HR_MANAGER'];
/** Roles that can never be granted through tenant APIs. */
export const PLATFORM_ROLES: RoleName[] = ['SAAS_SUPER_ADMIN'];
