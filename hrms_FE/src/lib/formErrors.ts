import { ApiError } from './api';
import { asRec, isRec, toCamel } from './normalize';

export type FieldErrors = Record<string, string>;

function messageOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value.find((item): item is string => typeof item === 'string');
    return first;
  }
  if (isRec(value) && typeof value.message === 'string') return value.message;
  return undefined;
}

/** Pulls per-field validation messages out of an API error body (zod / express-validator / map styles). */
export function fieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiError)) return {};
  const body = asRec(error.details);
  const errorObj = asRec(body.error);
  const candidates = [errorObj.details, errorObj.errors, body.details, body.errors, errorObj.fields, body.fields];
  const result: FieldErrors = {};

  candidates.forEach((candidate) => {
    if (Array.isArray(candidate)) {
      candidate.forEach((entry) => {
        const e = asRec(entry);
        const rawPath = e.path ?? e.field ?? e.param;
        const path = Array.isArray(rawPath) ? String(rawPath[rawPath.length - 1] ?? '') : String(rawPath ?? '');
        const message = messageOf(e);
        const key = toCamel(path.split('.').pop() ?? '');
        if (key && message && !result[key]) result[key] = message;
      });
    } else if (isRec(candidate)) {
      Object.entries(candidate).forEach(([key, value]) => {
        const message = messageOf(value);
        const camel = toCamel(key);
        if (message && !result[camel]) result[camel] = message;
      });
    }
  });
  return result;
}
