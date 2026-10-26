import { Op, WhereOptions } from 'sequelize';
import { likeOp, sequelize } from '../config/database';
import { ADMIN_ONLY_ROLES, PLATFORM_ROLES } from '../config/permissions';
import { Branch, Department, Designation, Employee, Role, Row, User, UserRole } from '../models';
import { isHrScope, RequestCtx } from '../utils/audit';
import { generateTempPassword, hashPassword } from '../utils/crypto';
import { AppError } from '../utils/errors';
import { buildPagination, parsePagination } from '../utils/pagination';
import { todayIso } from '../utils/leave';
import * as audit from './audit.service';

const SENSITIVE_FIELDS = ['date_of_birth', 'address'] as const;

const INCLUDES = [
  { model: Branch, as: 'branch', attributes: ['id', 'name'] },
  { model: Department, as: 'department', attributes: ['id', 'name'] },
  { model: Designation, as: 'designation', attributes: ['id', 'name'] },
  { model: Employee, as: 'manager', attributes: ['id', 'employee_number', 'full_name'] },
];

export interface EmployeeInput {
  employee_number?: string;
  full_name?: string;
  work_email?: string;
  phone?: string | null;
  manager_employee_id?: string | null;
  branch_id?: string | null;
  department_id?: string | null;
  designation_id?: string | null;
  employment_status?: 'ACTIVE' | 'INACTIVE' | 'EXITED';
  joining_date?: string;
  exit_date?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
}

export interface CreateEmployeeInput extends EmployeeInput {
  create_login?: boolean;
  role?: string;
  password?: string;
}

export function serializeEmployee(ctx: RequestCtx, emp: Row): Record<string, unknown> {
  const json = emp.toJSON() as Record<string, unknown>;
  const mayViewSensitive = isHrScope(ctx) || (ctx.employeeId !== null && ctx.employeeId === emp.id);
  if (!mayViewSensitive) for (const f of SENSITIVE_FIELDS) delete json[f];
  return json;
}

async function assertRefs(ctx: RequestCtx, input: EmployeeInput, selfId?: string) {
  const checks: Array<[string, typeof Branch, string | null | undefined]> = [
    ['branch', Branch, input.branch_id],
    ['department', Department, input.department_id],
    ['designation', Designation, input.designation_id],
  ];
  for (const [label, model, id] of checks) {
    if (!id) continue;
    const found = await model.findOne({ where: { id, tenant_id: ctx.tenantId }, attributes: ['id'] });
    if (!found) throw AppError.badRequest(`Unknown ${label}`);
  }
  if (input.manager_employee_id) {
    if (input.manager_employee_id === selfId) throw AppError.badRequest('An employee cannot be their own manager');
    const mgr = await Employee.findOne({ where: { id: input.manager_employee_id, tenant_id: ctx.tenantId } });
    if (!mgr) throw AppError.badRequest('Unknown manager');
    // Prevent reporting cycles.
    let cursor: string | null = mgr.manager_employee_id ?? null;
    for (let depth = 0; cursor && depth < 50; depth += 1) {
      if (cursor === selfId) throw AppError.badRequest('Manager assignment would create a reporting cycle');
      const next: Row | null = await Employee.findOne({
        where: { id: cursor, tenant_id: ctx.tenantId },
        attributes: ['manager_employee_id'],
      });
      cursor = next?.manager_employee_id ?? null;
    }
  }
}

async function assertUnique(ctx: RequestCtx, input: EmployeeInput, selfId?: string) {
  const exclude = selfId ? { id: { [Op.ne]: selfId } } : {};
  if (input.employee_number) {
    const dup = await Employee.findOne({
      where: { tenant_id: ctx.tenantId, employee_number: input.employee_number, ...exclude },
      attributes: ['id'],
    });
    if (dup) throw AppError.conflict('An employee with this employee number already exists');
  }
  if (input.work_email) {
    const dup = await Employee.findOne({
      where: { tenant_id: ctx.tenantId, work_email: input.work_email, ...exclude },
      attributes: ['id'],
    });
    if (dup) throw AppError.conflict('An employee with this work email already exists');
  }
}

export async function list(ctx: RequestCtx, query: Record<string, unknown>) {
  const page = parsePagination(query, 500);
  const where: WhereOptions[] = [{ tenant_id: ctx.tenantId }];
  const str = (k: string) => (typeof query[k] === 'string' && (query[k] as string).trim() ? (query[k] as string).trim() : null);

  const search = str('search') ?? str('q');
  if (search) {
    const pattern = `%${search}%`;
    where.push({
      [Op.or]: [
        { full_name: { [likeOp]: pattern } },
        { work_email: { [likeOp]: pattern } },
        { employee_number: { [likeOp]: pattern } },
      ],
    });
  }
  const status = str('status') ?? str('employment_status');
  if (status) where.push({ employment_status: status });
  for (const key of ['department_id', 'branch_id', 'designation_id'] as const) {
    const v = str(key);
    if (v) where.push({ [key]: v });
  }
  const manager = str('manager_id') ?? str('manager_employee_id');
  if (manager) where.push({ manager_employee_id: manager });

  const { rows, count } = await Employee.findAndCountAll({
    where: { [Op.and]: where },
    include: INCLUDES,
    order: [['employee_number', 'ASC']],
    limit: page.limit,
    offset: page.offset,
  });
  return { items: rows.map((r) => serializeEmployee(ctx, r)), pagination: buildPagination(count, page) };
}

async function loadEmployee(ctx: RequestCtx, id: string): Promise<Row> {
  const emp = await Employee.findOne({ where: { id, tenant_id: ctx.tenantId }, include: INCLUDES });
  if (!emp) throw AppError.notFound('Employee not found');
  return emp;
}

export async function get(ctx: RequestCtx, id: string) {
  const emp = await loadEmployee(ctx, id);
  const isSelf = ctx.employeeId === emp.id;
  if (!isSelf && !ctx.permissions.has('employee:view')) throw AppError.forbidden();
  return serializeEmployee(ctx, emp);
}

async function resolveLoginRole(ctx: RequestCtx, roleName: string): Promise<Row> {
  if ((PLATFORM_ROLES as string[]).includes(roleName)) throw AppError.forbidden('This role cannot be granted');
  if ((ADMIN_ONLY_ROLES as string[]).includes(roleName) && !ctx.roles.includes('COMPANY_ADMIN')) {
    throw AppError.forbidden('Only a company admin can grant this role');
  }
  const role = await Role.findOne({ where: { name: roleName, tenant_id: { [Op.or]: [null, ctx.tenantId] } } });
  if (!role) throw AppError.badRequest(`Unknown role ${roleName}`);
  return role;
}

export async function create(ctx: RequestCtx, input: CreateEmployeeInput) {
  await assertUnique(ctx, input);
  await assertRefs(ctx, input);
  const { create_login, role, password, ...fields } = input;

  let tempPassword: string | undefined;
  const employeeId = await sequelize.transaction(async (t) => {
    let userId: string | null = null;
    if (create_login) {
      const roleRow = await resolveLoginRole(ctx, role ?? 'EMPLOYEE');
      const plain = password ?? generateTempPassword();
      if (!password) tempPassword = plain;
      const user = await User.create(
        {
          tenant_id: ctx.tenantId,
          email: (fields.work_email as string).toLowerCase(),
          password_hash: await hashPassword(plain),
          full_name: fields.full_name,
        },
        { transaction: t },
      );
      await UserRole.create({ user_id: user.id, role_id: roleRow.id }, { transaction: t });
      userId = user.id;
    }
    const emp = await Employee.create(
      { ...fields, tenant_id: ctx.tenantId, user_id: userId, employment_status: fields.employment_status ?? 'ACTIVE' },
      { transaction: t },
    );
    await audit.log('CREATE', 'Employee', emp.id, null, emp, ctx.audit, t);
    return emp.id as string;
  });

  const created = serializeEmployee(ctx, await loadEmployee(ctx, employeeId));
  return tempPassword ? { ...created, temporary_password: tempPassword } : created;
}

export async function update(ctx: RequestCtx, id: string, input: EmployeeInput) {
  const emp = await loadEmployee(ctx, id);
  await assertUnique(ctx, input, id);
  await assertRefs(ctx, input, id);
  const before = audit.snapshot(emp);

  await sequelize.transaction(async (t) => {
    await emp.update(input, { transaction: t });
    if (emp.user_id && (input.full_name || input.work_email || input.employment_status)) {
      const userPatch: Record<string, unknown> = {};
      if (input.full_name) userPatch.full_name = input.full_name;
      if (input.work_email) userPatch.email = input.work_email.toLowerCase();
      if (input.employment_status) userPatch.status = input.employment_status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
      await User.update(userPatch, { where: { id: emp.user_id, tenant_id: ctx.tenantId }, transaction: t });
    }
    await audit.log('UPDATE', 'Employee', id, before, emp, ctx.audit, t);
  });
  return serializeEmployee(ctx, await loadEmployee(ctx, id));
}

export async function deactivate(
  ctx: RequestCtx,
  id: string,
  input: { status?: 'INACTIVE' | 'EXITED'; exit_date?: string },
) {
  const emp = await loadEmployee(ctx, id);
  if (emp.id === ctx.employeeId) throw AppError.badRequest('You cannot deactivate your own record');
  if (emp.employment_status !== 'ACTIVE') throw AppError.conflict('Employee is already inactive');
  const before = audit.snapshot(emp);

  await sequelize.transaction(async (t) => {
    await emp.update(
      { employment_status: input.status ?? 'EXITED', exit_date: input.exit_date ?? todayIso() },
      { transaction: t },
    );
    if (emp.user_id) {
      await User.update({ status: 'INACTIVE' }, { where: { id: emp.user_id, tenant_id: ctx.tenantId }, transaction: t });
    }
    await audit.log('DEACTIVATE', 'Employee', id, before, emp, ctx.audit, t);
  });
  return serializeEmployee(ctx, await loadEmployee(ctx, id));
}
