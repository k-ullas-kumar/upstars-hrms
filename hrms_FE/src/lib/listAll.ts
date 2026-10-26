import { api, type QueryParams } from './api';
import { asRec, str } from './normalize';

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

/**
 * Fetches every page of a list endpoint (the API caps `limit` at 100) and maps each record.
 * Stops when a page is short, when the server ignores `page` (repeated first row), or after MAX_PAGES.
 */
export async function listAll<T>(
  path: string,
  map: (raw: unknown) => T,
  params: QueryParams = {},
  signal?: AbortSignal,
): Promise<T[]> {
  const collected: unknown[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const batch = await api.list<unknown>(path, { ...params, page, limit: PAGE_SIZE }, signal);
    const firstId = batch.length > 0 ? str(asRec(batch[0]), 'id') : undefined;
    if (page > 1 && firstId && seen.has(firstId)) break;

    let added = 0;
    batch.forEach((item) => {
      const id = str(asRec(item), 'id');
      if (id) {
        if (seen.has(id)) return;
        seen.add(id);
      }
      collected.push(item);
      added += 1;
    });
    if (batch.length < PAGE_SIZE || added === 0) break;
  }
  return collected.map(map);
}
