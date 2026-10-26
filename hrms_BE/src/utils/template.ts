/** Pure `{{placeholder}}` rendering for document templates. */

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

export function extractPlaceholders(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(PLACEHOLDER)) found.add(match[1]);
  return [...found];
}

function resolvePath(context: Record<string, unknown>, path: string): unknown {
  let current: unknown = context;
  for (const part of path.split('.')) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

export function resolveValue(context: Record<string, unknown>, path: string): string | undefined {
  const value = resolvePath(context, path);
  return isBlank(value) ? undefined : String(value);
}

export interface RenderResult {
  text: string;
  missing: string[];
}

/** Renders a template. Unresolved placeholders are reported in `missing` and rendered as empty strings. */
export function renderTemplate(body: string, context: Record<string, unknown>): RenderResult {
  const missing = new Set<string>();
  const text = body.replace(PLACEHOLDER, (_m, key: string) => {
    const value = resolveValue(context, key);
    if (value === undefined) {
      missing.add(key);
      return '';
    }
    return value;
  });
  return { text, missing: [...missing] };
}
