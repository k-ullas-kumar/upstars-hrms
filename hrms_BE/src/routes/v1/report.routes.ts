import { Router } from 'express';
import { z } from 'zod';
import { requireAnyPermission } from '../../middleware/rbac';
import * as reports from '../../services/report.service';
import { buildCtx } from '../../utils/audit';
import { asyncHandler } from '../../utils/http';
import { queryRecord } from './schemas';

const typeSchema = z.enum(reports.REPORT_TYPES);

export const reportRouter = Router();

// Per-report permissions are enforced in the service (employees -> employee:export, others -> report:export).
reportRouter.get(
  '/:type/export',
  requireAnyPermission('report:export', 'employee:export'),
  asyncHandler(async (req, res) => {
    const type = typeSchema.parse(req.params.type);
    const { filename, csv } = await reports.exportCsv(buildCtx(req), type, queryRecord(req.query));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`\uFEFF${csv}`);
  }),
);
