import { Router } from 'express';
import { requirePermission } from '../../middleware/rbac';
import * as notifications from '../../services/notification.service';
import { buildCtx } from '../../utils/audit';
import { asyncHandler, ok } from '../../utils/http';
import { idParams, queryRecord } from './schemas';

export const notificationRouter = Router();

notificationRouter.use(requirePermission('notification:view'));

notificationRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await notifications.list(buildCtx(req), queryRecord(req.query));
    ok(res, result.items, result.pagination);
  }),
);
notificationRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => ok(res, await notifications.unreadCount(buildCtx(req)))),
);
notificationRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => ok(res, await notifications.markAllRead(buildCtx(req)))),
);
const readHandler = asyncHandler(async (req, res) =>
  ok(res, await notifications.markRead(buildCtx(req), idParams.parse(req.params).id)),
);
notificationRouter.post('/:id/read', readHandler);
notificationRouter.patch('/:id/read', readHandler);
