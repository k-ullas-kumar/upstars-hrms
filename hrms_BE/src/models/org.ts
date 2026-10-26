import { DataTypes, defineModel, tenantIdAttr } from './define';
import { ACTIVE_STATUSES, EMPLOYMENT_STATUSES } from './constants';

const orgAttrs = () => ({
  tenant_id: tenantIdAttr,
  name: { type: DataTypes.STRING(160), allowNull: false },
  parent_id: { type: DataTypes.UUID, allowNull: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVE', validate: { isIn: [[...ACTIVE_STATUSES]] } },
});

export const Branch = defineModel('Branch', 'branches', orgAttrs(), {
  indexes: [{ unique: true, fields: ['tenant_id', 'name'] }],
});
export const Department = defineModel('Department', 'departments', orgAttrs(), {
  indexes: [{ unique: true, fields: ['tenant_id', 'name'] }],
});
export const Designation = defineModel('Designation', 'designations', orgAttrs(), {
  indexes: [{ unique: true, fields: ['tenant_id', 'name'] }],
});

export const Employee = defineModel(
  'Employee',
  'employees',
  {
    tenant_id: tenantIdAttr,
    user_id: { type: DataTypes.UUID, allowNull: true },
    employee_number: { type: DataTypes.STRING(40), allowNull: false },
    full_name: { type: DataTypes.STRING(200), allowNull: false },
    work_email: { type: DataTypes.STRING(255), allowNull: false },
    phone: { type: DataTypes.STRING(40), allowNull: true },
    manager_employee_id: { type: DataTypes.UUID, allowNull: true },
    branch_id: { type: DataTypes.UUID, allowNull: true },
    department_id: { type: DataTypes.UUID, allowNull: true },
    designation_id: { type: DataTypes.UUID, allowNull: true },
    employment_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'ACTIVE',
      validate: { isIn: [[...EMPLOYMENT_STATUSES]] },
    },
    joining_date: { type: DataTypes.DATEONLY, allowNull: false },
    exit_date: { type: DataTypes.DATEONLY, allowNull: true },
    date_of_birth: { type: DataTypes.DATEONLY, allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    indexes: [
      { unique: true, fields: ['tenant_id', 'employee_number'] },
      { unique: true, fields: ['tenant_id', 'work_email'] },
      { fields: ['tenant_id', 'employment_status'] },
    ],
  },
);
