import { Op } from 'sequelize';
import { dialectName, sequelize } from '../config/database';
import { PERMISSION_DEFS, ROLE_DEFS, RoleName } from '../config/permissions';
import {
  Asset,
  AssetAssignment,
  Branch,
  Department,
  Designation,
  DocumentTemplate,
  Employee,
  Geofence,
  HrModel,
  LeaveBalance,
  LeaveType,
  OnboardingChecklist,
  OnboardingItem,
  Permission,
  Role,
  RolePermission,
  Row,
  Task,
  Team,
  TeamMembership,
  Tenant,
  User,
  UserRole,
} from '../models';
import { hashPassword } from '../utils/crypto';

const PASSWORD = 'Admin@12345';
const TENANT_SLUG = 'upstars-demo';
const YEAR = 2026;

/** Finds a row by `where`, otherwise creates it with `where` + `values`. */
async function ensure(model: HrModel, where: Record<string, unknown>, values: Record<string, unknown> = {}): Promise<Row> {
  const existing = await model.findOne({ where });
  if (existing) return existing;
  return model.create({ ...where, ...values });
}

async function seedPermissionsAndRoles(): Promise<Map<RoleName, Row>> {
  const permByKey = new Map<string, Row>();
  for (const def of PERMISSION_DEFS) {
    const existing = await Permission.findOne({ where: { key: def.key } });
    if (existing) {
      await existing.update({ name: def.name, description: def.description });
      permByKey.set(def.key, existing);
    } else {
      permByKey.set(def.key, await Permission.create({ key: def.key, name: def.name, description: def.description }));
    }
  }

  const roles = new Map<RoleName, Row>();
  for (const [name, def] of Object.entries(ROLE_DEFS) as Array<[RoleName, (typeof ROLE_DEFS)[RoleName]]>) {
    const role = await ensure(Role, { tenant_id: null, name }, { description: def.description });
    await role.update({ description: def.description });
    // Re-sync permissions so ROLE_DEFS stays the source of truth.
    await RolePermission.destroy({ where: { role_id: role.id } });
    for (const key of def.permissions) {
      await RolePermission.create({ role_id: role.id, permission_id: permByKey.get(key)?.id });
    }
    roles.set(name, role);
  }
  return roles;
}

async function main() {
  await sequelize.authenticate();
  await sequelize.sync();
  const roles = await seedPermissionsAndRoles();

  // ---- tenant ----
  const tenant = await ensure(Tenant, { slug: TENANT_SLUG }, { name: 'UPstars Demo', timezone: 'Asia/Kolkata' });
  await tenant.update({ name: 'UPstars Demo', timezone: 'Asia/Kolkata' });
  const tenantId = tenant.id as string;
  const T = { tenant_id: tenantId };

  // ---- org ----
  const hq = await ensure(Branch, { ...T, name: 'HQ Bangalore' });
  const deptNames = ['Engineering', 'HR', 'Sales'];
  const dept: Record<string, Row> = {};
  for (const name of deptNames) dept[name] = await ensure(Department, { ...T, name });

  const desigNames = ['Chief Executive', 'HR Manager', 'Engineering Manager', 'Software Engineer', 'Sales Executive', 'Asset Coordinator'];
  const desig: Record<string, Row> = {};
  for (const name of desigNames) desig[name] = await ensure(Designation, { ...T, name });

  // ---- users + employees ----
  const passwordHash = await hashPassword(PASSWORD);
  interface Person {
    number: string;
    name: string;
    email: string;
    role: RoleName;
    department: string;
    designation: string;
    manager: string | null;
    joining: string;
  }
  const people: Person[] = [
    { number: 'EMP-004', name: 'Arjun Mehta', email: 'admin@upstars.local', role: 'COMPANY_ADMIN', department: 'Engineering', designation: 'Chief Executive', manager: null, joining: '2020-01-06' },
    { number: 'EMP-003', name: 'Anita Desai', email: 'hr@upstars.local', role: 'HR_MANAGER', department: 'HR', designation: 'HR Manager', manager: 'EMP-004', joining: '2021-03-15' },
    { number: 'EMP-002', name: 'Rahul Verma', email: 'manager@upstars.local', role: 'MANAGER', department: 'Engineering', designation: 'Engineering Manager', manager: 'EMP-004', joining: '2021-07-01' },
    { number: 'EMP-001', name: 'Priya Sharma', email: 'employee@upstars.local', role: 'EMPLOYEE', department: 'Engineering', designation: 'Software Engineer', manager: 'EMP-002', joining: '2023-02-13' },
    { number: 'EMP-005', name: 'Neha Iyer', email: 'assets@upstars.local', role: 'ASSET_MANAGER', department: 'HR', designation: 'Asset Coordinator', manager: 'EMP-003', joining: '2022-09-05' },
  ];

  const employees = new Map<string, Row>();
  const users = new Map<string, Row>();
  for (const p of people) {
    let user = await User.findOne({ where: { email: p.email } });
    if (user) {
      await user.update({ password_hash: passwordHash, full_name: p.name, tenant_id: tenantId, status: 'ACTIVE' });
    } else {
      user = await User.create({ ...T, email: p.email, password_hash: passwordHash, full_name: p.name });
    }
    await UserRole.destroy({ where: { user_id: user.id } });
    await UserRole.create({ user_id: user.id, role_id: roles.get(p.role)?.id });
    users.set(p.number, user);

    const fields = {
      user_id: user.id,
      full_name: p.name,
      work_email: p.email,
      branch_id: hq.id,
      department_id: dept[p.department].id,
      designation_id: desig[p.designation].id,
      employment_status: 'ACTIVE',
      joining_date: p.joining,
    };
    const emp = await ensure(Employee, { ...T, employee_number: p.number }, fields);
    await emp.update(fields);
    employees.set(p.number, emp);
  }
  for (const p of people) {
    const mgr = p.manager ? employees.get(p.manager) : null;
    await employees.get(p.number)?.update({ manager_employee_id: mgr?.id ?? null });
  }
  const emp1 = employees.get('EMP-001') as Row;
  const emp2 = employees.get('EMP-002') as Row;
  const emp3 = employees.get('EMP-003') as Row;

  // ---- leave types + balances ----
  const leaveDefs = [
    { code: 'AL', name: 'Annual Leave', days: 18, carry: true },
    { code: 'SL', name: 'Sick Leave', days: 12, carry: false },
    { code: 'CL', name: 'Casual Leave', days: 8, carry: false },
  ];
  for (const def of leaveDefs) {
    const type = await ensure(LeaveType, { ...T, code: def.code }, { name: def.name, paid: true, max_days_per_year: def.days, carry_forward: def.carry });
    for (const emp of employees.values()) {
      await ensure(LeaveBalance, { ...T, employee_id: emp.id, leave_type_id: type.id, year: YEAR }, { balance: def.days, used: 0 });
    }
  }

  // ---- geofence ----
  await ensure(Geofence, { ...T, name: 'Bangalore Office' }, { latitude: 12.9716, longitude: 77.5946, radius_meters: 300, status: 'ACTIVE' });

  // ---- assets ----
  await ensure(Asset, { ...T, asset_tag: 'LAP-001' }, { category: 'Laptop', serial_number: 'SN-LAP-0001', status: 'AVAILABLE', condition: 'New', location: 'HQ Bangalore' });
  const phone = await ensure(Asset, { ...T, asset_tag: 'PHN-001' }, { category: 'Phone', serial_number: 'SN-PHN-0001', status: 'ASSIGNED', condition: 'Good', location: 'HQ Bangalore' });
  await phone.update({ status: 'ASSIGNED' });
  const hasAssignment = await AssetAssignment.findOne({ where: { ...T, asset_id: phone.id, returned_at: null } });
  if (!hasAssignment) {
    await AssetAssignment.create({
      ...T,
      asset_id: phone.id,
      employee_id: emp1.id,
      assigned_at: new Date(),
      assigned_by: users.get('EMP-005')?.id,
      condition_out: 'Good',
      accessories: ['Charger', 'Case'],
    });
  }

  // ---- document template ----
  const body =
    'OFFER LETTER\n\nDear {{full_name}},\n\nWe are pleased to offer you the position of {{designation}} at {{company_name}}. ' +
    'Your employee number is {{employee_number}} and your joining date is {{joining_date}}.\n\n' +
    'We look forward to welcoming you to the team.\n\nSincerely,\nHuman Resources';
  await ensure(
    DocumentTemplate,
    { ...T, code: 'OFFER_LETTER' },
    { name: 'Offer Letter', body_template: body, required_fields: ['full_name', 'employee_number', 'joining_date', 'designation'], version: 1, status: 'ACTIVE' },
  );

  // ---- team, tasks ----
  const team = await ensure(Team, { ...T, name: 'Platform Engineering' }, { description: 'Core platform and infrastructure', lead_employee_id: emp2.id });
  for (const e of [emp2, emp1]) {
    await ensure(TeamMembership, { ...T, team_id: team.id, employee_id: e.id }, { role: e.id === emp2.id ? 'Lead' : 'Member', start_date: '2026-01-01' });
  }
  const adminUser = users.get('EMP-004') as Row;
  const taskDefs = [
    { title: 'Set up CI pipeline', owner: emp1, status: 'IN_PROGRESS', priority: 'HIGH', due: '2026-11-15T00:00:00.000Z' },
    { title: 'Write API documentation', owner: emp1, status: 'TODO', priority: 'MEDIUM', due: '2026-12-01T00:00:00.000Z' },
    { title: 'Quarterly capacity review', owner: emp2, status: 'TODO', priority: 'LOW', due: '2026-12-15T00:00:00.000Z' },
  ];
  for (const t of taskDefs) {
    await ensure(Task, { ...T, title: t.title }, {
      team_id: team.id,
      owner_employee_id: t.owner.id,
      created_by: adminUser.id,
      status: t.status,
      priority: t.priority,
      due_at: new Date(t.due),
    });
  }

  // ---- onboarding ----
  const checklist = await ensure(OnboardingChecklist, { ...T, employee_id: emp1.id, name: 'New Joiner Onboarding' }, { status: 'IN_PROGRESS' });
  const items = [
    { title: 'Submit ID proof', done: true },
    { title: 'Collect laptop and accessories', done: false },
    { title: 'Complete security training', done: false },
  ];
  for (const item of items) {
    await ensure(OnboardingItem, { ...T, checklist_id: checklist.id, title: item.title }, {
      employee_id: emp1.id,
      owner_user_id: emp3.user_id,
      status: item.done ? 'COMPLETED' : 'PENDING',
      completed_at: item.done ? new Date() : null,
      due_date: '2026-11-30',
    });
  }

  const [empCount, permCount] = await Promise.all([
    Employee.count({ where: { tenant_id: tenantId, employment_status: { [Op.eq]: 'ACTIVE' } } }),
    Permission.count(),
  ]);
  // eslint-disable-next-line no-console
  console.log(`Seed complete (${dialectName}): ${permCount} permissions, ${roles.size} roles, tenant "${tenant.name}", ${empCount} employees.`);
  // eslint-disable-next-line no-console
  console.log(`Login with any seeded user (password ${PASSWORD}): ${people.map((p) => p.email).join(', ')}`);
  await sequelize.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
