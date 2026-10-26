import type { Employee, LeaveType, OrgEntity, Ref } from '../types';
import { api } from './api';
import { listAll } from './listAll';
import { normEmployee, normLeaveType, normOrg } from './normalize';
import { useApi } from './useApi';

export interface Lookups {
  departments: OrgEntity[];
  designations: OrgEntity[];
  branches: OrgEntity[];
  employees: Employee[];
  leaveTypes: LeaveType[];
}

export type LookupKey = keyof Lookups;

const ALL_KEYS: LookupKey[] = ['departments', 'designations', 'branches', 'employees', 'leaveTypes'];

/** Display name for a ref, falling back to a lookup list when the API only returned an id. */
export function refName(item: Ref | null | undefined, list?: Ref[]): string {
  if (!item) return '—';
  if (item.name) return item.name;
  return list?.find((candidate) => candidate.id === item.id)?.name || '—';
}

/** Loads reference data used by forms and filters. Individual failures degrade to empty lists. */
export function useLookups(wanted: LookupKey[] = ALL_KEYS, enabled = true) {
  return useApi<Lookups>(
    async (signal) => {
      const want = (key: LookupKey) => wanted.includes(key);
      const quiet = <T>(promise: Promise<T[]>) => promise.catch((): T[] => []);
      const [departments, designations, branches, employees, leaveTypes] = await Promise.all([
        want('departments') ? quiet(api.list('/departments', { limit: 100 }, signal).then((l) => l.map(normOrg))) : [],
        want('designations') ? quiet(api.list('/designations', { limit: 100 }, signal).then((l) => l.map(normOrg))) : [],
        want('branches') ? quiet(api.list('/branches', { limit: 100 }, signal).then((l) => l.map(normOrg))) : [],
        want('employees') ? quiet(listAll('/employees', normEmployee, {}, signal)) : [],
        want('leaveTypes') ? quiet(api.list('/leave-types', { limit: 100 }, signal).then((l) => l.map(normLeaveType))) : [],
      ]);
      return { departments, designations, branches, employees, leaveTypes };
    },
    [wanted.join(',')],
    enabled,
  );
}

export const EMPTY_LOOKUPS: Lookups = {
  departments: [],
  designations: [],
  branches: [],
  employees: [],
  leaveTypes: [],
};
