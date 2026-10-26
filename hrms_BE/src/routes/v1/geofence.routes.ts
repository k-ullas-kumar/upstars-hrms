import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/rbac';
import * as geofences from '../../services/geofence.service';
import { buildCtx } from '../../utils/audit';
import { asyncHandler, created, ok } from '../../utils/http';
import { idParams, queryRecord } from './schemas';

const fields = {
  name: z.string().trim().min(1).max(160),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius_meters: z.number().int().min(10).max(50000),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
};

export const geofenceRouter = Router();

geofenceRouter.get(
  '/',
  requirePermission('geofence:manage'),
  asyncHandler(async (req, res) => ok(res, await geofences.list(buildCtx(req), queryRecord(req.query)))),
);
geofenceRouter.post(
  '/',
  requirePermission('geofence:manage'),
  asyncHandler(async (req, res) => created(res, await geofences.create(buildCtx(req), z.object(fields).parse(req.body)))),
);
geofenceRouter.get(
  '/:id',
  requirePermission('geofence:manage'),
  asyncHandler(async (req, res) => ok(res, await geofences.get(buildCtx(req), idParams.parse(req.params).id))),
);
geofenceRouter.patch(
  '/:id',
  requirePermission('geofence:manage'),
  asyncHandler(async (req, res) =>
    ok(res, await geofences.update(buildCtx(req), idParams.parse(req.params).id, z.object(fields).partial().parse(req.body))),
  ),
);
geofenceRouter.delete(
  '/:id',
  requirePermission('geofence:manage'),
  asyncHandler(async (req, res) => ok(res, await geofences.remove(buildCtx(req), idParams.parse(req.params).id))),
);
