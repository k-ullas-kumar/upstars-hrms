import Papa from 'papaparse';

/** Neutralise spreadsheet formula injection (=, +, -, @, tab, CR at start of a cell). */
export function sanitizeCsvCell(value: unknown): unknown {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const data = rows.map((row) => columns.map((c) => sanitizeCsvCell(row[c] ?? '')));
  return Papa.unparse({ fields: columns, data });
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[]; errors: string[] } {
  const result = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'),
    transform: (v) => (typeof v === 'string' ? v.trim() : v),
  });
  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
    errors: result.errors.map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`),
  };
}
