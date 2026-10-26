import { DataTypes, defineModel, tenantIdAttr } from './define';
import { LEAVE_STATUSES } from './constants';

export const LeaveType = defineModel(
  'LeaveType',
  'leave_types',
  {
    tenant_id: tenantIdAttr,
    name: { type: DataTypes.STRING(120), allowNull: false },
    code: { type: DataTypes.STRING(20), allowNull: false },
    paid: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    /** 0 means unlimited (balance is tracked but not enforced). */
    max_days_per_year: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    carry_forward: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { indexes: [{ unique: true, fields: ['tenant_id', 'code'] }] },
);

export const LeaveBalance = defineModel(
  'LeaveBalance',
  'leave_balances',
  {
    tenant_id: tenantIdAttr,
    employee_id: { type: DataTypes.UUID, allowNull: false },
    leave_type_id: { type: DataTypes.UUID, allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false },
    /** Remaining days available. */
    balance: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    /** Days consumed by approved leave. */
    used: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  },
  { indexes: [{ unique: true, fields: ['tenant_id', 'employee_id', 'leave_type_id', 'year'] }] },
);

export const LeaveRequest = defineModel(
  'LeaveRequest',
  'leave_requests',
  {
    tenant_id: tenantIdAttr,
    employee_id: { type: DataTypes.UUID, allowNull: false },
    leave_type_id: { type: DataTypes.UUID, allowNull: false },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: false },
    days: { type: DataTypes.FLOAT, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING', validate: { isIn: [[...LEAVE_STATUSES]] } },
    approver_id: { type: DataTypes.UUID, allowNull: true }, // user id of decider
    decided_at: { type: DataTypes.DATE, allowNull: true },
    decision_note: { type: DataTypes.TEXT, allowNull: true },
  },
  { indexes: [{ fields: ['tenant_id', 'employee_id', 'status'] }, { fields: ['tenant_id', 'start_date'] }] },
);
