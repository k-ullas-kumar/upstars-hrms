import fs from 'fs';
import { z } from 'zod';
import { sequelize } from '../config/database';
import { Branch, Department, Designation, Employee, ImportJob } from '../models';
import { RequestCtx } from '../utils/audit';
import { parseCsv } from '../utils/csv';
import { AppError } from '../utils/errors';
import { isIsoDate } from '../utils/leave';
import * as audit from './audit.service';

const MAX_ROWS = 1000;
const REQUIRED_HEADERS = ['employee_number', 'full_name', 'work_email', 'joining_date'];

const HEADER_ALIASES: Record<string, string> = {
  name: 'full_name',
  email: 'work_email',
  employee_no: 'employee_number',
  emp_id: 'employee_number',
  manager_number: 'manager_employee_number',
  manager: 'manager_employee_number',
  dob: 'date_of_birth',
};

interface ParsedRow {
  employee_number: string;
  full_name: string;
  work_email: string;
  phone: string | null;
  joining_date: string;
  date_of_birth: string | null;
  department_id: string | null;
  designation_id: string | null;
  branch_id: string | null;
  manager_employee_number: string | null;
}

export interface RowResult {
  row: number;
  data: Record<string, string>;
  errors: string[];
}

const emailSchema = z.string().email();

/** Reads the CSV from an uploaded file (deleting it afterwards) or an inline string. */
export function readCsvInput(file: Express.Multer.File | undefined, inline: unknown): string {
  if (file) {
    try {
      return fs.readFileSync(file.path, 'utf8');
    } finally {
      fs.rm(file.path, { force: true }, () => undefined);
    }
  }
  if (typeof inline === 'string' && inline.trim()) return inline;
  throw AppError.badRequest('Provide a CSV file (multipart field "file") or a "csv" string');
}

async function nameMap(model: typeof Branch, tenantId: string) {
  const rows = await model.findAll({ where: { tenant_id: tenantId }, attributes: ['id', 'name'] });
  return new Map(rows.map((r) => [String(r.name).trim().toLowerCase(), r.id as string]));
}

export async function preview(ctx: RequestCtx, csvText: string) {
  const parsed = parseCsv(csvText);
  const headers = parsed.headers.map((h) => HEADER_ALIASES[h] ?? h);
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missingHeaders.length) throw AppError.badRequest(`Missing required column(s): ${missingHeaders.join(', ')}`);
  if (parsed.rows.length === 0) throw AppError.badRequest('The CSV contains no data rows');
  if (parsed.rows.length > MAX_ROWS) throw AppError.badRequest(`A maximum of ${MAX_ROWS} rows can be imported at once`);

  const [departments, designations, branches, existing] = await Promise.all([
    nameMap(Department, ctx.tenantId),
    nameMap(Designation, ctx.tenantId),
    nameMap(Branch, ctx.tenantId),
    Employee.findAll({ where: { tenant_id: ctx.tenantId }, attributes: ['employee_number', 'work_email'] }),
  ]);
  const takenNumbers = new Set(existing.map((e) => String(e.employee_number).toLowerCase()));
  const takenEmails = new Set(existing.map((e) => String(e.work_email).toLowerCase()));
  const existingNumbers = new Set(takenNumbers);
  const fileNumbers = new Set<string>();
  const seenNumbers = new Set<string>();
  const seenEmails = new Set<string>();

  const results: RowResult[] = [];
  const valid: ParsedRow[] = [];

  const rawRows = parsed.rows.map((r) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) out[HEADER_ALIASES[k] ?? k] = v ?? '';
    return out;
  });
  for (const r of rawRows) if (r.employee_number) fileNumbers.add(r.employee_number.toLowerCase());

  rawRows.forEach((r, idx) => {
    const errors: string[] = [];
    const number = r.employee_number ?? '';
    const email = (r.work_email ?? '').toLowerCase();
    if (!number) errors.push('employee_number is required');
    if (!r.full_name) errors.push('full_name is required');
    if (!email || !emailSchema.safeParse(email).success) errors.push('work_email is missing or invalid');
    if (!r.joining_date || !isIsoDate(r.joining_date)) errors.push('joining_date must be YYYY-MM-DD');
    if (r.date_of_birth && !isIsoDate(r.date_of_birth)) errors.push('date_of_birth must be YYYY-MM-DD');
    if (number && takenNumbers.has(number.toLowerCase())) errors.push('employee_number already exists');
    if (email && takenEmails.has(email)) errors.push('work_email already exists');
    if (number && seenNumbers.has(number.toLowerCase())) errors.push('employee_number is duplicated in the file');
    if (email && seenEmails.has(email)) errors.push('work_email is duplicated in the file');
    if (number) seenNumbers.add(number.toLowerCase());
    if (email) seenEmails.add(email);
    const lookup = (value: string | undefined, map: Map<string, string>, label: string) => {
      if (!value) return null;
      const id = map.get(value.trim().toLowerCase());
      if (!id) errors.push(`Unknown ${label}: ${value}`);
      return id ?? null;
    };
    const department_id = lookup(r.department, departments, 'department');
    const designation_id = lookup(r.designation, designations, 'designation');
    const branch_id = lookup(r.branch, branches, 'branch');

    const mgr = r.manager_employee_number?.toLowerCase();
    if (mgr && !existingNumbers.has(mgr) && !fileNumbers.has(mgr)) errors.push(`Unknown manager: ${r.manager_employee_number}`);
    if (mgr && mgr === number.toLowerCase()) errors.push('An employee cannot be their own manager');

    results.push({ row: idx + 2, data: r, errors });
    if (errors.length === 0) {
      valid.push({
        employee_number: number,
        full_name: r.full_name,
        work_email: email,
        phone: r.phone || null,
        joining_date: r.joining_date,
        date_of_birth: r.date_of_birth || null,
        department_id,
        designation_id,
        branch_id,
        manager_employee_number: r.manager_employee_number || null,
      });
    }
  });

  const summary = {
    total_rows: results.length,
    valid_rows: valid.length,
    invalid_rows: results.length - valid.length,
    parse_errors: parsed.errors,
  };
  const job = await ImportJob.create({
    tenant_id: ctx.tenantId,
    created_by: ctx.userId,
    kind: 'EMPLOYEES',
    status: 'PREVIEW',
    payload: { rows: valid },
    summary,
  });
  await audit.log('IMPORT_PREVIEW', 'ImportJob', job.id, null, { summary }, ctx.audit);
  return { job_id: job.id, summary, rows: results };
}

export async function confirm(ctx: RequestCtx, jobId: string) {
  const job = await ImportJob.findOne({ where: { id: jobId, tenant_id: ctx.tenantId, kind: 'EMPLOYEES' } });
  if (!job) throw AppError.notFound('Import job not found');
  if (job.status !== 'PREVIEW') throw AppError.conflict(`Import job is already ${String(job.status).toLowerCase()}`);
  const rows = ((job.payload as { rows?: ParsedRow[] } | null)?.rows ?? []) as ParsedRow[];
  if (rows.length === 0) throw AppError.unprocessable('There are no valid rows to import');

  // Claim the job atomically so a double-click cannot import twice.
  const [claimed] = await ImportJob.update(
    { status: 'COMPLETED' },
    { where: { id: jobId, tenant_id: ctx.tenantId, status: 'PREVIEW' } },
  );
  if (claimed !== 1) throw AppError.conflict('Import job is already being processed');

  try {
    const created = await sequelize.transaction(async (t) => {
      const idByNumber = new Map<string, string>();
      const existing = await Employee.findAll({ where: { tenant_id: ctx.tenantId }, attributes: ['id', 'employee_number'], transaction: t });
      for (const e of existing) idByNumber.set(String(e.employee_number).toLowerCase(), e.id as string);

      for (const r of rows) {
        const { manager_employee_number: _mgr, ...fields } = r;
        const emp = await Employee.create({ ...fields, tenant_id: ctx.tenantId, employment_status: 'ACTIVE' }, { transaction: t });
        idByNumber.set(r.employee_number.toLowerCase(), emp.id as string);
      }
      for (const r of rows) {
        if (!r.manager_employee_number) continue;
        const managerId = idByNumber.get(r.manager_employee_number.toLowerCase());
        const selfId = idByNumber.get(r.employee_number.toLowerCase());
        if (managerId && selfId) {
          await Employee.update({ manager_employee_id: managerId }, { where: { id: selfId, tenant_id: ctx.tenantId }, transaction: t });
        }
      }
      return rows.length;
    });
    const summary = { ...(job.summary as object), created };
    await ImportJob.update({ summary }, { where: { id: jobId, tenant_id: ctx.tenantId } });
    await audit.log('IMPORT_CONFIRM', 'ImportJob', jobId, null, { created }, ctx.audit);
    return { job_id: jobId, status: 'COMPLETED', created };
  } catch (err) {
    await ImportJob.update({ status: 'FAILED' }, { where: { id: jobId, tenant_id: ctx.tenantId } });
    throw err;
  }
}
