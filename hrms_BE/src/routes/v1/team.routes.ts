import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/rbac';
import * as teams from '../../services/team.service';
import { buildCtx } from '../../utils/audit';
import { asyncHandler, created, ok } from '../../utils/http';
import { idParams, isoDate, queryRecord, uuid } from './schemas';

const teamFields = {
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullish(),
  lead_employee_id: uuid.nullish(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
};
const memberSchema = z.object({
  employee_id: uuid,
  role: z.string().trim().max(60).nullish(),
  start_date: isoDate.optional(),
});
const membershipParams = z.object({ id: uuid, membershipId: uuid });

export const teamRouter = Router();

teamRouter.get('/', asyncHandler(async (req, res) => ok(res, await teams.listTeams(buildCtx(req), queryRecord(req.query)))));
teamRouter.post(
  '/',
  requirePermission('team:manage'),
  asyncHandler(async (req, res) => created(res, await teams.createTeam(buildCtx(req), z.object(teamFields).parse(req.body)))),
);
teamRouter.get(
  '/:id',
  asyncHandler(async (req, res) => ok(res, await teams.getTeam(buildCtx(req), idParams.parse(req.params).id))),
);
teamRouter.patch(
  '/:id',
  requirePermission('team:manage'),
  asyncHandler(async (req, res) =>
    ok(res, await teams.updateTeam(buildCtx(req), idParams.parse(req.params).id, z.object(teamFields).partial().parse(req.body))),
  ),
);
teamRouter.delete(
  '/:id',
  requirePermission('team:manage'),
  asyncHandler(async (req, res) => ok(res, await teams.deleteTeam(buildCtx(req), idParams.parse(req.params).id))),
);
teamRouter.get(
  '/:id/members',
  asyncHandler(async (req, res) => ok(res, await teams.listMembers(buildCtx(req), idParams.parse(req.params).id))),
);
teamRouter.post(
  '/:id/members',
  requirePermission('team:manage'),
  asyncHandler(async (req, res) =>
    created(res, await teams.addMember(buildCtx(req), idParams.parse(req.params).id, memberSchema.parse(req.body))),
  ),
);
teamRouter.delete(
  '/:id/members/:membershipId',
  requirePermission('team:manage'),
  asyncHandler(async (req, res) => {
    const p = membershipParams.parse(req.params);
    ok(res, await teams.removeMember(buildCtx(req), p.id, p.membershipId));
  }),
);
