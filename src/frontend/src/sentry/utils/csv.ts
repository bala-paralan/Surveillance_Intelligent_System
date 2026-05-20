/**
 * Tiny CSV download helper for in-memory tables.
 * Quotes fields containing commas/quotes/newlines per RFC 4180.
 */

const escapeField = (value: unknown): string => {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export interface CsvColumn<Row> {
  header: string;
  value:  (row: Row) => unknown;
}

export const buildCsv = <Row>(rows: ReadonlyArray<Row>, columns: ReadonlyArray<CsvColumn<Row>>): string => {
  const header = columns.map((c) => escapeField(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => escapeField(c.value(row))).join(',')).join('\n');
  return `${header}\n${body}\n`;
};

export const downloadCsv = (filename: string, csv: string): void => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const timestampForFilename = (): string => {
  const d = new Date();
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};
