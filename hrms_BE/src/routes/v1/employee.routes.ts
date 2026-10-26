import { Router } from 'express';
import { z } from 'zod';
import { csvUpload } from '../../middleware/upload';
import { requirePermission } from '../../middleware/rbac';
import * as employees from '../../services/employee.service';
import * as imports from '../../services/import.service';
import { buildCtx } from '../../utils/audit';
import { asyncHandler, created, ok } from '../../utils/http';
import { idParams, isoDate, queryRecord, uuid } from './schemas';

const baseFields = {
  employee_number: z.string().trim().min(1).max(40),
  full_name: z.string().trim().min(1).max(200),
  work_email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().max(40).nullish(),
  manager_employee_id: uuid.nullish(),
  branch_id: uuid.nullish(),
  department_id: uuid.nullish(),
  designation_id: uuid.nullish(),
  employment_status: z.enum(['ACTIVE', 'INACTIVE', 'EXITED']).optional(),
  joining_date: isoDate,
  exit_date: isoDate.nullish(),
  date_of_birth: isoDate.nullish(),
  address: z.string().trim().max(1000).nullish(),
};

const createSchema = z.object({
  ...baseFields,
  create_login: z.boolean().optional(),
  role: z.string().trim().max(80).optional(),
  password: z.string().min(8).max(128).optional(),
});
const updateSchema = z.object(baseFields).partial();
const deactivateSchema = z
  .object({ status: z.enum(['INACTIVE', 'EXITED']).optional(), exit_date: isoDate.optional() })
  .default({});
const confirmSchema = z.object({ job_id: uuid });

export const employeeRouter = Router();

employeeRouter.get(
  '/',
  requirePermission('employee:view'),
  asyncHandler(async (req, res) => {
    const result = await employees.list(buildCtx(req), queryRecord(req.query));
    ok(res, result.items, result.pagination);
  }),
);

employeeRouter.post(
  '/',
  requirePermission('employee:create'),
  asyncHandler(async (req, res) => created(res, await employees.create(buildCtx(req), createSchema.parse(req.body)))),
);

employeeRouter.post(
  '/import/preview',
  requirePermission('employee:import'),
  csvUpload.single('file'),
  asyncHandler(async (req, res) => {
    const text = imports.readCsvInput(req.file, (req.body as Record<string, unknown> | undefined)?.csv);
    ok(res, await imports.preview(buildCtx(req), text));
  }),
);

employeeRouter.post(
  '/import/confirm',
  requirePermission('employee:import'),
  asyncHandler(async (req, res) => ok(res, await imports.confirm(buildCtx(req), confirmSchema.parse(req.body).job_id))),
);

// Access to a single record is checked in the service: own record, or employee:view.
employeeRouter.get(
  '/:id',
  asyncHandler(async (req, res) => ok(res, await employees.get(buildCtx(req), idParams.parse(req.params).id))),
);

const updateHandler = asyncHandler(async (req, res) =>
  ok(res, await employees.update(buildCtx(req), idParams.parse(req.params).id, updateSchema.parse(req.body))),
);
employeeRouter.patch('/:id', requirePermission('employee:update'), updateHandler);
employeeRouter.put('/:id', requirePermission('employee:update'), updateHandler);

const deactivateHandler = asyncHandler(async (req, res) =>
  ok(res, await employees.deactivate(buildCtx(req), idParams.parse(req.params).id, deactivateSchema.parse(req.body))),
);
employeeRouter.post('/:id/deactivate', requirePermission('employee:deactivate'), deactivateHandler);
employeeRouter.delete('/:id', requirePermission('employee:deactivate'), deactivateHandler);
