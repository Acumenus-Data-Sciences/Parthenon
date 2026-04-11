// frontend/src/features/morpheus/components/ExportButton.tsx
import { Download } from 'lucide-react';

interface ExportButtonProps {
  data: Record<string, unknown>[];
  filename: string;
  headers?: string[];
}

/** Sanitize a cell value to prevent CSV injection (HIGHSEC requirement). */
function sanitizeCell(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str)) return `'${str}`;
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function ExportButton({ data, filename, headers }: ExportButtonProps) {
  const handleExport = () => {
    if (data.length === 0) return;
    const cols = headers ?? Object.keys(data[0]);
    const rows = data.map((row) => cols.map((col) => sanitizeCell(row[col])).join(','));
    const csv = [cols.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={data.length === 0}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-zinc-800 hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-success/30"
    >
      <Download size={12} />
      Export CSV
    </button>
  );
}
