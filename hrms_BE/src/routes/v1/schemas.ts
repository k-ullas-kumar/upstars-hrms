import { z } from 'zod';
import { isIsoDate } from '../../utils/leave';

export const uuid = z.string().uuid();
export const isoDate = z.string().refine(isIsoDate, 'Must be a valid date in YYYY-MM-DD format');
export const optionalText = (max = 2000) => z.string().trim().max(max).nullish();
export const idParams = z.object({ id: uuid });

/** Express params/query values are strings; this keeps them typed as plain records. */
export const queryRecord = (q: unknown): Record<string, unknown> => (q ?? {}) as Record<string, unknown>;

export const decisionBody = z
  .object({
    note: z.string().trim().max(1000).nullish(),
    decision_note: z.string().trim().max(1000).nullish(),
  })
  .transform((v) => ({ note: v.note ?? v.decision_note ?? null }))
  .default({});
