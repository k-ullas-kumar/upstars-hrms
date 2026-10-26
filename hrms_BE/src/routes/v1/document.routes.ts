import { Router } from 'express';
import { z } from 'zod';
import { requireAnyPermission, requirePermission } from '../../middleware/rbac';
import * as documents from '../../services/document.service';
import { buildCtx } from '../../utils/audit';
import { asyncHandler, created, ok } from '../../utils/http';
import { idParams, queryRecord, uuid } from './schemas';

const templateFields = {
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().min(1).max(40),
  body_template: z.string().min(1).max(50000),
  required_fields: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
};
const createTemplateSchema = z.object(templateFields);
const updateTemplateSchema = z.object(templateFields).partial();
const previewSchema = z.object({
  template_id: uuid,
  employee_id: uuid,
  fields: z.record(z.string().max(1000)).optional(),
});

export const templateRouter = Router();

templateRouter.get(
  '/',
  requireAnyPermission('document:manage', 'document:generate', 'document:approve'),
  asyncHandler(async (req, res) => ok(res, await documents.listTemplates(buildCtx(req), queryRecord(req.query)))),
);
templateRouter.post(
  '/',
  requirePermission('document:manage'),
  asyncHandler(async (req, res) =>
    created(res, await documents.createTemplate(buildCtx(req), createTemplateSchema.parse(req.body))),
  ),
);
templateRouter.get(
  '/:id',
  requireAnyPermission('document:manage', 'document:generate', 'document:approve'),
  asyncHandler(async (req, res) => ok(res, await documents.getTemplate(buildCtx(req), idParams.parse(req.params).id))),
);
templateRouter.patch(
  '/:id',
  requirePermission('document:manage'),
  asyncHandler(async (req, res) =>
    ok(res, await documents.updateTemplate(buildCtx(req), idParams.parse(req.params).id, updateTemplateSchema.parse(req.body))),
  ),
);
templateRouter.delete(
  '/:id',
  requirePermission('document:manage'),
  asyncHandler(async (req, res) => ok(res, await documents.deleteTemplate(buildCtx(req), idParams.parse(req.params).id))),
);

export const generatedDocumentRouter = Router();

generatedDocumentRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await documents.listDocuments(buildCtx(req), queryRecord(req.query));
    ok(res, result.items, result.pagination);
  }),
);
generatedDocumentRouter.post(
  '/preview',
  requirePermission('document:generate'),
  asyncHandler(async (req, res) => created(res, await documents.preview(buildCtx(req), previewSchema.parse(req.body)))),
);
generatedDocumentRouter.get(
  '/:id',
  asyncHandler(async (req, res) => ok(res, await documents.getDocument(buildCtx(req), idParams.parse(req.params).id))),
);
generatedDocumentRouter.post(
  '/:id/submit',
  requirePermission('document:generate'),
  asyncHandler(async (req, res) => ok(res, await documents.submit(buildCtx(req), idParams.parse(req.params).id))),
);
generatedDocumentRouter.post(
  '/:id/approve',
  requirePermission('document:approve'),
  asyncHandler(async (req, res) => ok(res, await documents.approve(buildCtx(req), idParams.parse(req.params).id))),
);
generatedDocumentRouter.post(
  '/:id/issue',
  requirePermission('document:generate'),
  asyncHandler(async (req, res) => ok(res, await documents.issue(buildCtx(req), idParams.parse(req.params).id))),
);
// Private, authenticated download: files are never served from a public static directory.
generatedDocumentRouter.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const file = await documents.getDownload(buildCtx(req), idParams.parse(req.params).id);
    res.download(file.absolutePath, file.filename);
  }),
);
