import {
  Boxes,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  FileText,
  History,
  Home,
  MapPin,
  Settings,
  ShieldCheck,
  Tag,
  BarChart3,
  UserPlus,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { PERMISSIONS } from '../../types';

export interface NavLinkItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Visible when the user has ANY of these permissions. Omit for everyone. */
  anyOf?: readonly string[];
  end?: boolean;
}

export type NavEntry =
  | { kind: 'link'; item: NavLinkItem }
  | { kind: 'section'; label: string; items: NavLinkItem[] };

// Payroll, Recruitment, Chat and Sales are intentionally omitted from the MVP navigation.
export const NAV: NavEntry[] = [
  { kind: 'link', item: { label: 'Home', to: '/', icon: Home, end: true } },
  {
    kind: 'section',
    label: 'People',
    items: [
      { label: 'Employees', to: '/people/employees', icon: Users, anyOf: [PERMISSIONS.employeeView] },
      {
        label: 'Departments',
        to: '/people/departments',
        icon: Building2,
        anyOf: [PERMISSIONS.orgManage, PERMISSIONS.employeeView],
      },
      {
        label: 'Branches',
        to: '/people/branches',
        icon: MapPin,
        anyOf: [PERMISSIONS.orgManage, PERMISSIONS.employeeView],
      },
      {
        label: 'Designations',
        to: '/people/designations',
        icon: Tag,
        anyOf: [PERMISSIONS.orgManage, PERMISSIONS.employeeView],
      },
      {
        label: 'Onboarding',
        to: '/people/onboarding',
        icon: UserPlus,
        anyOf: [PERMISSIONS.onboardingManage],
      },
    ],
  },
  {
    kind: 'section',
    label: 'Attendance & Leave',
    items: [
      {
        label: 'Attendance',
        to: '/attendance',
        icon: CalendarCheck,
        anyOf: [
          PERMISSIONS.attendanceCheckin,
          PERMISSIONS.attendanceCorrect,
          PERMISSIONS.attendanceApprove,
          PERMISSIONS.attendanceViewTeam,
        ],
      },
      {
        label: 'Leave',
        to: '/leave',
        icon: CalendarDays,
        anyOf: [PERMISSIONS.leaveRequest, PERMISSIONS.leaveApprove, PERMISSIONS.leaveManageTypes],
      },
    ],
  },
  {
    kind: 'link',
    item: {
      label: 'Assets',
      to: '/assets',
      icon: Boxes,
      anyOf: [PERMISSIONS.assetManage, PERMISSIONS.assetAssign],
    },
  },
  {
    kind: 'section',
    label: 'Tasks & Teams',
    items: [
      { label: 'Tasks', to: '/tasks', icon: ClipboardCheck },
      { label: 'Teams', to: '/teams', icon: UsersRound, anyOf: [PERMISSIONS.teamManage, PERMISSIONS.employeeView] },
    ],
  },
  {
    kind: 'link',
    item: {
      label: 'Documents',
      to: '/documents',
      icon: FileText,
      anyOf: [PERMISSIONS.documentManage, PERMISSIONS.documentGenerate, PERMISSIONS.documentApprove],
    },
  },
  {
    kind: 'link',
    item: {
      label: 'Reports',
      to: '/reports',
      icon: BarChart3,
      anyOf: [PERMISSIONS.reportView, PERMISSIONS.reportExport],
    },
  },
  {
    kind: 'section',
    label: 'Settings',
    items: [
      { label: 'Company', to: '/settings/company', icon: Settings, anyOf: [PERMISSIONS.orgManage] },
      { label: 'Roles', to: '/settings/roles', icon: ShieldCheck, anyOf: [PERMISSIONS.orgManage] },
    ],
  },
  {
    kind: 'link',
    item: { label: 'Audit', to: '/audit', icon: History, anyOf: [PERMISSIONS.auditView] },
  },
];