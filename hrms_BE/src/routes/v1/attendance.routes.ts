import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/rbac';
import * as attendance from '../../services/attendance.service';
import { buildCtx } from '../../utils/audit';
import { asyncHandler, created, ok } from '../../utils/http';
import { decisionBody, idParams, isoDate, queryRecord, uuid } from './schemas';

const punchSchema = z
  .object({
    latitude: z.number().min(-90).max(90).nullish(),
    longitude: z.number().min(-180).max(180).nullish(),
    accuracy_meters: z.number().min(0).max(100000).nullish(),
    notes: z.string().trim().max(500).nullish(),
    source: z.enum(['WEB', 'MOBILE', 'KIOSK']).optional(),
  })
  .default({});

const correctionSchema = z.object({
  date: isoDate,
  proposed_event_type: z.enum(['CHECK_IN', 'CHECK_OUT']),
  proposed_timestamp: z.coerce.date(),
  reason: z.string().trim().min(3).max(1000),
  attendance_event_id: uuid.nullish(),
});

export const attendanceRouter = Router();

attendanceRouter.post(
  '/check-in',
  requirePermission('attendance:checkin'),
  asyncHandler(async (req, res) => created(res, await attendance.checkIn(buildCtx(req), punchSchema.parse(req.body)))),
);
attendanceRouter.post(
  '/check-out',
  requirePermission('attendance:checkin'),
  asyncHandler(async (req, res) => created(res, await attendance.checkOut(buildCtx(req), punchSchema.parse(req.body)))),
);
attendanceRouter.get(
  '/status',
  requirePermission('attendance:checkin'),
  asyncHandler(async (req, res) => ok(res, await attendance.status(buildCtx(req)))),
);
attendanceRouter.get(
  '/events',
  asyncHandler(async (req, res) => {
    const result = await attendance.listEvents(buildCtx(req), queryRecord(req.query));
    ok(res, result.items, result.pagination);
  }),
);

attendanceRouter.get(
  '/corrections',
  asyncHandler(async (req, res) => {
    const result = await attendance.listCorrections(buildCtx(req), queryRecord(req.query));
    ok(res, result.items, result.pagination);
  }),
);
attendanceRouter.post(
  '/corrections',
  requirePermission('attendance:correct'),
  asyncHandler(async (req, res) =>
    created(res, await attendance.createCorrection(buildCtx(req), correctionSchema.parse(req.body))),
  ),
);
attendanceRouter.post(
  '/corrections/:id/approve',
  requirePermission('attendance:approve'),
  asyncHandler(async (req, res) =>
    ok(res, await attendance.approveCorrection(buildCtx(req), idParams.parse(req.params).id, decisionBody.parse(req.body).note)),
  ),
);
attendanceRouter.post(
  '/corrections/:id/reject',
  requirePermission('attendance:approve'),
  asyncHandler(async (req, res) =>
    ok(res, await attendance.rejectCorrection(buildCtx(req), idParams.parse(req.params).id, decisionBody.parse(req.body).note)),
  ),
);
