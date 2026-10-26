export const TENANT_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export const USER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export const ACTIVE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export const EMPLOYMENT_STATUSES = ['ACTIVE', 'INACTIVE', 'EXITED'] as const;
export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export const ATTENDANCE_EVENT_TYPES = ['CHECK_IN', 'CHECK_OUT'] as const;
export const ATTENDANCE_STATUSES = ['ACCEPTED', 'FLAGGED', 'REJECTED'] as const;
export const ATTENDANCE_SOURCES = ['WEB', 'MOBILE', 'KIOSK', 'CORRECTION'] as const;
export const LOCATION_STATUSES = [
  'NOT_REQUIRED',
  'INSIDE',
  'OUTSIDE',
  'ACCURACY_INSUFFICIENT',
  'PERMISSION_DENIED',
] as const;
export const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export const ASSET_STATUSES = ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED'] as const;
export const DOCUMENT_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED'] as const;
export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'] as const;
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const ONBOARDING_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;
export const ONBOARDING_ITEM_STATUSES = ['PENDING', 'COMPLETED'] as const;
export const IMPORT_STATUSES = ['PREVIEW', 'COMPLETED', 'FAILED'] as const;

export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type AttendanceEventType = (typeof ATTENDANCE_EVENT_TYPES)[number];
export type LocationStatus = (typeof LOCATION_STATUSES)[number];
export type AssetStatus = (typeof ASSET_STATUSES)[number];
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
