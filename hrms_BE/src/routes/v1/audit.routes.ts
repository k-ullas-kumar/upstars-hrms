import { Router } from 'express';
import { requirePermission } from '../../middleware/rbac';
import * as audit from '../../services/audit.service';
import { buildCtx } from '../../utils/audit';
import { asyncHandler, ok } from '../../utils/http';
import { queryRecord } from './schemas';

export const auditRouter = Router();

auditRouter.get(
  '/',
  requirePermission('audit:view'),
  asyncHandler(async (req, res) => {
    const result = await audit.listEvents(buildCtx(req), queryRecord(req.query));
    ok(res, result.items, result.pagination);
  }),
);
