import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/rbac';
import * as leave from '../../services/leave.service';
import { buildCtx } from '../../utils/audit';
import { asyncHandler, created, ok } from '../../utils/http';
import { decisionBody, idParams, isoDate, queryRecord, uuid } from './schemas';

const typeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(20),
  paid: z.boolean().optional(),
  max_days_per_year: z.number().min(0).max(366).optional(),
  carry_forward: z.boolean().optional(),
});
const balanceSchema = z.object({
  employee_id: uuid,
  leave_type_id: uuid,
  year: z.number().int().min(2000).max(2100),
  balance: z.number().min(0).max(1000),
});
const requestSchema = z.object({
  leave_type_id: uuid,
  start_date: isoDate,
  end_date: isoDate,
  reason: z.string().trim().max(1000).nullish(),
});

export const leaveRouter = Router();

// ---- leave types ----
leaveRouter.get('/types', asyncHandler(async (req, res) => ok(res, await leave.listTypes(buildCtx(req)))));
leaveRouter.post(
  '/types',
  requirePermission('leave:manage_types'),
  asyncHandler(async (req, res) => created(res, await leave.createType(buildCtx(req), typeSchema.parse(req.body)))),
);
leaveRouter.patch(
  '/types/:id',
  requirePermission('leave:manage_types'),
  asyncHandler(async (req, res) =>
    ok(res, await leave.updateType(buildCtx(req), idParams.parse(req.params).id, typeSchema.partial().parse(req.body))),
  ),
);
leaveRouter.delete(
  '/types/:id',
  requirePermission('leave:manage_types'),
  asyncHandler(async (req, res) => ok(res, await leave.deleteType(buildCtx(req), idParams.parse(req.params).id))),
);

// ---- balances ----
leaveRouter.get(
  '/balances',
  asyncHandler(async (req, res) => ok(res, await leave.listBalances(buildCtx(req), queryRecord(req.query)))),
);
leaveRouter.post(
  '/balances',
  requirePermission('leave:manage_types'),
  asyncHandler(async (req, res) => created(res, await leave.upsertBalance(buildCtx(req), balanceSchema.parse(req.body)))),
);

// ---- requests ----
leaveRouter.get(
  '/requests',
  asyncHandler(async (req, res) => {
    const result = await leave.listRequests(buildCtx(req), queryRecord(req.query));
    ok(res, result.items, result.pagination);
  }),
);
leaveRouter.post(
  '/requests',
  requirePermission('leave:request'),
  asyncHandler(async (req, res) => created(res, await leave.createRequest(buildCtx(req), requestSchema.parse(req.body)))),
);
leaveRouter.get(
  '/requests/:id',
  asyncHandler(async (req, res) => ok(res, await leave.getRequest(buildCtx(req), idParams.parse(req.params).id))),
);
leaveRouter.post(
  '/requests/:id/approve',
  requirePermission('leave:approve'),
  asyncHandler(async (req, res) =>
    ok(res, await leave.approve(buildCtx(req), idParams.parse(req.params).id, decisionBody.parse(req.body).note)),
  ),
);
leaveRouter.post(
  '/requests/:id/reject',
  requirePermission('leave:approve'),
  asyncHandler(async (req, res) =>
    ok(res, await leave.reject(buildCtx(req), idParams.parse(req.params).id, decisionBody.parse(req.body).note)),
  ),
);
leaveRouter.post(
  '/requests/:id/cancel',
  requirePermission('leave:request'),
  asyncHandler(async (req, res) => ok(res, await leave.cancel(buildCtx(req), idParams.parse(req.params).id))),
);
