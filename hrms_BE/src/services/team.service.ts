import { Op, WhereOptions } from 'sequelize';
import { sequelize } from '../config/database';
import { Employee, Row, Task, Team, TeamMembership } from '../models';
import { isHrScope, RequestCtx } from '../utils/audit';
import { AppError } from '../utils/errors';
import { todayIso } from '../utils/leave';
import { buildPagination, parsePagination } from '../utils/pagination';
import * as audit from './audit.service';
import { notifyEmployee } from './notification.service';
import { getTenantEmployee, visibleEmployeeIds } from './scope';

const EMP_ATTRS = ['id', 'employee_number', 'full_name'];

/* ---------------------------------- teams ---------------------------------- */

export interface TeamInput {
  name?: string;
  description?: string | null;
  lead_employee_id?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

async function loadTeam(ctx: RequestCtx, id: string): Promise<Row> {
  const team = await Team.findOne({ where: { id, tenant_id: ctx.tenantId } });
  if (!team) throw AppError.notFound('Team not found');
  return team;
}

async function assertLead(ctx: RequestCtx, leadId?: string | null) {
  if (leadId) await getTenantEmployee(ctx, leadId).catch(() => { throw AppError.badRequest('Unknown team lead'); });
}

export async function listTeams(ctx: RequestCtx, query: Record<string, unknown>) {
  const where: Record<string, unknown> = { tenant_id: ctx.tenantId };
  if (typeof query.status === 'string' && query.status) where.status = query.status;
  const teams = await Team.findAll({
    where,
    include: [{ model: Employee, as: 'lead', attributes: EMP_ATTRS }],
    order: [['name', 'ASC']],
  });
  const counts = (await TeamMembership.count({
    where: { tenant_id: ctx.tenantId, end_date: null },
    group: ['team_id'],
  })) as unknown as Array<{ team_id: string; count: number }>;
  const byTeam = new Map(counts.map((c) => [c.team_id, Number(c.count)]));
  return teams.map((t) => ({ ...t.toJSON(), member_count: byTeam.get(t.id) ?? 0 }));
}

export async function getTeam(ctx: RequestCtx, id: string) {
  const team = await Team.findOne({
    where: { id, tenant_id: ctx.tenantId },
    include: [
      { model: Employee, as: 'lead', attributes: EMP_ATTRS },
      {
        model: TeamMembership,
        as: 'memberships',
        include: [{ model: Employee, as: 'employee', attributes: EMP_ATTRS }],
      },
    ],
  });
  if (!team) throw AppError.notFound('Team not found');
  return team.toJSON();
}

export async function createTeam(ctx: RequestCtx, input: TeamInput) {
  await assertLead(ctx, input.lead_employee_id);
  const row = await Team.create({ ...input, tenant_id: ctx.tenantId });
  await audit.log('CREATE', 'Team', row.id, null, row, ctx.audit);
  return row.toJSON();
}

export async function updateTeam(ctx: RequestCtx, id: string, input: TeamInput) {
  const row = await loadTeam(ctx, id);
  await assertLead(ctx, input.lead_employee_id);
  const before = audit.snapshot(row);
  await row.update(input);
  await audit.log('UPDATE', 'Team', id, before, row, ctx.audit);
  return row.toJSON();
}

export async function deleteTeam(ctx: RequestCtx, id: string) {
  const row = await loadTeam(ctx, id);
  const before = audit.snapshot(row);
  await sequelize.transaction(async (t) => {
    await TeamMembership.destroy({ where: { tenant_id: ctx.tenantId, team_id: id }, transaction: t });
    await Task.update({ team_id: null }, { where: { tenant_id: ctx.tenantId, team_id: id }, transaction: t });
    await row.destroy({ transaction: t });
    await audit.log('DELETE', 'Team', id, before, null, ctx.audit, t);
  });
  return { id, deleted: true };
}

/* ------------------------------- memberships ------------------------------- */

export async function listMembers(ctx: RequestCtx, teamId: string) {
  await loadTeam(ctx, teamId);
  const rows = await TeamMembership.findAll({
    where: { tenant_id: ctx.tenantId, team_id: teamId },
    include: [{ model: Employee, as: 'employee', attributes: EMP_ATTRS }],
    order: [['start_date', 'ASC']],
  });
  return rows.map((r) => r.toJSON());
}

export async function addMember(
  ctx: RequestCtx,
  teamId: string,
  input: { employee_id: string; role?: string | null; start_date?: string },
) {
  await loadTeam(ctx, teamId);
  const emp = await getTenantEmployee(ctx, input.employee_id).catch(() => {
    throw AppError.badRequest('Unknown employee');
  });
  const active = await TeamMembership.findOne({
    where: { tenant_id: ctx.tenantId, team_id: teamId, employee_id: emp.id, end_date: null },
  });
  if (active) throw AppError.conflict('Employee is already a member of this team');
  const row = await TeamMembership.create({
    tenant_id: ctx.tenantId,
    team_id: teamId,
    employee_id: emp.id,
    role: input.role ?? null,
    start_date: input.start_date ?? todayIso(),
  });
  await audit.log('ADD_MEMBER', 'TeamMembership', row.id, null, row, ctx.audit);
  await notifyEmployee(ctx.tenantId, emp.id, 'TEAM_MEMBER_ADDED', 'Added to a team', 'You were added to a team.', { type: 'Team', id: teamId });
  return row.toJSON();
}

export async function removeMember(ctx: RequestCtx, teamId: string, membershipId: string) {
  const row = await TeamMembership.findOne({ where: { id: membershipId, team_id: teamId, tenant_id: ctx.tenantId } });
  if (!row) throw AppError.notFound('Membership not found');
  const before = audit.snapshot(row);
  await row.destroy();
  await audit.log('REMOVE_MEMBER', 'TeamMembership', membershipId, before, null, ctx.audit);
  return { id: membershipId, deleted: true };
}

/* ---------------------------------- tasks ---------------------------------- */

export interface TaskInput {
  team_id?: string | null;
  title?: string;
  description?: string | null;
  owner_employee_id?: string;
  status?: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
  due_at?: Date | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

const TASK_INCLUDES = [
  { model: Employee, as: 'owner', attributes: EMP_ATTRS },
  { model: Team, as: 'team', attributes: ['id', 'name'] },
];

async function loadTask(ctx: RequestCtx, id: string): Promise<Row> {
  const task = await Task.findOne({ where: { id, tenant_id: ctx.tenantId }, include: TASK_INCLUDES });
  if (!task) throw AppError.notFound('Task not found');
  return task;
}

/** Task visibility: HR scope sees all; managers see their team's; everyone else sees only their own. */
async function taskScope(ctx: RequestCtx): Promise<WhereOptions | null> {
  if (isHrScope(ctx)) return null;
  const clauses: WhereOptions[] = [{ created_by: ctx.userId }];
  if (ctx.employeeId) clauses.push({ owner_employee_id: ctx.employeeId });
  if (ctx.permissions.has('task:manage')) {
    const ids = await visibleEmployeeIds(ctx);
    if (ids?.length) clauses.push({ owner_employee_id: { [Op.in]: ids } });
  }
  return { [Op.or]: clauses };
}

export async function listTasks(ctx: RequestCtx, query: Record<string, unknown>) {
  const page = parsePagination(query, 200);
  const where: WhereOptions[] = [{ tenant_id: ctx.tenantId }];
  const scope = await taskScope(ctx);
  if (scope) where.push(scope);
  if (query.scope === 'mine') where.push({ owner_employee_id: ctx.employeeId ?? '' });
  for (const key of ['status', 'priority', 'team_id', 'owner_employee_id'] as const) {
    if (typeof query[key] === 'string' && query[key]) where.push({ [key]: query[key] });
  }
  const { rows, count } = await Task.findAndCountAll({
    where: { [Op.and]: where },
    include: TASK_INCLUDES,
    order: [
      ['status', 'ASC'],
      ['due_at', 'ASC'],
    ],
    limit: page.limit,
    offset: page.offset,
  });
  return { items: rows.map((r) => r.toJSON()), pagination: buildPagination(count, page) };
}

export async function getTask(ctx: RequestCtx, id: string) {
  const task = await loadTask(ctx, id);
  const scope = await taskScope(ctx);
  if (scope) {
    const visible = await Task.count({ where: { [Op.and]: [{ id, tenant_id: ctx.tenantId }, scope] } });
    if (!visible) throw AppError.forbidden();
  }
  return task.toJSON();
}

async function assertTaskRefs(ctx: RequestCtx, input: TaskInput) {
  if (input.owner_employee_id) {
    await getTenantEmployee(ctx, input.owner_employee_id).catch(() => {
      throw AppError.badRequest('Unknown task owner');
    });
  }
  if (input.team_id) await loadTeam(ctx, input.team_id).catch(() => { throw AppError.badRequest('Unknown team'); });
}

export async function createTask(ctx: RequestCtx, input: TaskInput) {
  await assertTaskRefs(ctx, input);
  const row = await Task.create({ ...input, tenant_id: ctx.tenantId, created_by: ctx.userId });
  await audit.log('CREATE', 'Task', row.id, null, row, ctx.audit);
  if (input.owner_employee_id && input.owner_employee_id !== ctx.employeeId) {
    await notifyEmployee(ctx.tenantId, input.owner_employee_id, 'TASK_ASSIGNED', 'New task assigned', input.title ?? 'A task was assigned to you.', {
      type: 'Task',
      id: row.id,
    });
  }
  return (await loadTask(ctx, row.id)).toJSON();
}

export async function updateTask(ctx: RequestCtx, id: string, input: TaskInput) {
  const task = await loadTask(ctx, id);
  const isOwner = ctx.employeeId !== null && task.owner_employee_id === ctx.employeeId;
  const canManage = ctx.permissions.has('task:manage');
  if (!canManage && !isOwner) throw AppError.forbidden();

  // Owners without task:manage may only progress the status of their own task.
  let patch: TaskInput = input;
  if (!canManage) {
    if (input.status === undefined) throw AppError.forbidden('You may only update the status of your own tasks');
    patch = { status: input.status };
  } else {
    const scope = await taskScope(ctx);
    if (scope && !(await Task.count({ where: { [Op.and]: [{ id, tenant_id: ctx.tenantId }, scope] } }))) {
      throw AppError.forbidden();
    }
    await assertTaskRefs(ctx, input);
  }
  const before = audit.snapshot(task);
  const ownerChanged = patch.owner_employee_id && patch.owner_employee_id !== task.owner_employee_id;
  await task.update(patch);
  await audit.log('UPDATE', 'Task', id, before, task, ctx.audit);
  if (ownerChanged && patch.owner_employee_id !== ctx.employeeId) {
    await notifyEmployee(ctx.tenantId, patch.owner_employee_id as string, 'TASK_ASSIGNED', 'Task assigned to you', task.title, {
      type: 'Task',
      id,
    });
  }
  return (await loadTask(ctx, id)).toJSON();
}

export async function deleteTask(ctx: RequestCtx, id: string) {
  const task = await loadTask(ctx, id);
  const scope = await taskScope(ctx);
  if (scope && !(await Task.count({ where: { [Op.and]: [{ id, tenant_id: ctx.tenantId }, scope] } }))) {
    throw AppError.forbidden();
  }
  const before = audit.snapshot(task);
  await task.destroy();
  await audit.log('DELETE', 'Task', id, before, null, ctx.audit);
  return { id, deleted: true };
}
