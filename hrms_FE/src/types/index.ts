/**
 * Permission keys. These mirror the backend's colon-style keys exactly
 * (see hrms_BE/src/config/permissions.ts). '*' grants everything.
 */
export const PERMISSIONS = {
  employeeView: 'employee:view',
  employeeCreate: 'employee:create',
  employeeUpdate: 'employee:update',
  employeeDeactivate: 'employee:deactivate',
  employeeImport: 'employee:import',
  employeeExport: 'employee:export',
  orgManage: 'org:manage',
  leaveRequest: 'leave:request',
  leaveApprove: 'leave:approve',
  leaveManageTypes: 'leave:manage_types',
  attendanceCheckin: 'attendance:checkin',
  attendanceCorrect: 'attendance:correct',
  attendanceApprove: 'attendance:approve',
  attendanceViewTeam: 'attendance:view_team',
  assetManage: 'asset:manage',
  assetAssign: 'asset:assign',
  documentManage: 'document:manage',
  documentGenerate: 'document:generate',
  documentApprove: 'document:approve',
  teamManage: 'team:manage',
  taskManage: 'task:manage',
  reportView: 'report:view',
  reportExport: 'report:export',
  auditView: 'audit:view',
  notificationView: 'notification:view',
  onboardingManage: 'onboarding:manage',
  geofenceManage: 'geofence:manage',
  tenantManage: 'tenant:manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface Ref {
  id: string;
  name: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  employeeId?: string | null;
  tenantId?: string | null;
  tenantName?: string | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

/* ------------------------------ Organisation ------------------------------ */

export interface OrgEntity {
  id: string;
  name: string;
  parentId?: string | null;
  status?: string;
  employeeCount?: number;
}

export type Department = OrgEntity;
export type Branch = OrgEntity;
export type Designation = OrgEntity;

/* -------------------------------- Employees ------------------------------- */

export interface Employee {
  id: string;
  employeeNumber: string;
  name: string;
  workEmail: string;
  phone?: string | null;
  department?: Ref | null;
  designation?: Ref | null;
  branch?: Ref | null;
  manager?: Ref | null;
  employmentStatus: string;
  employmentType?: string | null;
  joiningDate?: string | null;
  exitDate?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  location?: string | null;
}

/* ---------------------------------- Leave --------------------------------- */

export interface LeaveType {
  id: string;
  name: string;
  code?: string;
  paid?: boolean;
  maxDaysPerYear?: number;
  carryForward?: boolean;
}

export interface LeaveBalance {
  leaveTypeId: string;
  leaveTypeName: string;
  entitled: number;
  used: number;
  pending?: number;
  remaining: number;
}

export interface LeaveRequest {
  id: string;
  employee?: Ref | null;
  leaveType?: Ref | null;
  startDate: string;
  endDate: string;
  days?: number;
  reason?: string | null;
  status: string;
  approver?: Ref | null;
  decisionNote?: string | null;
  createdAt?: string;
}

/* ------------------------------- Attendance ------------------------------- */

export interface AttendanceEvent {
  id: string;
  employee?: Ref | null;
  /** Lower-cased: `check_in` | `check_out`. */
  type: string;
  timestamp: string;
  source?: string | null;
  status?: string | null;
  locationStatus?: string | null;
  note?: string | null;
}

export interface AttendanceDay {
  date: string;
  firstIn?: string | null;
  lastOut?: string | null;
  workedMinutes: number;
  events: AttendanceEvent[];
}

export interface AttendanceCorrection {
  id: string;
  employee?: Ref | null;
  date: string;
  proposedType: string;
  proposedTimestamp?: string | null;
  reason: string;
  status: string;
  decisionNote?: string | null;
  createdAt?: string;
}

/* --------------------------------- Assets --------------------------------- */

export interface AssetAssignment {
  id: string;
  employee?: Ref | null;
  assignedAt?: string | null;
  returnedAt?: string | null;
  acknowledgedAt?: string | null;
  conditionOut?: string | null;
  conditionOnReturn?: string | null;
  notes?: string | null;
}

export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  category?: string | null;
  serialNumber?: string | null;
  status: string;
  condition?: string | null;
  location?: string | null;
  purchaseDate?: string | null;
  warrantyUntil?: string | null;
  notes?: string | null;
  /** The open (not yet returned) assignment, when the API provides it. */
  currentAssignment?: AssetAssignment | null;
}

export interface AssetDetail extends Asset {
  history: AssetAssignment[];
}

/* -------------------------------- Documents ------------------------------- */

export interface DocumentTemplate {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  bodyTemplate?: string | null;
  requiredFields: string[];
  version?: number | string;
  status?: string;
}

export interface DocumentPreview {
  text?: string;
  html?: string;
  missing: string[];
}

export interface GeneratedDocument {
  id: string;
  template?: Ref | null;
  employee?: Ref | null;
  status: string;
  version?: number;
  generatedBy?: Ref | null;
  issuedAt?: string | null;
  createdAt: string;
  preview?: DocumentPreview | null;
}

/* ---------------------------- Teams and tasks ----------------------------- */

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  lead?: Ref | null;
  memberCount?: number;
  members?: (Ref & { role?: string | null })[];
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueAt?: string | null;
  team?: Ref | null;
  owner?: Ref | null;
}

/* ------------------------------- Onboarding ------------------------------- */

export interface OnboardingTask {
  id: string;
  title: string;
  dueDate?: string | null;
  done: boolean;
}

export interface OnboardingCase {
  id: string;
  name: string;
  employee: Ref | null;
  status: string;
  tasks: OnboardingTask[];
}

/* ----------------------------- Platform / misc ----------------------------- */

export interface NotificationItem {
  id: string;
  title: string;
  body?: string | null;
  eventType?: string;
  href?: string | null;
  createdAt: string;
  readAt?: string | null;
}

export interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  actor?: Ref | null;
  summary?: string | null;
  ipAddress?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  createdAt: string;
}

export interface CompanySettings {
  name: string;
  timezone: string;
  slug?: string | null;
  status?: string | null;
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  permissions: string[];
  userCount?: number;
}

export interface PendingAction {
  id: string;
  type: string;
  title: string;
  subtitle?: string | null;
  href?: string | null;
  count?: number;
  createdAt?: string;
}

export interface ActivityItem {
  id: string;
  text: string;
  actor?: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  activeEmployees?: number;
  pendingApprovals: number;
  openTasks?: number;
  presentToday?: number;
  pendingActions: PendingAction[];
  recentActivity: ActivityItem[];
  headcountByDepartment: { name: string; count: number }[];
  attendanceTrend: { date: string; present: number; absent: number }[];
}

export interface ImportPreviewRow {
  row: number;
  values: Record<string, string>;
  errors: string[];
}

export interface ImportPreview {
  importId: string | null;
  total: number;
  valid: number;
  invalid: number;
  rows: ImportPreviewRow[];
  errors: { row: number; message: string }[];
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
}
