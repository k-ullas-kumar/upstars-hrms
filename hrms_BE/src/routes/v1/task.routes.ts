import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/rbac';
import * as teams from '../../services/team.service';
import { buildCtx } from '../../utils/audit';
import { asyncHandler, created, ok } from '../../utils/http';
import { idParams, queryRecord, uuid } from './schemas';

const taskFields = {
  team_id: uuid.nullish(),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(5000).nullish(),
  owner_employee_id: uuid,
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']).optional(),
  due_at: z.coerce.date().nullish(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
};

export const taskRouter = Router();

taskRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await teams.listTasks(buildCtx(req), queryRecord(req.query));
    ok(res, result.items, result.pagination);
  }),
);
taskRouter.post(
  '/',
  requirePermission('task:manage'),
  asyncHandler(async (req, res) => created(res, await teams.createTask(buildCtx(req), z.object(taskFields).parse(req.body)))),
);
taskRouter.get(
  '/:id',
  asyncHandler(async (req, res) => ok(res, await teams.getTask(buildCtx(req), idParams.parse(req.params).id))),
);
// Owners may update the status of their own task; the service enforces this.
taskRouter.patch(
  '/:id',
  asyncHandler(async (req, res) =>
    ok(res, await teams.updateTask(buildCtx(req), idParams.parse(req.params).id, z.object(taskFields).partial().parse(req.body))),
  ),
);
taskRouter.delete(
  '/:id',
  requirePermission('task:manage'),
  asyncHandler(async (req, res) => ok(res, await teams.deleteTask(buildCtx(req), idParams.parse(req.params).id))),
);
