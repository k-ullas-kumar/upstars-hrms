import { Router } from 'express';
import * as dashboard from '../../services/dashboard.service';
import { buildCtx } from '../../utils/audit';
import { asyncHandler, ok } from '../../utils/http';

export const dashboardRouter = Router();

const summaryHandler = asyncHandler(async (req, res) => ok(res, await dashboard.summary(buildCtx(req))));
dashboardRouter.get('/', summaryHandler);
dashboardRouter.get('/summary', summaryHandler);
