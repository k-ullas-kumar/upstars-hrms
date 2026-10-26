import { DataTypes, defineModel, tenantIdAttr } from './define';
import { IMPORT_STATUSES, TENANT_STATUSES, USER_STATUSES } from './constants';

export const Tenant = defineModel('Tenant', 'tenants', {
  name: { type: DataTypes.STRING(200), allowNull: false },
  slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVE', validate: { isIn: [[...TENANT_STATUSES]] } },
  timezone: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'UTC' },
});

export const User = defineModel('User', 'users', {
  tenant_id: { type: DataTypes.UUID, allowNull: true }, // null only for platform users
  email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  full_name: { type: DataTypes.STRING(200), allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVE', validate: { isIn: [[...USER_STATUSES]] } },
  last_login_at: { type: DataTypes.DATE, allowNull: true },
  password_reset_token: { type: DataTypes.STRING(128), allowNull: true },
  password_reset_expires: { type: DataTypes.DATE, allowNull: true },
});

export const Role = defineModel(
  'Role',
  'roles',
  {
    tenant_id: { type: DataTypes.UUID, allowNull: true }, // null = system role
    name: { type: DataTypes.STRING(80), allowNull: false },
    description: { type: DataTypes.STRING(500), allowNull: true },
  },
  { indexes: [{ unique: true, fields: ['tenant_id', 'name'] }] },
);

export const Permission = defineModel('Permission', 'permissions', {
  key: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(120), allowNull: false },
  description: { type: DataTypes.STRING(500), allowNull: true },
});

export const RolePermission = defineModel(
  'RolePermission',
  'role_permissions',
  {
    role_id: { type: DataTypes.UUID, allowNull: false },
    permission_id: { type: DataTypes.UUID, allowNull: false },
  },
  { indexes: [{ unique: true, fields: ['role_id', 'permission_id'] }] },
);

export const UserRole = defineModel(
  'UserRole',
  'user_roles',
  {
    user_id: { type: DataTypes.UUID, allowNull: false },
    role_id: { type: DataTypes.UUID, allowNull: false },
  },
  { indexes: [{ unique: true, fields: ['user_id', 'role_id'] }] },
);

export const SystemSetting = defineModel(
  'SystemSetting',
  'system_settings',
  {
    tenant_id: tenantIdAttr,
    key: { type: DataTypes.STRING(120), allowNull: false },
    value: { type: DataTypes.JSON, allowNull: true },
  },
  { indexes: [{ unique: true, fields: ['tenant_id', 'key'] }] },
);

export const ImportJob = defineModel('ImportJob', 'import_jobs', {
  tenant_id: tenantIdAttr,
  created_by: { type: DataTypes.UUID, allowNull: false },
  kind: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'EMPLOYEES' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PREVIEW', validate: { isIn: [[...IMPORT_STATUSES]] } },
  payload: { type: DataTypes.JSON, allowNull: true },
  summary: { type: DataTypes.JSON, allowNull: true },
});
