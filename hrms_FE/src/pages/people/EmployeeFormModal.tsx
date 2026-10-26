import { FormModal } from '../../components/ui/FormModal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { api } from '../../lib/api';
import { toPayload } from '../../lib/payload';
import { required, useForm } from '../../lib/useForm';
import type { Lookups } from '../../lib/useLookups';
import type { Employee } from '../../types';

interface EmployeeFormModalProps {
  /** Existing employee for edit mode; omit to create. */
  employee?: Employee | null;
  lookups: Lookups;
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'EXITED', label: 'Exited' },
];

const toOptions = (items: { id: string; name: string }[]) =>
  items.map((item) => ({ value: item.id, label: item.name }));

/** Mount only while open so the form initialises from the current employee. */
export function EmployeeFormModal({ employee, lookups, onClose, onSaved }: EmployeeFormModalProps) {
  const editing = Boolean(employee);
  const form = useForm({
    fullName: employee?.name ?? '',
    employeeNumber: employee?.employeeNumber ?? '',
    workEmail: employee?.workEmail ?? '',
    phone: employee?.phone ?? '',
    joiningDate: employee?.joiningDate?.slice(0, 10) ?? '',
    departmentId: employee?.department?.id ?? '',
    designationId: employee?.designation?.id ?? '',
    branchId: employee?.branch?.id ?? '',
    managerEmployeeId: employee?.manager?.id ?? '',
    employmentStatus: employee?.employmentStatus?.toUpperCase() ?? 'ACTIVE',
  });

  const onSubmit = () =>
    form.submit({
      validate: (values) => {
        const errors = required(
          ['fullName', 'Full name'],
          ['workEmail', 'Work email'],
          ['joiningDate', 'Joining date'],
        )(values);
        if (!errors.workEmail && !/^\S+@\S+\.\S+$/.test(values.workEmail.trim())) {
          errors.workEmail = 'Enter a valid email address';
        }
        return errors;
      },
      action: (values) => {
        const body = toPayload({
          fullName: values.fullName.trim(),
          name: values.fullName.trim(),
          employeeNumber: values.employeeNumber.trim(),
          workEmail: values.workEmail.trim(),
          phone: values.phone.trim(),
          joiningDate: values.joiningDate,
          departmentId: values.departmentId,
          designationId: values.designationId,
          branchId: values.branchId,
          managerEmployeeId: values.managerEmployeeId,
          employmentStatus: editing ? values.employmentStatus : undefined,
        });
        return employee ? api.patch(`/employees/${employee.id}`, body) : api.post('/employees', body);
      },
      success: editing ? 'Employee updated' : 'Employee created',
      onDone: () => {
        onSaved();
        onClose();
      },
    });

  const managers = lookups.employees.filter((candidate) => candidate.id !== employee?.id);

  return (
    <FormModal
      open
      size="lg"
      title={editing ? 'Edit employee' : 'Add employee'}
      description={editing ? employee?.name : 'Create a new employee record.'}
      submitLabel={editing ? 'Save changes' : 'Create employee'}
      submitting={form.submitting}
      error={form.formError}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Full name" required autoFocus {...form.bind('fullName')} />
        <Input
          label="Employee ID"
          hint={editing ? undefined : 'Leave blank to auto-generate.'}
          {...form.bind('employeeNumber')}
        />
        <Input label="Work email" type="email" required {...form.bind('workEmail')} />
        <Input label="Phone" type="tel" {...form.bind('phone')} />
        <Input label="Joining date" type="date" required {...form.bind('joiningDate')} />
        {editing && <Select label="Status" options={STATUS_OPTIONS} {...form.bind('employmentStatus')} />}
        <Select label="Department" placeholder="Select department" options={toOptions(lookups.departments)} {...form.bind('departmentId')} />
        <Select label="Designation" placeholder="Select designation" options={toOptions(lookups.designations)} {...form.bind('designationId')} />
        <Select label="Branch" placeholder="Select branch" options={toOptions(lookups.branches)} {...form.bind('branchId')} />
        <Select label="Manager" placeholder="No manager" options={toOptions(managers)} {...form.bind('managerEmployeeId')} />
      </div>
    </FormModal>
  );
}
