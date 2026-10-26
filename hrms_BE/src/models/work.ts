import { DataTypes, defineModel, tenantIdAttr } from './define';
import { ACTIVE_STATUSES, ONBOARDING_ITEM_STATUSES, ONBOARDING_STATUSES, TASK_PRIORITIES, TASK_STATUSES } from './constants';

export const Team = defineModel(
  'Team',
  'teams',
  {
    tenant_id: tenantIdAttr,
    name: { type: DataTypes.STRING(160), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    lead_employee_id: { type: DataTypes.UUID, allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVE', validate: { isIn: [[...ACTIVE_STATUSES]] } },
  },
  { indexes: [{ unique: true, fields: ['tenant_id', 'name'] }] },
);

export const TeamMembership = defineModel(
  'TeamMembership',
  'team_memberships',
  {
    tenant_id: tenantIdAttr,
    team_id: { type: DataTypes.UUID, allowNull: false },
    employee_id: { type: DataTypes.UUID, allowNull: false },
    role: { type: DataTypes.STRING(60), allowNull: true },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: true },
  },
  { indexes: [{ fields: ['tenant_id', 'team_id'] }, { fields: ['tenant_id', 'employee_id'] }] },
);

export const Task = defineModel(
  'Task',
  'tasks',
  {
    tenant_id: tenantIdAttr,
    team_id: { type: DataTypes.UUID, allowNull: true },
    title: { type: DataTypes.STRING(240), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    owner_employee_id: { type: DataTypes.UUID, allowNull: false },
    created_by: { type: DataTypes.UUID, allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'TODO', validate: { isIn: [[...TASK_STATUSES]] } },
    due_at: { type: DataTypes.DATE, allowNull: true },
    priority: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'MEDIUM', validate: { isIn: [[...TASK_PRIORITIES]] } },
  },
  { indexes: [{ fields: ['tenant_id', 'status'] }, { fields: ['tenant_id', 'owner_employee_id'] }] },
);

export const OnboardingChecklist = defineModel('OnboardingChecklist', 'onboarding_checklists', {
  tenant_id: tenantIdAttr,
  employee_id: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING(160), allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING', validate: { isIn: [[...ONBOARDING_STATUSES]] } },
});

export const OnboardingItem = defineModel('OnboardingItem', 'onboarding_items', {
  tenant_id: tenantIdAttr,
  checklist_id: { type: DataTypes.UUID, allowNull: false },
  employee_id: { type: DataTypes.UUID, allowNull: false },
  title: { type: DataTypes.STRING(240), allowNull: false },
  owner_user_id: { type: DataTypes.UUID, allowNull: true },
  due_date: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING', validate: { isIn: [[...ONBOARDING_ITEM_STATUSES]] } },
  completed_at: { type: DataTypes.DATE, allowNull: true },
});
