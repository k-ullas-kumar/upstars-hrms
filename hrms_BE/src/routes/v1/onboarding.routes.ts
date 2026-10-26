import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/rbac';
import * as onboarding from '../../services/onboarding.service';
import { buildCtx } from '../../utils/audit';
import { asyncHandler, created, ok } from '../../utils/http';
import { idParams, isoDate, queryRecord, uuid } from './schemas';

const itemSchema = z.object({
  title: z.string().trim().min(1).max(240),
  owner_user_id: uuid.nullish(),
  due_date: isoDate.nullish(),
});
const checklistSchema = z.object({
  employee_id: uuid,
  name: z.string().trim().min(1).max(160),
  items: z.array(itemSchema).max(100).optional(),
});

export const onboardingRouter = Router();

onboardingRouter.get(
  '/checklists',
  asyncHandler(async (req, res) => {
    const result = await onboarding.list(buildCtx(req), queryRecord(req.query));
    ok(res, result.items, result.pagination);
  }),
);
onboardingRouter.post(
  '/checklists',
  requirePermission('onboarding:manage'),
  asyncHandler(async (req, res) => created(res, await onboarding.create(buildCtx(req), checklistSchema.parse(req.body)))),
);
onboardingRouter.get(
  '/checklists/:id',
  asyncHandler(async (req, res) => ok(res, await onboarding.get(buildCtx(req), idParams.parse(req.params).id))),
);
onboardingRouter.post(
  '/checklists/:id/items',
  requirePermission('onboarding:manage'),
  asyncHandler(async (req, res) =>
    created(res, await onboarding.addItem(buildCtx(req), idParams.parse(req.params).id, itemSchema.parse(req.body))),
  ),
);
// Item owners and the employee themself may complete an item; the service enforces this.
onboardingRouter.post(
  '/items/:id/complete',
  asyncHandler(async (req, res) => ok(res, await onboarding.completeItem(buildCtx(req), idParams.parse(req.params).id))),
);
