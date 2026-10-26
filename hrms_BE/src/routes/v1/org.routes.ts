import { Router } from 'express';
import { z } from 'zod';
import { requireAnyPermission, requirePermission } from '../../middleware/rbac';
import * as org from '../../services/org.service';
import { OrgKind } from '../../services/org.service';
import { buildCtx } from '../../utils/audit';
import { asyncHandler, created, ok } from '../../utils/http';
import { idParams, queryRecord, uuid } from './schemas';

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  parent_id: uuid.nullish(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
const updateSchema = createSchema.partial();
const tenantSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, 'Unknown timezone'),
  })
  .partial();

export const orgRouter = Router();

/** Any signed-in employee may read org reference data (needed by pickers); only org:manage may change it. */
orgRouter.get(
  '/tenant',
  asyncHandler(async (req, res) => ok(res, await org.getTenant(buildCtx(req)))),
);
orgRouter.patch(
  '/tenant',
  requirePermission('org:manage'),
  asyncHandler(async (req, res) => ok(res, await org.updateTenant(buildCtx(req), tenantSchema.parse(req.body)))),
);

const COLLECTIONS: Array<{ path: string; kind: OrgKind }> = [
  { path: 'branches', kind: 'Branch' },
  { path: 'departments', kind: 'Department' },
  { path: 'designations', kind: 'Designation' },
];

for (const { path, kind } of COLLECTIONS) {
  orgRouter.get(
    `/${path}`,
    requireAnyPermission('org:manage', 'employee:view', 'employee:create', 'employee:update'),
    asyncHandler(async (req, res) => ok(res, await org.listOrg(buildCtx(req), kind, queryRecord(req.query)))),
  );
  orgRouter.get(
    `/${path}/:id`,
    requireAnyPermission('org:manage', 'employee:view', 'employee:create', 'employee:update'),
    asyncHandler(async (req, res) => ok(res, await org.getOrg(buildCtx(req), kind, idParams.parse(req.params).id))),
  );
  orgRouter.post(
    `/${path}`,
    requirePermission('org:manage'),
    asyncHandler(async (req, res) => created(res, await org.createOrg(buildCtx(req), kind, createSchema.parse(req.body)))),
  );
  orgRouter.patch(
    `/${path}/:id`,
    requirePermission('org:manage'),
    asyncHandler(async (req, res) =>
      ok(res, await org.updateOrg(buildCtx(req), kind, idParams.parse(req.params).id, updateSchema.parse(req.body))),
    ),
  );
  orgRouter.delete(
    `/${path}/:id`,
    requirePermission('org:manage'),
    asyncHandler(async (req, res) => ok(res, await org.deleteOrg(buildCtx(req), kind, idParams.parse(req.params).id))),
  );
}
