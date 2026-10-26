import { sequelize } from '../config/database';
import { HrModel } from './define';
import {
  ImportJob,
  Permission,
  Role,
  RolePermission,
  SystemSetting,
  Tenant,
  User,
  UserRole,
} from './core';
import { Branch, Department, Designation, Employee } from './org';
import { LeaveBalance, LeaveRequest, LeaveType } from './leave';
import { AttendanceCorrection, AttendanceEvent, Geofence } from './attendance';
import { Asset, AssetAssignment } from './assets';
import { ApprovalRequest, ApprovalStep, DocumentTemplate, GeneratedDocument } from './documents';
import { OnboardingChecklist, OnboardingItem, Task, Team, TeamMembership } from './work';
import { AuditEvent, Notification } from './system';

// ---- tenant ownership -------------------------------------------------------
const tenantOwned: HrModel[] = [
  User,
  Role,
  SystemSetting,
  ImportJob,
  Branch,
  Department,
  Designation,
  Employee,
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  Geofence,
  AttendanceEvent,
  AttendanceCorrection,
  Asset,
  AssetAssignment,
  DocumentTemplate,
  GeneratedDocument,
  ApprovalRequest,
  ApprovalStep,
  Team,
  TeamMembership,
  Task,
  OnboardingChecklist,
  OnboardingItem,
  Notification,
  AuditEvent,
];
for (const model of tenantOwned) {
  model.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant', constraints: model !== AuditEvent });
}

// ---- RBAC -------------------------------------------------------------------
User.belongsToMany(Role, { through: UserRole, foreignKey: 'user_id', otherKey: 'role_id', as: 'roles' });
Role.belongsToMany(User, { through: UserRole, foreignKey: 'role_id', otherKey: 'user_id', as: 'users' });
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: 'role_id',
  otherKey: 'permission_id',
  as: 'permissions',
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: 'permission_id',
  otherKey: 'role_id',
  as: 'roles',
});

// ---- organisation -----------------------------------------------------------
for (const model of [Branch, Department, Designation]) {
  model.belongsTo(model, { foreignKey: 'parent_id', as: 'parent' });
}

Employee.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Employee.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' });
Employee.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });
Employee.belongsTo(Designation, { foreignKey: 'designation_id', as: 'designation' });
Employee.belongsTo(Employee, { foreignKey: 'manager_employee_id', as: 'manager' });
Employee.hasMany(Employee, { foreignKey: 'manager_employee_id', as: 'reports' });
User.hasOne(Employee, { foreignKey: 'user_id', as: 'employee' });

// ---- leave ------------------------------------------------------------------
LeaveBalance.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
LeaveBalance.belongsTo(LeaveType, { foreignKey: 'leave_type_id', as: 'leave_type' });
LeaveRequest.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
LeaveRequest.belongsTo(LeaveType, { foreignKey: 'leave_type_id', as: 'leave_type' });
LeaveRequest.belongsTo(User, { foreignKey: 'approver_id', as: 'approver', constraints: false });

// ---- attendance -------------------------------------------------------------
AttendanceEvent.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
AttendanceEvent.belongsTo(Geofence, { foreignKey: 'geofence_id', as: 'geofence' });
AttendanceCorrection.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
AttendanceCorrection.belongsTo(AttendanceEvent, { foreignKey: 'attendance_event_id', as: 'attendance_event' });
AttendanceCorrection.belongsTo(User, { foreignKey: 'approver_id', as: 'approver', constraints: false });

// ---- assets -----------------------------------------------------------------
AssetAssignment.belongsTo(Asset, { foreignKey: 'asset_id', as: 'asset' });
AssetAssignment.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
Asset.hasMany(AssetAssignment, { foreignKey: 'asset_id', as: 'assignments' });

// ---- documents / approvals --------------------------------------------------
GeneratedDocument.belongsTo(DocumentTemplate, { foreignKey: 'template_id', as: 'template' });
GeneratedDocument.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
ApprovalStep.belongsTo(ApprovalRequest, { foreignKey: 'approval_request_id', as: 'approval_request' });
ApprovalRequest.hasMany(ApprovalStep, { foreignKey: 'approval_request_id', as: 'steps' });

// ---- teams / tasks / onboarding ---------------------------------------------
Team.belongsTo(Employee, { foreignKey: 'lead_employee_id', as: 'lead' });
TeamMembership.belongsTo(Team, { foreignKey: 'team_id', as: 'team' });
TeamMembership.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
Team.hasMany(TeamMembership, { foreignKey: 'team_id', as: 'memberships' });
Task.belongsTo(Team, { foreignKey: 'team_id', as: 'team' });
Task.belongsTo(Employee, { foreignKey: 'owner_employee_id', as: 'owner' });
OnboardingChecklist.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });
OnboardingChecklist.hasMany(OnboardingItem, { foreignKey: 'checklist_id', as: 'items' });
OnboardingItem.belongsTo(OnboardingChecklist, { foreignKey: 'checklist_id', as: 'checklist' });
OnboardingItem.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

// ---- system -----------------------------------------------------------------
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
AuditEvent.belongsTo(User, { foreignKey: 'actor_user_id', as: 'actor', constraints: false });

export {
  sequelize,
  Tenant,
  User,
  Role,
  Permission,
  RolePermission,
  UserRole,
  SystemSetting,
  ImportJob,
  Branch,
  Department,
  Designation,
  Employee,
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  Geofence,
  AttendanceEvent,
  AttendanceCorrection,
  Asset,
  AssetAssignment,
  DocumentTemplate,
  GeneratedDocument,
  ApprovalRequest,
  ApprovalStep,
  Team,
  TeamMembership,
  Task,
  OnboardingChecklist,
  OnboardingItem,
  Notification,
  AuditEvent,
};
export type { Row, HrModel } from './define';
