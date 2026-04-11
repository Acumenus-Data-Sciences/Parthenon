import type { TableProfile, ColumnProfile, ScanResult } from "../api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const HISTORY_KEY = "parthenon:source-profiler:history";
export const MAX_HISTORY = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScanHistoryEntry {
  id: string;
  sourceName: string;
  sourceId: number;
  scannedAt: string;
  tableCount: number;
  totalRows: number;
  totalColumns: number;
  scanTimeSeconds: number;
  overallScore: string;
  result: ScanResult;
}

export type SortField = "name" | "rows" | "columns" | "nullScore" | "grade";
export type SortDir = "asc" | "desc";
export type ViewMode = "list" | "heatmap";

export interface GradeInfo {
  letter: string;
  color: string;
  bg: string;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function fmtNumberFull(n: number): string {
  return n.toLocaleString();
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

export function nullPct(col: ColumnProfile): number {
  return Math.round(col.fraction_empty * 100);
}

export function tableNullScore(table: TableProfile): number {
  if (table.columns.length === 0) return 0;
  return (
    table.columns.reduce((sum, c) => sum + c.fraction_empty, 0) /
    table.columns.length
  );
}

export function scoreToGrade(score: number): GradeInfo {
  if (score <= 0.05) return { letter: "A", color: "var(--success)", bg: "rgba(45,212,191,0.12)" };
  if (score <= 0.15) return { letter: "B", color: "var(--info)", bg: "rgba(96,165,250,0.12)" };
  if (score <= 0.30) return { letter: "C", color: "var(--accent)", bg: "rgba(201,162,39,0.12)" };
  if (score <= 0.50) return { letter: "D", color: "#FB923C", bg: "rgba(251,146,60,0.12)" };
  return { letter: "F", color: "var(--critical)", bg: "rgba(232,90,107,0.12)" };
}

export function overallGrade(tables: TableProfile[]): GradeInfo {
  if (tables.length === 0) return scoreToGrade(0);
  const avg = tables.reduce((s, t) => s + tableNullScore(t), 0) / tables.length;
  return scoreToGrade(avg);
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Scan history persistence
// ---------------------------------------------------------------------------

export function loadHistory(): ScanHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScanHistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistory(entries: ScanHistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

export function exportJson(result: ScanResult, sourceName: string): void {
  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scan-${sourceName}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCsv(result: ScanResult, sourceName: string): void {
  const rows: string[] = [
    "table_name,column_name,type,row_count,null_pct,unique_count,grade",
  ];
  for (const table of result.tables) {
    for (const col of table.columns) {
      const grade = scoreToGrade(col.fraction_empty);
      rows.push(
        [
          table.table_name,
          col.name,
          col.type,
          table.row_count,
          Math.round(col.fraction_empty * 100),
          col.unique_count,
          grade.letter,
        ].join(","),
      );
    }
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scan-${sourceName}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
