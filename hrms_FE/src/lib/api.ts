/**
 * Thin fetch wrapper for the HRMS backend.
 * - Default base is `/api/v1` (Vite proxies `/api` in dev; nginx proxies in Docker).
 * - Optional `VITE_API_BASE` (e.g. https://api.example.com) for split-host deploys.
 * - Bearer token is read from localStorage key `hrms_token`.
 * - Responses shaped `{ success, data }` are unwrapped.
 */

export const TOKEN_KEY = 'hrms_token';
export const UNAUTHORIZED_EVENT = 'hrms:unauthorized';
const API_ORIGIN = String(import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const API_BASE = `${API_ORIGIN}/api/v1`;

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => localStorage.removeItem(TOKEN_KEY),
};

type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

interface RequestOptions {
  params?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
  skipAuthRedirect?: boolean;
}

function buildUrl(path: string, params?: QueryParams): string {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!params) return url;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload)) {
    const error = payload.error;
    if (typeof error === 'string') return error;
    if (isRecord(error) && typeof error.message === 'string') return error.message;
    if (typeof payload.message === 'string') return payload.message;
  }
  return fallback;
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.params), {
      method,
      headers,
      body,
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  const payload = await parseBody(res);

  if (!res.ok) {
    if (res.status === 401 && !options.skipAuthRedirect) {
      tokenStore.clear();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(extractMessage(payload, res.statusText || 'Request failed'), res.status, payload);
  }

  if (isRecord(payload) && 'success' in payload && 'data' in payload) {
    return payload.data as T;
  }
  return payload as T;
}

function toArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (isRecord(data)) {
    for (const key of ['items', 'results', 'rows', 'data']) {
      const candidate = data[key];
      if (Array.isArray(candidate)) return candidate as T[];
    }
  }
  return [];
}

function filenameFromHeader(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

export const api = {
  get: <T>(path: string, params?: QueryParams, signal?: AbortSignal) =>
    request<T>('GET', path, { params, signal }),

  /** GET that always resolves to an array (supports `{items}`, `{results}`, `{rows}` envelopes). */
  list: async <T>(path: string, params?: QueryParams, signal?: AbortSignal): Promise<T[]> =>
    toArray<T>(await request<unknown>('GET', path, { params, signal })),

  post: <T>(path: string, body?: unknown, options?: Pick<RequestOptions, 'skipAuthRedirect'>) =>
    request<T>('POST', path, { body: body ?? {}, ...options }),

  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body: body ?? {} }),

  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body: body ?? {} }),

  delete: <T = void>(path: string) => request<T>('DELETE', path),

  /** Fetches a file with auth and triggers a browser download. */
  download: async (path: string, params?: QueryParams, fallbackName = 'download'): Promise<void> => {
    const headers: Record<string, string> = {};
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(buildUrl(path, params), { headers });
    } catch {
      throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
    }
    if (!res.ok) {
      if (res.status === 401) {
        tokenStore.clear();
        window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      }
      const payload = await parseBody(res);
      throw new ApiError(extractMessage(payload, 'Download failed'), res.status, payload);
    }
    const blob = await res.blob();
    const name = filenameFromHeader(res.headers.get('content-disposition'), fallbackName);
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  },
};

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}
