import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { assetAssignmentRouter, assetRouter } from './asset.routes';
import { attendanceRouter } from './attendance.routes';
import { auditRouter } from './audit.routes';
import { authPublicRouter, authRouter } from './auth.routes';
import { dashboardRouter } from './dashboard.routes';
import { generatedDocumentRouter, templateRouter } from './document.routes';
import { employeeRouter } from './employee.routes';
import { geofenceRouter } from './geofence.routes';
import { leaveRouter } from './leave.routes';
import { notificationRouter } from './notification.routes';
import { onboardingRouter } from './onboarding.routes';
import { orgRouter } from './org.routes';
import { reportRouter } from './report.routes';
import { taskRouter } from './task.routes';
import { teamRouter } from './team.routes';
import { compatRouter } from './compat.routes';

export const v1Router = Router();

// ---- public ----
v1Router.use('/auth', authPublicRouter);

// ---- authenticated (auth router applies `authenticate` per-route for logout/me) ----
v1Router.use('/auth', authRouter);

v1Router.use(authenticate);

// Frontend path aliases (leave-requests, imports, assignments, reports/*.csv, roles, …)
v1Router.use(compatRouter);

// Org reference data is reachable both at the root (/branches, /departments, ...) and under /org.
v1Router.use('/org', orgRouter);
v1Router.use('/', orgRouter);

v1Router.use('/employees', employeeRouter);
v1Router.use('/leave', leaveRouter);
v1Router.use('/attendance', attendanceRouter);
// Assignments must be mounted before /assets so "/assets/assignments" is not treated as an asset id.
v1Router.use('/assets/assignments', assetAssignmentRouter);
v1Router.use('/asset-assignments', assetAssignmentRouter);
v1Router.use('/assets', assetRouter);
v1Router.use('/document-templates', templateRouter);
v1Router.use('/generated-documents', generatedDocumentRouter);
v1Router.use('/teams', teamRouter);
v1Router.use('/tasks', taskRouter);
v1Router.use('/onboarding', onboardingRouter);
v1Router.use('/geofences', geofenceRouter);
v1Router.use('/notifications', notificationRouter);
v1Router.use('/reports', reportRouter);
v1Router.use('/audit-events', auditRouter);
v1Router.use('/dashboard', dashboardRouter);
