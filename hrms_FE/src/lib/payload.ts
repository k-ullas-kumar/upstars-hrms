import { toSnake } from './normalize';

/**
 * The API is snake_case at the data layer but its auth payload is camelCase, so write bodies are
 * sent with BOTH spellings of each top-level key (servers that validate with default, non-strict
 * schemas simply ignore the spelling they do not know). Set to 'snake' or 'camel' to be exact.
 */
export type PayloadCase = 'both' | 'snake' | 'camel';
export const PAYLOAD_CASE: PayloadCase = 'snake';

/**
 * Builds a request body from camelCase form values. Drops `undefined` and empty strings
 * (so optional inputs left blank are not sent); `null` is kept to allow explicit clearing.
 */
export function toPayload(values: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    if (PAYLOAD_CASE === 'camel' || PAYLOAD_CASE === 'both') body[key] = value;
    if (PAYLOAD_CASE === 'snake' || PAYLOAD_CASE === 'both') body[toSnake(key)] = value;
  });
  return body;
}
