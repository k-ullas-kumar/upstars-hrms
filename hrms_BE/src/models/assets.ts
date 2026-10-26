import { DataTypes, defineModel, tenantIdAttr } from './define';
import { ASSET_STATUSES } from './constants';

export const Asset = defineModel(
  'Asset',
  'assets',
  {
    tenant_id: tenantIdAttr,
    asset_tag: { type: DataTypes.STRING(60), allowNull: false },
    category: { type: DataTypes.STRING(80), allowNull: false },
    serial_number: { type: DataTypes.STRING(120), allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'AVAILABLE', validate: { isIn: [[...ASSET_STATUSES]] } },
    condition: { type: DataTypes.STRING(60), allowNull: true },
    location: { type: DataTypes.STRING(160), allowNull: true },
    purchase_date: { type: DataTypes.DATEONLY, allowNull: true },
    warranty_until: { type: DataTypes.DATEONLY, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  { indexes: [{ unique: true, fields: ['tenant_id', 'asset_tag'] }, { fields: ['tenant_id', 'status'] }] },
);

export const AssetAssignment = defineModel(
  'AssetAssignment',
  'asset_assignments',
  {
    tenant_id: tenantIdAttr,
    asset_id: { type: DataTypes.UUID, allowNull: false },
    employee_id: { type: DataTypes.UUID, allowNull: false },
    assigned_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    returned_at: { type: DataTypes.DATE, allowNull: true },
    condition_out: { type: DataTypes.STRING(60), allowNull: true },
    condition_in: { type: DataTypes.STRING(60), allowNull: true },
    accessories: { type: DataTypes.JSON, allowNull: true },
    acknowledged_at: { type: DataTypes.DATE, allowNull: true },
    assigned_by: { type: DataTypes.UUID, allowNull: true },
    returned_by: { type: DataTypes.UUID, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  { indexes: [{ fields: ['tenant_id', 'asset_id'] }, { fields: ['tenant_id', 'employee_id'] }] },
);
