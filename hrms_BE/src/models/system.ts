import { DataTypes, defineModel, tenantIdAttr } from './define';

export const Notification = defineModel(
  'Notification',
  'notifications',
  {
    tenant_id: tenantIdAttr,
    user_id: { type: DataTypes.UUID, allowNull: false },
    event_type: { type: DataTypes.STRING(80), allowNull: false },
    title: { type: DataTypes.STRING(240), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: true },
    resource_type: { type: DataTypes.STRING(60), allowNull: true },
    resource_id: { type: DataTypes.UUID, allowNull: true },
    read_at: { type: DataTypes.DATE, allowNull: true },
  },
  { indexes: [{ fields: ['tenant_id', 'user_id', 'read_at'] }] },
);

export const AuditEvent = defineModel(
  'AuditEvent',
  'audit_events',
  {
    tenant_id: { type: DataTypes.UUID, allowNull: true }, // null for platform-level events
    actor_user_id: { type: DataTypes.UUID, allowNull: true },
    action: { type: DataTypes.STRING(80), allowNull: false },
    entity_type: { type: DataTypes.STRING(60), allowNull: false },
    entity_id: { type: DataTypes.STRING(64), allowNull: true },
    old_values: { type: DataTypes.JSON, allowNull: true },
    new_values: { type: DataTypes.JSON, allowNull: true },
    ip_address: { type: DataTypes.STRING(64), allowNull: true },
    user_agent: { type: DataTypes.STRING(400), allowNull: true },
    request_id: { type: DataTypes.STRING(64), allowNull: true },
  },
  { updatedAt: false, indexes: [{ fields: ['tenant_id', 'created_at'] }, { fields: ['tenant_id', 'entity_type', 'entity_id'] }] },
);
