import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { Op, WhereOptions } from 'sequelize';
import { sequelize } from '../config/database';
import { env } from '../config/env';
import { Branch, Department, Designation, DocumentTemplate, Employee, GeneratedDocument, Row, Tenant } from '../models';
import { RequestCtx } from '../utils/audit';
import { AppError } from '../utils/errors';
import { buildPagination, parsePagination } from '../utils/pagination';
import { extractPlaceholders, renderTemplate } from '../utils/template';
import { todayIso } from '../utils/leave';
import * as audit from './audit.service';
import { notifyEmployee } from './notification.service';

/* -------------------------------- templates -------------------------------- */

export interface TemplateInput {
  name?: string;
  code?: string;
  body_template?: string;
  required_fields?: string[];
  status?: 'ACTIVE' | 'INACTIVE';
}

async function loadTemplate(ctx: RequestCtx, id: string): Promise<Row> {
  const row = await DocumentTemplate.findOne({ where: { id, tenant_id: ctx.tenantId } });
  if (!row) throw AppError.notFound('Template not found');
  return row;
}

export async function listTemplates(ctx: RequestCtx, query: Record<string, unknown>) {
  const where: Record<string, unknown> = { tenant_id: ctx.tenantId };
  if (typeof query.status === 'string' && query.status) where.status = query.status;
  const rows = await DocumentTemplate.findAll({ where, order: [['name', 'ASC']] });
  return rows.map((r) => r.toJSON());
}

export async function getTemplate(ctx: RequestCtx, id: string) {
  return (await loadTemplate(ctx, id)).toJSON();
}

export async function createTemplate(ctx: RequestCtx, input: TemplateInput) {
  const code = (input.code as string).toUpperCase();
  const dup = await DocumentTemplate.findOne({ where: { tenant_id: ctx.tenantId, code }, attributes: ['id'] });
  if (dup) throw AppError.conflict('A template with this code already exists');
  const row = await DocumentTemplate.create({
    ...input,
    code,
    tenant_id: ctx.tenantId,
    required_fields: input.required_fields ?? extractPlaceholders(input.body_template as string),
    version: 1,
  });
  await audit.log('CREATE', 'DocumentTemplate', row.id, null, row, ctx.audit);
  return row.toJSON();
}

export async function updateTemplate(ctx: RequestCtx, id: string, input: TemplateInput) {
  const row = await loadTemplate(ctx, id);
  const before = audit.snapshot(row);
  const patch: Record<string, unknown> = { ...input };
  if (input.code) {
    patch.code = input.code.toUpperCase();
    if (patch.code !== row.code) {
      const dup = await DocumentTemplate.findOne({ where: { tenant_id: ctx.tenantId, code: patch.code }, attributes: ['id'] });
      if (dup) throw AppError.conflict('A template with this code already exists');
    }
  }
  if (input.body_template !== undefined && input.body_template !== row.body_template) {
    patch.version = Number(row.version) + 1;
    if (input.required_fields === undefined) patch.required_fields = extractPlaceholders(input.body_template);
  }
  await row.update(patch);
  await audit.log('UPDATE', 'DocumentTemplate', id, before, row, ctx.audit);
  return row.toJSON();
}

export async function deleteTemplate(ctx: RequestCtx, id: string) {
  const row = await loadTemplate(ctx, id);
  const used = await GeneratedDocument.count({ where: { tenant_id: ctx.tenantId, template_id: id } });
  const before = audit.snapshot(row);
  if (used > 0) {
    await row.update({ status: 'INACTIVE' });
    await audit.log('DEACTIVATE', 'DocumentTemplate', id, before, row, ctx.audit);
    return { id, deleted: false, deactivated: true };
  }
  await row.destroy();
  await audit.log('DELETE', 'DocumentTemplate', id, before, null, ctx.audit);
  return { id, deleted: true };
}

/* ------------------------------ generated docs ----------------------------- */

const DOC_INCLUDES = [
  { model: DocumentTemplate, as: 'template', attributes: ['id', 'name', 'code', 'version'] },
  { model: Employee, as: 'employee', attributes: ['id', 'employee_number', 'full_name', 'user_id'] },
];

async function loadDocument(ctx: RequestCtx, id: string): Promise<Row> {
  const doc = await GeneratedDocument.findOne({ where: { id, tenant_id: ctx.tenantId }, include: DOC_INCLUDES });
  if (!doc) throw AppError.notFound('Document not found');
  return doc;
}

const isDocManager = (ctx: RequestCtx) =>
  ctx.permissions.has('document:generate') || ctx.permissions.has('document:approve') || ctx.permissions.has('document:manage');

function sanitizeDoc(doc: Row) {
  const json = doc.toJSON() as Record<string, unknown>;
  delete json.storage_path; // internal filesystem location is never exposed
  return json;
}

export async function listDocuments(ctx: RequestCtx, query: Record<string, unknown>) {
  const page = parsePagination(query);
  const where: WhereOptions[] = [{ tenant_id: ctx.tenantId }];
  if (!isDocManager(ctx)) {
    // Employees only see their own issued documents.
    if (!ctx.employeeId) throw AppError.forbidden();
    where.push({ employee_id: ctx.employeeId, status: 'ISSUED' });
  } else {
    if (typeof query.employee_id === 'string' && query.employee_id) where.push({ employee_id: query.employee_id });
    if (typeof query.status === 'string' && query.status) where.push({ status: query.status });
  }
  const { rows, count } = await GeneratedDocument.findAndCountAll({
    where: { [Op.and]: where },
    include: DOC_INCLUDES,
    order: [['created_at', 'DESC']],
    limit: page.limit,
    offset: page.offset,
  });
  return { items: rows.map(sanitizeDoc), pagination: buildPagination(count, page) };
}

export async function getDocument(ctx: RequestCtx, id: string) {
  const doc = await loadDocument(ctx, id);
  if (!isDocManager(ctx) && !(doc.employee_id === ctx.employeeId && doc.status === 'ISSUED')) throw AppError.forbidden();
  return sanitizeDoc(doc);
}

async function buildContext(ctx: RequestCtx, employeeId: string, extra: Record<string, string> = {}) {
  const emp = await Employee.findOne({
    where: { id: employeeId, tenant_id: ctx.tenantId },
    include: [
      { model: Branch, as: 'branch', attributes: ['name'] },
      { model: Department, as: 'department', attributes: ['name'] },
      { model: Designation, as: 'designation', attributes: ['name'] },
      { model: Employee, as: 'manager', attributes: ['full_name'] },
    ],
  });
  if (!emp) throw AppError.badRequest('Unknown employee');
  const tenant = await Tenant.findByPk(ctx.tenantId, { attributes: ['name'] });
  return {
    full_name: emp.full_name,
    employee_number: emp.employee_number,
    work_email: emp.work_email,
    phone: emp.phone,
    joining_date: emp.joining_date,
    exit_date: emp.exit_date,
    designation: emp.designation?.name,
    department: emp.department?.name,
    branch: emp.branch?.name,
    manager: emp.manager?.full_name,
    company_name: tenant?.name,
    today: todayIso(),
    ...extra,
  } as Record<string, unknown>;
}

export async function preview(
  ctx: RequestCtx,
  input: { template_id: string; employee_id: string; fields?: Record<string, string> },
) {
  const template = await loadTemplate(ctx, input.template_id);
  if (template.status !== 'ACTIVE') throw AppError.badRequest('Template is inactive');
  const context = await buildContext(ctx, input.employee_id, input.fields);
  const { text, missing } = renderTemplate(template.body_template, context);
  const requiredMissing = ((template.required_fields as string[]) ?? []).filter(
    (f) => !renderTemplate(`{{${f}}}`, context).text.trim(),
  );
  const allMissing = [...new Set([...missing, ...requiredMissing])];

  const version =
    (await GeneratedDocument.count({
      where: { tenant_id: ctx.tenantId, template_id: template.id, employee_id: input.employee_id },
    })) + 1;
  const doc = await GeneratedDocument.create({
    tenant_id: ctx.tenantId,
    template_id: template.id,
    employee_id: input.employee_id,
    status: 'DRAFT',
    version,
    generated_by: ctx.userId,
    preview_payload: { rendered_text: text, missing_fields: allMissing, fields: input.fields ?? {} },
  });
  await audit.log('GENERATE_PREVIEW', 'GeneratedDocument', doc.id, null, doc, ctx.audit);
  return sanitizeDoc(await loadDocument(ctx, doc.id));
}

export async function submit(ctx: RequestCtx, id: string) {
  const doc = await loadDocument(ctx, id);
  if (doc.status !== 'DRAFT') throw AppError.conflict(`Only draft documents can be submitted (current status: ${doc.status})`);
  const [changed] = await GeneratedDocument.update(
    { status: 'PENDING_APPROVAL' },
    { where: { id, tenant_id: ctx.tenantId, status: 'DRAFT' } },
  );
  if (changed !== 1) throw AppError.conflict('Document status changed; please retry');
  await audit.log('SUBMIT', 'GeneratedDocument', id, { status: 'DRAFT' }, { status: 'PENDING_APPROVAL' }, ctx.audit);
  return sanitizeDoc(await loadDocument(ctx, id));
}

export async function approve(ctx: RequestCtx, id: string) {
  const doc = await loadDocument(ctx, id);
  if (doc.status !== 'DRAFT' && doc.status !== 'PENDING_APPROVAL') {
    throw AppError.conflict(`Document cannot be approved from status ${doc.status}`);
  }
  const missing = (doc.preview_payload?.missing_fields as string[] | undefined) ?? [];
  if (missing.length) throw AppError.unprocessable(`Document has unresolved fields: ${missing.join(', ')}`);
  const [changed] = await GeneratedDocument.update(
    { status: 'APPROVED', approved_by: ctx.userId },
    { where: { id, tenant_id: ctx.tenantId, status: { [Op.in]: ['DRAFT', 'PENDING_APPROVAL'] } } },
  );
  if (changed !== 1) throw AppError.conflict('Document status changed; please retry');
  await audit.log('APPROVE', 'GeneratedDocument', id, { status: doc.status }, { status: 'APPROVED' }, ctx.audit);
  return sanitizeDoc(await loadDocument(ctx, id));
}

function storageRelativePath(tenantId: string, docId: string) {
  return path.join('documents', tenantId, `${docId}.pdf`);
}

/** Resolves a stored relative path inside storageDir, rejecting anything that escapes it. */
function resolveStoragePath(relative: string): string {
  const abs = path.resolve(env.storageDir, relative);
  const root = path.resolve(env.storageDir) + path.sep;
  if (!abs.startsWith(root)) throw AppError.forbidden('Invalid storage path');
  return abs;
}

function writePdf(absPath: string, title: string, body: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    const pdf = new PDFDocument({ size: 'A4', margin: 64, info: { Title: title } });
    const stream = fs.createWriteStream(absPath);
    stream.on('finish', () => resolve());
    stream.on('error', reject);
    pdf.on('error', reject);
    pdf.pipe(stream);
    pdf.fontSize(18).text(title, { align: 'center' });
    pdf.moveDown(1.5);
    pdf.fontSize(11).text(body, { align: 'left', lineGap: 4 });
    pdf.end();
  });
}

export async function issue(ctx: RequestCtx, id: string) {
  const doc = await loadDocument(ctx, id);
  if (doc.status !== 'APPROVED') throw AppError.conflict('Only approved documents can be issued');

  const rel = storageRelativePath(ctx.tenantId, doc.id);
  await writePdf(resolveStoragePath(rel), doc.template?.name ?? 'Document', String(doc.preview_payload?.rendered_text ?? ''));

  await sequelize.transaction(async (t) => {
    const [changed] = await GeneratedDocument.update(
      { status: 'ISSUED', storage_path: rel, issued_at: new Date() },
      { where: { id, tenant_id: ctx.tenantId, status: 'APPROVED' }, transaction: t },
    );
    if (changed !== 1) throw AppError.conflict('Document status changed; please retry');
    await audit.log('ISSUE', 'GeneratedDocument', id, { status: 'APPROVED' }, { status: 'ISSUED' }, ctx.audit, t);
  });
  await notifyEmployee(ctx.tenantId, doc.employee_id, 'DOCUMENT_ISSUED', 'Document issued', `${doc.template?.name ?? 'A document'} has been issued to you.`, {
    type: 'GeneratedDocument',
    id,
  });
  return sanitizeDoc(await loadDocument(ctx, id));
}

/** Returns the on-disk path of an issued PDF after authorisation checks. */
export async function getDownload(ctx: RequestCtx, id: string): Promise<{ absolutePath: string; filename: string }> {
  const doc = await loadDocument(ctx, id);
  const isOwner = doc.employee_id === ctx.employeeId;
  if (!isOwner && !isDocManager(ctx)) throw AppError.forbidden();
  if (doc.status !== 'ISSUED' || !doc.storage_path) throw AppError.conflict('Document has not been issued yet');
  const absolutePath = resolveStoragePath(doc.storage_path);
  if (!fs.existsSync(absolutePath)) throw AppError.notFound('Document file is missing');
  await audit.log('DOWNLOAD', 'GeneratedDocument', id, null, null, ctx.audit);
  const base = `${doc.template?.code ?? 'document'}-${doc.employee?.employee_number ?? doc.employee_id}`;
  return { absolutePath, filename: `${base}.pdf`.replace(/[^A-Za-z0-9._-]/g, '_') };
}
