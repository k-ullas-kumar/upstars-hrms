import { Router } from 'express';
import { z } from 'zod';
import { requireAnyPermission, requirePermission } from '../../middleware/rbac';
import * as assets from '../../services/asset.service';
import { buildCtx } from '../../utils/audit';
import { asyncHandler, created, ok } from '../../utils/http';
import { idParams, isoDate, queryRecord, uuid } from './schemas';

const assetFields = {
  asset_tag: z.string().trim().min(1).max(60),
  category: z.string().trim().min(1).max(80),
  serial_number: z.string().trim().max(120).nullish(),
  status: z.enum(['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'RETIRED']).optional(),
  condition: z.string().trim().max(60).nullish(),
  location: z.string().trim().max(160).nullish(),
  purchase_date: isoDate.nullish(),
  warranty_until: isoDate.nullish(),
  notes: z.string().trim().max(2000).nullish(),
};
const createSchema = z.object(assetFields);
const updateSchema = z.object(assetFields).partial();

const assignSchema = z.object({
  asset_id: uuid,
  employee_id: uuid,
  condition_out: z.string().trim().max(60).nullish(),
  accessories: z.array(z.string().trim().min(1).max(120)).max(20).nullish(),
  notes: z.string().trim().max(1000).nullish(),
});
const returnSchema = z
  .object({ condition_in: z.string().trim().max(60).nullish(), notes: z.string().trim().max(1000).nullish() })
  .default({});

export const assetAssignmentRouter = Router();

assetAssignmentRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await assets.listAssignments(buildCtx(req), queryRecord(req.query));
    ok(res, result.items, result.pagination);
  }),
);
assetAssignmentRouter.post(
  '/',
  requirePermission('asset:assign'),
  asyncHandler(async (req, res) => created(res, await assets.assign(buildCtx(req), assignSchema.parse(req.body)))),
);
assetAssignmentRouter.post(
  '/:id/acknowledge',
  asyncHandler(async (req, res) => ok(res, await assets.acknowledge(buildCtx(req), idParams.parse(req.params).id))),
);
assetAssignmentRouter.post(
  '/:id/return',
  requirePermission('asset:assign'),
  asyncHandler(async (req, res) =>
    ok(res, await assets.returnAsset(buildCtx(req), idParams.parse(req.params).id, returnSchema.parse(req.body))),
  ),
);

export const assetRouter = Router();

assetRouter.get(
  '/',
  requireAnyPermission('asset:manage', 'asset:assign'),
  asyncHandler(async (req, res) => {
    const result = await assets.list(buildCtx(req), queryRecord(req.query));
    ok(res, result.items, result.pagination);
  }),
);
assetRouter.post(
  '/',
  requirePermission('asset:manage'),
  asyncHandler(async (req, res) => created(res, await assets.create(buildCtx(req), createSchema.parse(req.body)))),
);
assetRouter.get(
  '/:id',
  requireAnyPermission('asset:manage', 'asset:assign'),
  asyncHandler(async (req, res) => ok(res, await assets.get(buildCtx(req), idParams.parse(req.params).id))),
);
assetRouter.patch(
  '/:id',
  requirePermission('asset:manage'),
  asyncHandler(async (req, res) =>
    ok(res, await assets.update(buildCtx(req), idParams.parse(req.params).id, updateSchema.parse(req.body))),
  ),
);
assetRouter.delete(
  '/:id',
  requirePermission('asset:manage'),
  asyncHandler(async (req, res) => ok(res, await assets.remove(buildCtx(req), idParams.parse(req.params).id))),
);
