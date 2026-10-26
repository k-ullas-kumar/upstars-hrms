import { DataTypes, defineModel, tenantIdAttr } from './define';
import {
  ACTIVE_STATUSES,
  ATTENDANCE_EVENT_TYPES,
  ATTENDANCE_STATUSES,
  LOCATION_STATUSES,
  REQUEST_STATUSES,
} from './constants';

export const Geofence = defineModel('Geofence', 'geofences', {
  tenant_id: tenantIdAttr,
  name: { type: DataTypes.STRING(160), allowNull: false },
  latitude: { type: DataTypes.DOUBLE, allowNull: false },
  longitude: { type: DataTypes.DOUBLE, allowNull: false },
  radius_meters: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVE', validate: { isIn: [[...ACTIVE_STATUSES]] } },
});

export const AttendanceEvent = defineModel(
  'AttendanceEvent',
  'attendance_events',
  {
    tenant_id: tenantIdAttr,
    employee_id: { type: DataTypes.UUID, allowNull: false },
    event_type: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [[...ATTENDANCE_EVENT_TYPES]] } },
    timestamp: { type: DataTypes.DATE, allowNull: false },
    source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'WEB' },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACCEPTED', validate: { isIn: [[...ATTENDANCE_STATUSES]] } },
    latitude: { type: DataTypes.DOUBLE, allowNull: true },
    longitude: { type: DataTypes.DOUBLE, allowNull: true },
    accuracy_meters: { type: DataTypes.DOUBLE, allowNull: true },
    location_verification_status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'NOT_REQUIRED',
      validate: { isIn: [[...LOCATION_STATUSES]] },
    },
    geofence_id: { type: DataTypes.UUID, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  { indexes: [{ fields: ['tenant_id', 'employee_id', 'timestamp'] }] },
);

export const AttendanceCorrection = defineModel('AttendanceCorrection', 'attendance_corrections', {
  tenant_id: tenantIdAttr,
  employee_id: { type: DataTypes.UUID, allowNull: false },
  attendance_event_id: { type: DataTypes.UUID, allowNull: true },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  proposed_event_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'CHECK_IN' },
  proposed_timestamp: { type: DataTypes.DATE, allowNull: false },
  reason: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING', validate: { isIn: [[...REQUEST_STATUSES]] } },
  approver_id: { type: DataTypes.UUID, allowNull: true },
  decided_at: { type: DataTypes.DATE, allowNull: true },
  decision_note: { type: DataTypes.TEXT, allowNull: true },
});
