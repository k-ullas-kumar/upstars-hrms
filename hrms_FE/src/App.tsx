import type { ReactElement } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { PermissionRoute, ProtectedRoute } from './components/auth/RouteGuards';
import { Layout } from './components/layout/Layout';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AssetListPage } from './pages/AssetListPage';
import { AttendancePage } from './pages/AttendancePage';
import { AuditPage } from './pages/AuditPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { LeavePage } from './pages/LeavePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { EmployeeDetailPage } from './pages/people/EmployeeDetailPage';
import { EmployeeListPage } from './pages/people/EmployeeListPage';
import { ImportEmployeesPage } from './pages/people/ImportEmployeesPage';
import { OnboardingPage } from './pages/people/OnboardingPage';
import { BranchesPage, DepartmentsPage, DesignationsPage } from './pages/people/OrgEntityPage';
import { ReportsPage } from './pages/ReportsPage';
import { CompanySettingsPage } from './pages/settings/CompanySettingsPage';
import { RolesPage } from './pages/settings/RolesPage';
import { TasksPage } from './pages/TasksPage';
import { TeamsPage } from './pages/TeamsPage';
import { PERMISSIONS } from './types';

const P = PERMISSIONS;

/** Wraps a page so it renders a permission-denied state unless the user holds ANY of `anyOf`. */
const guard = (anyOf: readonly string[], page: ReactElement) => <PermissionRoute anyOf={anyOf}>{page}</PermissionRoute>;

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route index element={<DashboardPage />} />

                <Route path="people/employees" element={guard([P.employeeView], <EmployeeListPage />)} />
                <Route path="people/employees/import" element={guard([P.employeeImport], <ImportEmployeesPage />)} />
                <Route path="people/employees/:id" element={guard([P.employeeView], <EmployeeDetailPage />)} />
                <Route path="people/departments" element={guard([P.orgManage, P.employeeView], <DepartmentsPage />)} />
                <Route path="people/branches" element={guard([P.orgManage, P.employeeView], <BranchesPage />)} />
                <Route path="people/designations" element={guard([P.orgManage, P.employeeView], <DesignationsPage />)} />
                <Route path="people/onboarding" element={guard([P.onboardingManage], <OnboardingPage />)} />

                <Route
                  path="attendance"
                  element={guard([P.attendanceCheckin, P.attendanceCorrect, P.attendanceApprove, P.attendanceViewTeam], <AttendancePage />)}
                />
                <Route path="leave" element={guard([P.leaveRequest, P.leaveApprove, P.leaveManageTypes], <LeavePage />)} />
                <Route path="assets" element={guard([P.assetManage, P.assetAssign], <AssetListPage />)} />
                <Route path="teams" element={guard([P.teamManage, P.employeeView], <TeamsPage />)} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="documents" element={guard([P.documentManage, P.documentGenerate, P.documentApprove], <DocumentsPage />)} />
                <Route path="reports" element={guard([P.reportView, P.reportExport], <ReportsPage />)} />
                <Route path="settings/company" element={guard([P.orgManage], <CompanySettingsPage />)} />
                <Route path="settings/roles" element={guard([P.orgManage], <RolesPage />)} />
                <Route path="audit" element={guard([P.auditView], <AuditPage />)} />

                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
