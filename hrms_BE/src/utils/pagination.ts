export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PageParams {
  page: number;
  limit: number;
  offset: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function parsePagination(query: Record<string, unknown>, maxLimit = MAX_LIMIT): PageParams {
  const page = toPositiveInt(query.page, 1);
  const limit = Math.min(toPositiveInt(query.limit, DEFAULT_LIMIT), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

export function buildPagination(total: number, params: PageParams): Pagination {
  return {
    page: params.page,
    limit: params.limit,
    total,
    total_pages: Math.max(1, Math.ceil(total / params.limit)),
  };
}
