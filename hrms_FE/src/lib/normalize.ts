/**
 * Defensive mappers from raw API records to the camelCase types in `types/index.ts`.
 * The backend is snake_case at the database layer, so every reader accepts both
 * `some_key` and `someKey` (and a few common aliases). Pass snake_case names to the helpers.
 */
import type {
  ActivityItem,
  AssetAssignment,
  Asset,
  AssetDetail,
  AttendanceCorrection,
  AttendanceEvent,
  AuditEvent,
  CompanySettings,
  DashboardSummary,
  DocumentPreview,
  DocumentTemplate,
  Employee,
  GeneratedDocument,
  ImportPreview,
  ImportPreviewRow,
  ImportResult,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  NotificationItem,
  OnboardingCase,
  OrgEntity,
  PendingAction,
  Ref,
  Role,
  Task,
  Team,
} from '../types';
import { titleCase } from './format';

export type Rec = Record<string, unknown>;

export const isRec = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const asRec = (value: unknown): Rec => (isRec(value) ? value : {});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

export function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

/** First non-null value among the given keys, trying snake_case and camelCase for each. */
export function get(record: Rec, ...keys: string[]): unknown {
  for (const key of keys) {
    for (const candidate of [key, toCamel(key)]) {
      const value = record[candidate];
      if (value !== undefined && value !== null) return value;
    }
  }
  return undefined;
}

export function str(record: Rec, ...keys: string[]): string | undefined {
  const value = get(record, ...keys);
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

export function num(record: Rec, ...keys: string[]): number | undefined {
  const value = get(record, ...keys);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

export function bool(record: Rec, ...keys: string[]): boolean | undefined {
  const value = get(record, ...keys);
  return typeof value === 'boolean' ? value : undefined;
}

export function arr(record: Rec, ...keys: string[]): unknown[] {
  const value = get(record, ...keys);
  return Array.isArray(value) ? value : [];
}

export function strArr(record: Rec, ...keys: string[]): string[] {
  return arr(record, ...keys).filter((item): item is string => typeof item === 'string');
}

/** Extracts `{ id, name }` from a nested object, an id+name column pair, or a bare id. */
export function ref(record: Rec, base: string, idKeys?: string[]): Ref | null {
  const value = get(record, base);
  let id: string | undefined;
  let name: string | undefined;

  if (isRec(value)) {
    id = str(value, 'id');
    name = str(value, 'name', 'full_name', 'title', 'email');
  } else if (typeof value === 'string') {
    if (UUID.test(value)) id = value;
    else name = value;
  }
  id = id ?? str(record, ...(idKeys ?? [`${base}_id`]));
  name = name ?? str(record, `${base}_name`, `${base}_full_name`);
  if (!id && !name) return null;
  return { id: id ?? '', name: name ?? '' };
}

export const lower = (value: string | null | undefined): string => (value ?? '').toLowerCase();
export const isStatus = (value: string | null | undefined, ...expected: string[]): boolean =>
  expected.some((candidate) => lower(value) === candidate.toLowerCase());

/* -------------------------------- Mappers --------------------------------- */

export function normOrg(raw: unknown): OrgEntity {
  const r = asRec(raw);
  return {
    id: str(r, 'id') ?? '',
    name: str(r, 'name') ?? '',
    parentId: str(r, 'parent_id') ?? null,
    status: str(r, 'status') ?? 'ACTIVE',
    employeeCount: num(r, 'employee_count', 'employees_count'),
  };
}

export function normEmployee(raw: unknown): Employee {
  const r = asRec(raw);
  return {
    id: str(r, 'id') ?? '',
    employeeNumber: str(r, 'employee_number', 'employee_code') ?? '',
    name: str(r, 'full_name', 'name') ?? '',
    workEmail: str(r, 'work_email', 'email') ?? '',
    phone: str(r, 'phone') ?? null,
    department: ref(r, 'department'),
    designation: ref(r, 'designation'),
    branch: ref(r, 'branch'),
    manager: ref(r, 'manager', ['manager_employee_id', 'manager_id']),
    employmentStatus: str(r, 'employment_status', 'status') ?? 'ACTIVE',
    employmentType: str(r, 'employment_type') ?? null,
    joiningDate: str(r, 'joining_date') ?? null,
    exitDate: str(r, 'exit_date') ?? null,
    dateOfBirth: str(r, 'date_of_birth') ?? null,
    address: str(r, 'address') ?? null,
    location: str(r, 'location') ?? null,
  };
}

export function normLeaveType(raw: unknown): LeaveType {
  const r = asRec(raw);
  return {
    id: str(r, 'id') ?? '',
    name: str(r, 'name') ?? '',
    code: str(r, 'code'),
    paid: bool(r, 'paid'),
    maxDaysPerYear: num(r, 'max_days_per_year'),
    carryForward: bool(r, 'carry_forward'),
  };
}

export function normLeaveBalance(raw: unknown): LeaveBalance {
  const r = asRec(raw);
  const type = ref(r, 'leave_type');
  const remaining = num(r, 'balance', 'remaining') ?? 0;
  const used = num(r, 'used') ?? 0;
  return {
    leaveTypeId: type?.id ?? str(r, 'leave_type_id') ?? str(r, 'id') ?? '',
    leaveTypeName: type?.name || str(r, 'leave_type_name', 'name') || '',
    entitled: num(r, 'entitled', 'allocated', 'total') ?? remaining + used,
    used,
    pending: num(r, 'pending'),
    remaining,
  };
}

export function normLeaveRequest(raw: unknown): LeaveRequest {
  const r = asRec(raw);
  return {
    id: str(r, 'id') ?? '',
    employee: ref(r, 'employee'),
    leaveType: ref(r, 'leave_type'),
    startDate: str(r, 'start_date') ?? '',
    endDate: str(r, 'end_date') ?? '',
    days: num(r, 'days'),
    reason: str(r, 'reason') ?? null,
    status: str(r, 'status') ?? 'PENDING',
    approver: ref(r, 'approver', ['approver_id']),
    decisionNote: str(r, 'decision_note') ?? null,
    createdAt: str(r, 'created_at'),
  };
}

export function normAttendanceEvent(raw: unknown): AttendanceEvent {
  const r = asRec(raw);
  return {
    id: str(r, 'id') ?? '',
    employee: ref(r, 'employee'),
    type: lower(str(r, 'event_type', 'type')) || 'check_in',
    timestamp: str(r, 'timestamp', 'created_at') ?? '',
    source: str(r, 'source') ?? null,
    status: str(r, 'status') ?? null,
    locationStatus: str(r, 'location_verification_status', 'location_status') ?? null,
    note: str(r, 'notes', 'note') ?? null,
  };
}

export function normCorrection(raw: unknown): AttendanceCorrection {
  const r = asRec(raw);
  return {
    id: str(r, 'id') ?? '',
    employee: ref(r, 'employee'),
    date: str(r, 'date') ?? '',
    proposedType: lower(str(r, 'proposed_event_type', 'event_type')) || 'check_in',
    proposedTimestamp: str(r, 'proposed_timestamp') ?? null,
    reason: str(r, 'reason') ?? '',
    status: str(r, 'status') ?? 'PENDING',
    decisionNote: str(r, 'decision_note') ?? null,
    createdAt: str(r, 'created_at'),
  };
}

export function normAssignment(raw: unknown): AssetAssignment {
  const r = asRec(raw);
  return {
    id: str(r, 'id') ?? '',
    employee: ref(r, 'employee'),
    assignedAt: str(r, 'assigned_at') ?? null,
    returnedAt: str(r, 'returned_at') ?? null,
    acknowledgedAt: str(r, 'acknowledged_at') ?? null,
    conditionOut: str(r, 'condition_out') ?? null,
    conditionOnReturn: str(r, 'condition_in', 'condition_on_return') ?? null,
    notes: str(r, 'notes') ?? null,
  };
}

export function normAsset(raw: unknown): Asset {
  const r = asRec(raw);
  const tag = str(r, 'asset_tag', 'tag') ?? '';
  const nested = get(r, 'current_assignment', 'active_assignment', 'assignment');
  let currentAssignment: AssetAssignment | null = isRec(nested) ? normAssignment(nested) : null;
  if (!currentAssignment) {
    const assignee = ref(r, 'assigned_to', ['assigned_employee_id', 'assignee_id']) ?? ref(r, 'assignee');
    if (assignee) {
      currentAssignment = {
        id: str(r, 'assignment_id', 'current_assignment_id') ?? '',
        employee: assignee,
        assignedAt: str(r, 'assigned_at') ?? null,
        acknowledgedAt: str(r, 'acknowledged_at') ?? null,
      };
    }
  }
  return {
    id: str(r, 'id') ?? '',
    assetTag: tag,
    name: str(r, 'name', 'description') ?? str(r, 'category') ?? tag,
    category: str(r, 'category') ?? null,
    serialNumber: str(r, 'serial_number') ?? null,
    status: str(r, 'status') ?? 'AVAILABLE',
    condition: str(r, 'condition') ?? null,
    location: str(r, 'location') ?? null,
    purchaseDate: str(r, 'purchase_date') ?? null,
    warrantyUntil: str(r, 'warranty_until') ?? null,
    notes: str(r, 'notes') ?? null,
    currentAssignment,
  };
}

export function normAssetDetail(raw: unknown): AssetDetail {
  const r = asRec(raw);
  const base = normAsset(isRec(r.asset) ? r.asset : r);
  const history = arr(r, 'assignments', 'history', 'assignment_history').map(normAssignment);
  const open = history.find((entry) => !entry.returnedAt) ?? null;
  return { ...base, currentAssignment: base.currentAssignment ?? open, history };
}

function normPreview(value: unknown): DocumentPreview | null {
  if (typeof value === 'string') return { text: value, missing: [] };
  if (!isRec(value)) return null;
  return {
    text: str(value, 'text', 'rendered', 'body', 'content'),
    html: str(value, 'html'),
    missing: strArr(value, 'missing', 'missing_fields'),
  };
}

export function normTemplate(raw: unknown): DocumentTemplate {
  const r = asRec(raw);
  return {
    id: str(r, 'id') ?? '',
    name: str(r, 'name') ?? '',
    code: str(r, 'code') ?? null,
    description: str(r, 'description') ?? null,
    bodyTemplate: str(r, 'body_template', 'body') ?? null,
    requiredFields: strArr(r, 'required_fields'),
    version: num(r, 'version'),
    status: str(r, 'status'),
  };
}

export function normGeneratedDocument(raw: unknown): GeneratedDocument {
  const r = asRec(raw);
  return {
    id: str(r, 'id') ?? '',
    template: ref(r, 'template'),
    employee: ref(r, 'employee'),
    status: str(r, 'status') ?? 'DRAFT',
    version: num(r, 'version'),
    generatedBy: ref(r, 'generated_by', ['generated_by']),
    issuedAt: str(r, 'issued_at') ?? null,
    createdAt: str(r, 'created_at') ?? '',
    preview: normPreview(get(r, 'preview_payload', 'preview')),
  };
}

export function normTeam(raw: unknown): Team {
  const r = asRec(raw);
  const members = arr(r, 'members', 'memberships').map((entry) => {
    const m = asRec(entry);
    const employee = ref(m, 'employee');
    return {
      id: employee?.id || str(m, 'employee_id', 'id') || '',
      name: employee?.name || str(m, 'full_name', 'name') || '',
      role: str(m, 'role') ?? null,
    };
  });
  return {
    id: str(r, 'id') ?? '',
    name: str(r, 'name') ?? '',
    description: str(r, 'description') ?? null,
    lead: ref(r, 'lead', ['lead_employee_id', 'lead_id']),
    memberCount: num(r, 'member_count', 'members_count') ?? (members.length > 0 ? members.length : undefined),
    members,
  };
}

export function normTask(raw: unknown): Task {
  const r = asRec(raw);
  return {
    id: str(r, 'id') ?? '',
    title: str(r, 'title') ?? '',
    description: str(r, 'description') ?? null,
    status: str(r, 'status') ?? 'TODO',
    priority: str(r, 'priority') ?? 'MEDIUM',
    dueAt: str(r, 'due_at', 'due_date') ?? null,
    team: ref(r, 'team'),
    owner: ref(r, 'owner', ['owner_employee_id', 'owner_id']),
  };
}

export function normOnboarding(raw: unknown): OnboardingCase {
  const r = asRec(raw);
  return {
    id: str(r, 'id') ?? '',
    name: str(r, 'name', 'title') ?? 'Onboarding checklist',
    employee: ref(r, 'employee'),
    status: str(r, 'status') ?? 'PENDING',
    tasks: arr(r, 'items', 'tasks').map((entry) => {
      const t = asRec(entry);
      const status = str(t, 'status');
      return {
        id: str(t, 'id') ?? '',
        title: str(t, 'title', 'name') ?? '',
        dueDate: str(t, 'due_date') ?? null,
        done: bool(t, 'done', 'completed') ?? (isStatus(status, 'completed', 'done') || Boolean(get(t, 'completed_at'))),
      };
    }),
  };
}

const RESOURCE_ROUTES: Record<string, string> = {
  leave_request: '/leave',
  leave: '/leave',
  attendance_correction: '/attendance',
  attendance: '/attendance',
  asset: '/assets',
  asset_assignment: '/assets',
  generated_document: '/documents',
  document: '/documents',
  task: '/tasks',
  team: '/teams',
  onboarding: '/people/onboarding',
  onboarding_checklist: '/people/onboarding',
};

/** Best-effort deep link for an entity type (+ id) coming from notifications, approvals or audit rows. */
export function routeForResource(type: string | undefined, id?: string | null): string | null {
  if (!type) return null;
  const key = toSnake(type).replace(/^_/, '').toLowerCase();
  if (key === 'employee' && id) return `/people/employees/${id}`;
  return RESOURCE_ROUTES[key] ?? null;
}

export function normNotification(raw: unknown): NotificationItem {
  const r = asRec(raw);
  const resourceType = str(r, 'resource_type');
  return {
    id: str(r, 'id') ?? '',
    title: str(r, 'title') ?? 'Notification',
    body: str(r, 'message', 'body') ?? null,
    eventType: str(r, 'event_type'),
    href: str(r, 'href', 'link') ?? routeForResource(resourceType, str(r, 'resource_id')),
    createdAt: str(r, 'created_at') ?? new Date().toISOString(),
    readAt: str(r, 'read_at') ?? null,
  };
}

export function normAudit(raw: unknown): AuditEvent {
  const r = asRec(raw);
  const actor = ref(r, 'actor', ['actor_user_id']);
  const actorName = str(r, 'actor_name', 'actor_email', 'user_name', 'user_email');
  return {
    id: str(r, 'id') ?? '',
    action: str(r, 'action') ?? '',
    entityType: str(r, 'entity_type') ?? '',
    entityId: str(r, 'entity_id') ?? null,
    actor: actor ? { id: actor.id, name: actor.name || actorName || '' } : actorName ? { id: '', name: actorName } : null,
    summary: str(r, 'summary', 'description') ?? null,
    ipAddress: str(r, 'ip_address') ?? null,
    oldValues: get(r, 'old_values'),
    newValues: get(r, 'new_values'),
    createdAt: str(r, 'created_at', 'timestamp') ?? '',
  };
}

export function normRole(raw: unknown): Role {
  const r = asRec(raw);
  const permissions = arr(r, 'permissions').map((entry) => {
    if (typeof entry === 'string') return entry;
    return str(asRec(entry), 'key', 'permission_key') ?? '';
  });
  return {
    id: str(r, 'id') ?? str(r, 'name') ?? '',
    name: str(r, 'name') ?? '',
    description: str(r, 'description') ?? null,
    permissions: permissions.filter(Boolean),
    userCount: num(r, 'user_count', 'users_count'),
  };
}

export function normTenant(raw: unknown): CompanySettings {
  const r = asRec(raw);
  return {
    name: str(r, 'name') ?? '',
    timezone: str(r, 'timezone') ?? 'UTC',
    slug: str(r, 'slug') ?? null,
    status: str(r, 'status') ?? null,
  };
}

function normActivity(raw: unknown, index: number): ActivityItem {
  const r = asRec(raw);
  const actor = ref(r, 'actor', ['actor_user_id']);
  const text =
    str(r, 'text', 'summary', 'description', 'message') ??
    [titleCase(str(r, 'action')), str(r, 'entity_type') ? titleCase(str(r, 'entity_type')) : '']
      .filter((part) => part && part !== '—')
      .join(' · ');
  return {
    id: str(r, 'id') ?? String(index),
    text,
    actor: (typeof get(r, 'actor') === 'string' ? str(r, 'actor') : actor?.name) ?? str(r, 'actor_name', 'actor_email') ?? null,
    createdAt: str(r, 'created_at', 'timestamp') ?? '',
  };
}

export function normDashboard(raw: unknown): DashboardSummary {
  const r = asRec(raw);
  const approvalsRaw = get(r, 'pending_approvals');
  const pendingActions: PendingAction[] = arr(r, 'pending_actions', 'pending_items').map((entry, index) => {
    const p = asRec(entry);
    const type = str(p, 'type', 'entity_type') ?? 'item';
    return {
      id: str(p, 'id') ?? String(index),
      type,
      title: str(p, 'title', 'text') ?? titleCase(type),
      subtitle: str(p, 'subtitle', 'description', 'employee_name') ?? null,
      href: str(p, 'href', 'link') ?? routeForResource(type, str(p, 'entity_id')),
      createdAt: str(p, 'created_at'),
    };
  });

  // Counts may arrive as `pending_approvals: { leave: 2, ... }` or flat `pending_leave: 2`.
  const counts: [string, number][] = [];
  if (isRec(approvalsRaw)) {
    Object.entries(approvalsRaw).forEach(([key, value]) => {
      if (typeof value === 'number') counts.push([key, value]);
    });
  }
  Object.entries(r).forEach(([key, value]) => {
    if (/^pending_/.test(key) && !/^pending_(approvals|actions|items)$/.test(key) && typeof value === 'number') {
      counts.push([key.replace(/^pending_/, ''), value]);
    }
  });
  if (pendingActions.length === 0) {
    counts
      .filter(([, count]) => count > 0)
      .forEach(([key, count]) => {
        pendingActions.push({
          id: key,
          type: key,
          title: `${titleCase(key)} awaiting review`,
          subtitle: `${count} pending`,
          href: routeForResource(key.replace(/s$/, '')) ?? routeForResource(key),
          count,
        });
      });
  }

  const pendingApprovals =
    typeof approvalsRaw === 'number'
      ? approvalsRaw
      : counts.length > 0
        ? counts.reduce((sum, [, count]) => sum + count, 0)
        : (num(r, 'pending_approvals_count') ?? pendingActions.length);

  return {
    activeEmployees: num(r, 'active_employees', 'employees', 'headcount', 'total_employees'),
    pendingApprovals,
    openTasks: num(r, 'open_tasks', 'tasks_open'),
    presentToday: num(r, 'present_today', 'checked_in_today'),
    pendingActions,
    recentActivity: arr(r, 'recent_activity', 'activity', 'recent_events').map(normActivity),
    headcountByDepartment: arr(r, 'headcount_by_department', 'department_headcount').map((entry) => {
      const d = asRec(entry);
      return { name: str(d, 'name', 'department') ?? 'Unassigned', count: num(d, 'count', 'headcount', 'value') ?? 0 };
    }),
    attendanceTrend: arr(r, 'attendance_trend').map((entry) => {
      const d = asRec(entry);
      return { date: str(d, 'date') ?? '', present: num(d, 'present') ?? 0, absent: num(d, 'absent') ?? 0 };
    }),
  };
}

export function normImportPreview(raw: unknown): ImportPreview {
  const r = asRec(raw);
  const summary = asRec(get(r, 'summary'));
  const rows: ImportPreviewRow[] = arr(r, 'rows', 'preview', 'items').map((entry, index) => {
    const row = asRec(entry);
    const values = asRec(get(row, 'values', 'data', 'record'));
    const source = Object.keys(values).length > 0 ? values : row;
    const flat: Record<string, string> = {};
    Object.entries(source).forEach(([key, value]) => {
      if (['errors', 'error', 'row', 'row_number', 'valid'].includes(key)) return;
      if (typeof value === 'string' || typeof value === 'number') flat[key] = String(value);
    });
    const errorList = arr(row, 'errors').map((e) => (typeof e === 'string' ? e : (str(asRec(e), 'message') ?? '')));
    const single = str(row, 'error');
    return {
      row: num(row, 'row', 'row_number') ?? index + 1,
      values: flat,
      errors: [...errorList, ...(single ? [single] : [])].filter(Boolean),
    };
  });
  const errors = arr(r, 'errors').map((entry) => {
    const e = asRec(entry);
    return { row: num(e, 'row', 'row_number') ?? 0, message: typeof entry === 'string' ? entry : (str(e, 'message', 'error') ?? 'Invalid row') };
  });
  const invalidFromRows = rows.filter((row) => row.errors.length > 0).length;
  const total = num(r, 'total', 'total_rows') ?? num(summary, 'total', 'total_rows') ?? rows.length;
  const invalid = num(r, 'invalid', 'error_count', 'invalid_rows') ?? num(summary, 'invalid', 'errors', 'error_count') ?? (errors.length || invalidFromRows);
  const valid = num(r, 'valid', 'valid_rows', 'valid_count') ?? num(summary, 'valid', 'valid_rows') ?? Math.max(0, total - invalid);
  return {
    importId: str(r, 'import_id', 'job_id', 'id') ?? null,
    total,
    valid,
    invalid,
    rows,
    errors,
  };
}

export function normImportResult(raw: unknown): ImportResult {
  const r = asRec(raw);
  const summary = asRec(get(r, 'summary'));
  const source = Object.keys(summary).length > 0 ? summary : r;
  return {
    created: num(source, 'created', 'imported', 'inserted', 'success') ?? 0,
    skipped: num(source, 'skipped', 'failed', 'invalid') ?? 0,
    errors: arr(source, 'errors').map((entry) => {
      const e = asRec(entry);
      return { row: num(e, 'row') ?? 0, message: typeof entry === 'string' ? entry : (str(e, 'message') ?? 'Error') };
    }),
  };
}
