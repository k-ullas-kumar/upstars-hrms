import { Router } from 'express';
import { z } from 'zod';
import { Role, Permission } from '../../models';
import { requireAnyPermission, requirePermission } from '../../middleware/rbac';
import { csvUpload } from '../../middleware/upload';
import * as assets from '../../services/asset.service';
import * as imports from '../../services/import.service';
import * as leave from '../../services/leave.service';
import * as onboarding from '../../services/onboarding.service';
import * as reports from '../../services/report.service';
import { buildCtx } from '../../utils/audit';
import { asyncHandler, created, ok } from '../../utils/http';
import { decisionBody, idParams, isoDate, queryRecord, uuid } from './schemas';

/**
 * Frontend-friendly aliases that mirror the canonical /api/v1 routes.
 * Keeps the polished UI working without rewriting every page path.
 */
export const compatRouter = Router();

const leaveRequestSchema = z.object({
  leave_type_id: uuid,
  start_date: isoDate,
  end_date: isoDate,
  reason: z.string().trim().max(1000).nullish(),
});

const leaveTypeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(20),
  paid: z.boolean().optional(),
  max_days_per_year: z.number().min(0).max(366).optional(),
  carry_forward: z.boolean().optional(),
});

const assignBody = z.object({
  employee_id: uuid,
  condition_out: z.string().trim().max(60).nullish(),
  accessories: z.array(z.string().trim().min(1).max(120)).max(20).nullish(),
  notes: z.string().trim().max(1000).nullish(),
});

const returnBody = z
  .object({ condition_in: z.string().trim().max(60).nullish(), notes: z.string().trim().max(1000).nullish() })
  .default({});

const checklistSchema = z.object({
  employee_id: uuid,
  name: z.string().trim().min(1).max(160),
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(240),
        owner_user_id: uuid.nullish(),
        due_date: isoDate.nullish(),
      }),
    )
    .max(100)
    .optional(),
});

const confirmSchema = z.object({
  job_id: uuid.optional(),
  import_id: uuid.optional(),
}).transform((v) => ({ job_id: v.job_id ?? v.import_id })).refine((v) => !!v.job_id, 'job_id is required');

// ---- leave aliases ----
compatRouter.get('/leave-types', asyncHandler(async (req, res) => ok(res, await leave.listTypes(buildCtx(req)))));
compatRouter.post(
  '/leave-types',
  requirePermission('leave:manage_types'),
  asyncHandler(async (req, res) => created(res, await leave.createType(buildCtx(req), leaveTypeSchema.parse(req.body)))),
);
compatRouter.get(
  '/leave-balances',
  asyncHandler(async (req, res) => ok(res, await leave.listBalances(buildCtx(req), queryRecord(req.query)))),
);
compatRouter.get(
  '/leave-requests',
  asyncHandler(async (req, res) => {
    const result = await leave.listRequests(buildCtx(req), queryRecord(req.query));
    ok(res, result.items, result.pagination);
  }),
);
compatRouter.post(
  '/leave-requests',
  requirePermission('leave:request'),
  asyncHandler(async (req, res) => created(res, await leave.createRequest(buildCtx(req), leaveRequestSchema.parse(req.body)))),
);
compatRouter.post(
  '/leave-requests/:id/approve',
  requirePermission('leave:approve'),
  asyncHandler(async (req, res) =>
    ok(res, await leave.approve(buildCtx(req), idParams.parse(req.params).id, decisionBody.parse(req.body).note)),
  ),
);
compatRouter.post(
  '/leave-requests/:id/reject',
  requirePermission('leave:approve'),
  asyncHandler(async (req, res) =>
    ok(res, await leave.reject(buildCtx(req), idParams.parse(req.params).id, decisionBody.parse(req.body).note)),
  ),
);
compatRouter.post(
  '/leave-requests/:id/cancel',
  requirePermission('leave:request'),
  asyncHandler(async (req, res) => ok(res, await leave.cancel(buildCtx(req), idParams.parse(req.params).id))),
);

// ---- onboarding aliases ----
compatRouter.get(
  '/onboarding-checklists',
  asyncHandler(async (req, res) => {
    const result = await onboarding.list(buildCtx(req), queryRecord(req.query));
    ok(res, result.items, result.pagination);
  }),
);
compatRouter.post(
  '/onboarding-checklists',
  requirePermission('onboarding:manage'),
  asyncHandler(async (req, res) => created(res, await onboarding.create(buildCtx(req), checklistSchema.parse(req.body)))),
);
compatRouter.post(
  '/onboarding-items/:id/complete',
  asyncHandler(async (req, res) => ok(res, await onboarding.completeItem(buildCtx(req), idParams.parse(req.params).id))),
);

// ---- import aliases ----
compatRouter.post(
  '/imports/employees/preview',
  requirePermission('employee:import'),
  csvUpload.single('file'),
  asyncHandler(async (req, res) => {
    const text = imports.readCsvInput(req.file, (req.body as Record<string, unknown> | undefined)?.csv);
    ok(res, await imports.preview(buildCtx(req), text));
  }),
);
compatRouter.post(
  '/imports/employees/confirm',
  requirePermission('employee:import'),
  asyncHandler(async (req, res) => {
    const { job_id } = confirmSchema.parse(req.body);
    ok(res, await imports.confirm(buildCtx(req), job_id as string));
  }),
);

// ---- asset assignment aliases ----
compatRouter.post(
  '/assets/:id/assignments',
  requirePermission('asset:assign'),
  asyncHandler(async (req, res) => {
    const assetId = idParams.parse(req.params).id;
    const body = assignBody.parse(req.body);
    created(res, await assets.assign(buildCtx(req), { ...body, asset_id: assetId }));
  }),
);
compatRouter.post(
  '/assignments/:id/acknowledge',
  asyncHandler(async (req, res) => ok(res, await assets.acknowledge(buildCtx(req), idParams.parse(req.params).id))),
);
compatRouter.post(
  '/assignments/:id/return',
  requirePermission('asset:assign'),
  asyncHandler(async (req, res) =>
    ok(res, await assets.returnAsset(buildCtx(req), idParams.parse(req.params).id, returnBody.parse(req.body))),
  ),
);

// ---- report CSV aliases (/reports/employees.csv) ----
compatRouter.get(
  '/reports/:type.csv',
  requireAnyPermission('report:export', 'employee:export'),
  asyncHandler(async (req, res) => {
    const type = z.enum(reports.REPORT_TYPES).parse(String(req.params.type).replace(/\.csv$/i, ''));
    const { filename, csv } = await reports.exportCsv(buildCtx(req), type, queryRecord(req.query));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\uFEFF${csv}`);
  }),
);

// ---- roles list (read-only for settings page) ----
compatRouter.get(
  '/roles',
  requireAnyPermission('org:manage', 'employee:view'),
  asyncHandler(async (req, res) => {
    const ctx = buildCtx(req);
    const roles = await Role.findAll({
      where: { tenant_id: null },
      include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
      order: [['name', 'ASC']],
    });
    ok(
      res,
      roles
        .filter((r) => r.name !== 'SAAS_SUPER_ADMIN')
        .map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          permissions: ((r as { permissions?: Array<{ key: string }> }).permissions ?? []).map((p) => p.key),
          tenant_id: ctx.tenantId,
        })),
    );
  }),
);
