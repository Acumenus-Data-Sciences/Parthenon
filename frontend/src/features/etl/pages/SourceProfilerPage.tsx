import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScanSearch,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Download,
  Rows3,
  Columns3,
  Activity,
  Trash2,
  Clock,
  ArrowUpDown,
  Search,
  Database,
  Shield,
  X,
  Info,
  BarChart3,
  Grid3X3,
  List,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import {
  useScanDatabase,
  useWhiteRabbitHealth,
  type TableProfile,
  type ColumnProfile,
  type ScanResult,
} from "../api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HISTORY_KEY = "parthenon:source-profiler:history";
const MAX_HISTORY = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScanHistoryEntry {
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

type SortField = "name" | "rows" | "columns" | "nullScore" | "grade";
type SortDir = "asc" | "desc";
type ViewMode = "list" | "heatmap";

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtNumberFull(n: number): string {
  return n.toLocaleString();
}

function nullPct(col: ColumnProfile): number {
  return Math.round(col.fraction_empty * 100);
}

function tableNullScore(table: TableProfile): number {
  if (table.columns.length === 0) return 0;
  return (
    table.columns.reduce((sum, c) => sum + c.fraction_empty, 0) /
    table.columns.length
  );
}

function scoreToGrade(score: number): { letter: string; color: string; bg: string } {
  if (score <= 0.05) return { letter: "A", color: "#2DD4BF", bg: "rgba(45,212,191,0.12)" };
  if (score <= 0.15) return { letter: "B", color: "#60A5FA", bg: "rgba(96,165,250,0.12)" };
  if (score <= 0.30) return { letter: "C", color: "#C9A227", bg: "rgba(201,162,39,0.12)" };
  if (score <= 0.50) return { letter: "D", color: "#FB923C", bg: "rgba(251,146,60,0.12)" };
  return { letter: "F", color: "#E85A6B", bg: "rgba(232,90,107,0.12)" };
}

function overallGrade(tables: TableProfile[]): { letter: string; color: string; bg: string } {
  if (tables.length === 0) return scoreToGrade(0);
  const avg = tables.reduce((s, t) => s + tableNullScore(t), 0) / tables.length;
  return scoreToGrade(avg);
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Scan history persistence
// ---------------------------------------------------------------------------

function loadHistory(): ScanHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScanHistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(entries: ScanHistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

// ---------------------------------------------------------------------------
// Column type badge
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  varchar: { bg: "rgba(96,165,250,0.15)", text: "#60A5FA" },
  text: { bg: "rgba(96,165,250,0.15)", text: "#60A5FA" },
  integer: { bg: "rgba(45,212,191,0.15)", text: "#2DD4BF" },
  int: { bg: "rgba(45,212,191,0.15)", text: "#2DD4BF" },
  bigint: { bg: "rgba(45,212,191,0.15)", text: "#2DD4BF" },
  numeric: { bg: "rgba(201,162,39,0.15)", text: "#C9A227" },
  float: { bg: "rgba(201,162,39,0.15)", text: "#C9A227" },
  double: { bg: "rgba(201,162,39,0.15)", text: "#C9A227" },
  decimal: { bg: "rgba(201,162,39,0.15)", text: "#C9A227" },
  date: { bg: "rgba(167,139,250,0.15)", text: "#A78BFA" },
  datetime: { bg: "rgba(167,139,250,0.15)", text: "#A78BFA" },
  timestamp: { bg: "rgba(167,139,250,0.15)", text: "#A78BFA" },
  boolean: { bg: "rgba(251,146,60,0.15)", text: "#FB923C" },
  bool: { bg: "rgba(251,146,60,0.15)", text: "#FB923C" },
};

function TypeBadge({ type }: { type: string }) {
  const lc = type.toLowerCase().replace(/\s*\(.*\)/, "");
  const colors = TYPE_COLORS[lc] ?? { bg: "#2A2A30", text: "#8A857D" };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-medium"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Null-percent bar
// ---------------------------------------------------------------------------

function NullBar({ pct }: { pct: number }) {
  const isHigh = pct > 50;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-[#232328] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: isHigh ? "#E85A6B" : pct > 20 ? "#C9A227" : "#2DD4BF",
          }}
        />
      </div>
      <span
        className={cn(
          "text-xs tabular-nums w-8 text-right",
          isHigh ? "text-[#E85A6B]" : "text-[#8A857D]",
        )}
      >
        {pct}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sample values chips
// ---------------------------------------------------------------------------

function SampleValues({ values }: { values?: Record<string, number> }) {
  if (!values) return <span className="text-[#5A5650] text-xs">-</span>;
  const entries = Object.entries(values)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([v, cnt]) => (
        <span
          key={v}
          className="inline-block px-1.5 py-0.5 rounded bg-[#232328] text-[#8A857D] text-[11px]"
          title={`Count: ${cnt}`}
        >
          {v.length > 20 ? v.slice(0, 20) + "\u2026" : v}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grade badge component
// ---------------------------------------------------------------------------

function GradeBadge({ score }: { score: number }) {
  const grade = scoreToGrade(score);
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold"
      style={{ backgroundColor: grade.bg, color: grade.color }}
    >
      {grade.letter}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Completeness Heatmap
// ---------------------------------------------------------------------------

function CompletenessHeatmap({ tables }: { tables: TableProfile[] }) {
  // Collect all unique column names across tables
  const allColumns = useMemo(() => {
    const colSet = new Set<string>();
    tables.forEach((t) => t.columns.forEach((c) => colSet.add(c.name)));
    return Array.from(colSet).sort();
  }, [tables]);

  const [hoveredCell, setHoveredCell] = useState<{
    table: string;
    column: string;
    pct: number;
  } | null>(null);

  if (tables.length === 0 || allColumns.length === 0) return null;

  // Limit columns for readability
  const maxCols = 30;
  const displayCols = allColumns.slice(0, maxCols);
  const truncated = allColumns.length > maxCols;

  function cellColor(fraction: number | undefined): string {
    if (fraction === undefined) return "#1C1C20"; // column not in this table
    if (fraction <= 0.01) return "rgba(45,212,191,0.35)";
    if (fraction <= 0.10) return "rgba(45,212,191,0.2)";
    if (fraction <= 0.25) return "rgba(201,162,39,0.2)";
    if (fraction <= 0.50) return "rgba(201,162,39,0.35)";
    return "rgba(232,90,107,0.35)";
  }

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <div className="px-4 py-3 bg-[#1C1C20] border-b border-[#232328] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3X3 size={15} className="text-[#8A857D]" />
          <h4 className="text-sm font-medium text-[#F0EDE8]">
            Completeness Heatmap
          </h4>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[#8A857D]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "rgba(45,212,191,0.35)" }} />
            &lt;1%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "rgba(201,162,39,0.2)" }} />
            10-25%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "rgba(232,90,107,0.35)" }} />
            &gt;50%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "#1C1C20" }} />
            N/A
          </span>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCell && (
        <div className="px-4 py-2 bg-[#1A1A1E] border-b border-[#232328] text-xs text-[#C5C0B8]">
          <span className="font-mono text-[#F0EDE8]">{hoveredCell.table}</span>
          {" \u2192 "}
          <span className="font-mono text-[#F0EDE8]">{hoveredCell.column}</span>
          {" \u2014 "}
          <span
            className="font-semibold"
            style={{
              color:
                hoveredCell.pct > 50
                  ? "#E85A6B"
                  : hoveredCell.pct > 20
                    ? "#C9A227"
                    : "#2DD4BF",
            }}
          >
            {hoveredCell.pct}% null
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="text-[10px]" style={{ borderCollapse: "separate", borderSpacing: 1 }}>
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left text-[#8A857D] font-medium sticky left-0 bg-[#151518] z-10 min-w-[120px]">
                Table
              </th>
              {displayCols.map((col) => (
                <th
                  key={col}
                  className="px-0.5 py-1.5 text-[#5A5650] font-normal"
                  style={{ writingMode: "vertical-rl", maxWidth: 18, height: 80 }}
                  title={col}
                >
                  {col.length > 15 ? col.slice(0, 14) + "\u2026" : col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tables.map((table) => {
              const colMap = new Map(table.columns.map((c) => [c.name, c.fraction_empty]));
              return (
                <tr key={table.table_name}>
                  <td className="px-2 py-0.5 font-mono text-[#C5C0B8] sticky left-0 bg-[#151518] z-10 whitespace-nowrap">
                    {table.table_name}
                  </td>
                  {displayCols.map((col) => {
                    const fraction = colMap.get(col);
                    return (
                      <td
                        key={col}
                        className="px-0 py-0 cursor-crosshair"
                        style={{ backgroundColor: cellColor(fraction), minWidth: 16, height: 16 }}
                        onMouseEnter={() =>
                          setHoveredCell({
                            table: table.table_name,
                            column: col,
                            pct: fraction !== undefined ? Math.round(fraction * 100) : -1,
                          })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {truncated && (
        <div className="px-4 py-2 text-[11px] text-[#5A5650] border-t border-[#232328]">
          Showing {maxCols} of {allColumns.length} columns. Export full report for complete view.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data Quality Scorecard
// ---------------------------------------------------------------------------

function DataQualityScorecard({ tables }: { tables: TableProfile[] }) {
  const stats = useMemo(() => {
    const totalCols = tables.reduce((s, t) => s + t.columns.length, 0);
    const highNullCols = tables.reduce(
      (s, t) => s + t.columns.filter((c) => c.fraction_empty > 0.5).length,
      0,
    );
    const emptyCols = tables.reduce(
      (s, t) => s + t.columns.filter((c) => c.fraction_empty >= 0.99).length,
      0,
    );
    const lowCardCols = tables.reduce(
      (s, t) =>
        s + t.columns.filter((c) => c.unique_count < 5 && c.n_rows > 100).length,
      0,
    );
    const singleValueCols = tables.reduce(
      (s, t) =>
        s + t.columns.filter((c) => c.unique_count === 1 && c.n_rows > 0).length,
      0,
    );
    const emptyTables = tables.filter((t) => t.row_count === 0).length;

    return {
      totalCols,
      highNullCols,
      emptyCols,
      lowCardCols,
      singleValueCols,
      emptyTables,
    };
  }, [tables]);

  const grade = overallGrade(tables);

  const checks = [
    {
      label: "High-null columns (>50%)",
      count: stats.highNullCols,
      total: stats.totalCols,
      severity: stats.highNullCols > 0 ? "warn" : "ok",
    },
    {
      label: "Nearly-empty columns (>99%)",
      count: stats.emptyCols,
      total: stats.totalCols,
      severity: stats.emptyCols > 0 ? "error" : "ok",
    },
    {
      label: "Low cardinality (<5 distinct)",
      count: stats.lowCardCols,
      total: stats.totalCols,
      severity: stats.lowCardCols > 3 ? "info" : "ok",
    },
    {
      label: "Single-value columns",
      count: stats.singleValueCols,
      total: stats.totalCols,
      severity: stats.singleValueCols > 0 ? "warn" : "ok",
    },
    {
      label: "Empty tables (0 rows)",
      count: stats.emptyTables,
      total: tables.length,
      severity: stats.emptyTables > 0 ? "error" : "ok",
    },
  ];

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <div className="px-4 py-3 bg-[#1C1C20] border-b border-[#232328] flex items-center gap-2">
        <Shield size={15} className="text-[#8A857D]" />
        <h4 className="text-sm font-medium text-[#F0EDE8]">Data Quality Scorecard</h4>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold"
            style={{ backgroundColor: grade.bg, color: grade.color }}
          >
            {grade.letter}
          </div>
          <div>
            <p className="text-sm font-medium text-[#F0EDE8]">Overall Data Completeness</p>
            <p className="text-xs text-[#8A857D] mt-0.5">
              Based on average null fraction across {fmtNumberFull(stats.totalCols)} columns in{" "}
              {tables.length} tables
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {checks.map((check) => (
            <div
              key={check.label}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#1C1C20]"
            >
              <div className="flex items-center gap-2">
                {check.severity === "ok" && (
                  <CheckCircle2 size={14} className="text-[#2DD4BF]" />
                )}
                {check.severity === "warn" && (
                  <AlertTriangle size={14} className="text-[#C9A227]" />
                )}
                {check.severity === "error" && (
                  <AlertTriangle size={14} className="text-[#E85A6B]" />
                )}
                {check.severity === "info" && (
                  <Info size={14} className="text-[#60A5FA]" />
                )}
                <span className="text-xs text-[#C5C0B8]">{check.label}</span>
              </div>
              <span
                className={cn(
                  "text-xs font-mono tabular-nums",
                  check.severity === "ok"
                    ? "text-[#2DD4BF]"
                    : check.severity === "error"
                      ? "text-[#E85A6B]"
                      : check.severity === "warn"
                        ? "text-[#C9A227]"
                        : "text-[#60A5FA]",
                )}
              >
                {check.count}/{check.total}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table size distribution chart
// ---------------------------------------------------------------------------

function TableSizeChart({ tables }: { tables: TableProfile[] }) {
  const sorted = useMemo(
    () => [...tables].sort((a, b) => b.row_count - a.row_count).slice(0, 20),
    [tables],
  );
  const maxRows = sorted[0]?.row_count ?? 1;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <div className="px-4 py-3 bg-[#1C1C20] border-b border-[#232328] flex items-center gap-2">
        <BarChart3 size={15} className="text-[#8A857D]" />
        <h4 className="text-sm font-medium text-[#F0EDE8]">
          Table Size Distribution
          {tables.length > 20 && (
            <span className="font-normal text-[#5A5650] ml-1">(top 20)</span>
          )}
        </h4>
      </div>
      <div className="divide-y divide-[#1C1C20]">
        {sorted.map((table) => {
          const pct = maxRows > 0 ? (table.row_count / maxRows) * 100 : 0;
          const grade = scoreToGrade(tableNullScore(table));
          return (
            <div
              key={table.table_name}
              className="flex items-center gap-3 px-4 py-2"
            >
              <span
                className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ backgroundColor: grade.bg, color: grade.color }}
              >
                {grade.letter}
              </span>
              <span className="w-40 shrink-0 font-mono text-xs text-[#C5C0B8] truncate">
                {table.table_name}
              </span>
              <div className="flex-1 h-2 rounded-full bg-[#232328] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(pct, 1)}%`,
                    backgroundColor: "#9B1B30",
                  }}
                />
              </div>
              <span className="w-20 text-right tabular-nums text-xs text-[#8A857D]">
                {fmtNumber(table.row_count)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible table accordion row
// ---------------------------------------------------------------------------

function TableAccordion({
  table,
  defaultOpen,
}: {
  table: TableProfile;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const highNullCols = table.columns.filter((c) => c.fraction_empty > 0.5);
  const lowCardCols = table.columns.filter(
    (c) => c.unique_count < 5 && c.n_rows > 100,
  );
  const grade = scoreToGrade(tableNullScore(table));

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#1C1C20] transition-colors"
      >
        <span className="text-[#8A857D]">
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
        <span
          className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ backgroundColor: grade.bg, color: grade.color }}
        >
          {grade.letter}
        </span>
        <span className="flex-1 text-sm font-medium text-[#F0EDE8] font-mono">
          {table.table_name}
        </span>
        <span className="flex items-center gap-3 text-xs text-[#8A857D]">
          <span className="flex items-center gap-1">
            <Rows3 size={12} />
            {fmtNumber(table.row_count)}
          </span>
          <span className="flex items-center gap-1">
            <Columns3 size={12} />
            {table.column_count}
          </span>
          {highNullCols.length > 0 && (
            <span className="flex items-center gap-1 text-[#C9A227]">
              <AlertTriangle size={12} />
              {highNullCols.length} high-null
            </span>
          )}
          {lowCardCols.length > 0 && (
            <span className="flex items-center gap-1 text-[#60A5FA]">
              <Activity size={12} />
              {lowCardCols.length} low-card
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-[#232328] overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#1C1C20]">
                {["Column", "Type", "Null %", "Distinct", "Sample Values"].map(
                  (header) => (
                    <th
                      key={header}
                      className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]"
                    >
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col, i) => {
                const isHighNull = col.fraction_empty > 0.5;
                return (
                  <tr
                    key={col.name}
                    className={cn(
                      "border-t border-[#1C1C20]",
                      i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
                      isHighNull && "bg-[rgba(232,90,107,0.04)]",
                    )}
                  >
                    <td className="px-4 py-2.5 font-mono text-[#C5C0B8]">
                      <div className="flex items-center gap-1.5">
                        {isHighNull && (
                          <AlertTriangle
                            size={11}
                            className="text-[#E85A6B] shrink-0"
                          />
                        )}
                        {col.name}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <TypeBadge type={col.type} />
                    </td>
                    <td className="px-4 py-2.5">
                      <NullBar pct={nullPct(col)} />
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-[#8A857D]">
                      {fmtNumberFull(col.unique_count)}
                    </td>
                    <td className="px-4 py-2.5">
                      <SampleValues values={col.values} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scan History sidebar
// ---------------------------------------------------------------------------

function ScanHistorySidebar({
  history,
  onSelect,
  onDelete,
  onClear,
  selectedId,
}: {
  history: ScanHistoryEntry[];
  onSelect: (entry: ScanHistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  selectedId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);

  if (history.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-[#1C1C20] border-b border-[#232328] text-left"
      >
        <Clock size={14} className="text-[#8A857D]" />
        <span className="flex-1 text-sm font-medium text-[#F0EDE8]">
          Scan History
        </span>
        <span className="text-[11px] text-[#5A5650]">{history.length}</span>
        {expanded ? (
          <ChevronUp size={14} className="text-[#8A857D]" />
        ) : (
          <ChevronDown size={14} className="text-[#8A857D]" />
        )}
      </button>

      {expanded && (
        <div className="max-h-[400px] overflow-y-auto">
          {history.map((entry) => {
            const grade = scoreToGrade(
              entry.result.tables.length > 0
                ? entry.result.tables.reduce((s, t) => s + tableNullScore(t), 0) /
                    entry.result.tables.length
                : 0,
            );
            return (
              <div
                key={entry.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 border-b border-[#1C1C20] cursor-pointer hover:bg-[#1C1C20] transition-colors",
                  selectedId === entry.id && "bg-[#1C1C20] border-l-2 border-l-[#9B1B30]",
                )}
                onClick={() => onSelect(entry)}
              >
                <span
                  className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: grade.bg, color: grade.color }}
                >
                  {grade.letter}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#F0EDE8] truncate">
                    {entry.sourceName}
                  </p>
                  <p className="text-[10px] text-[#5A5650]">
                    {new Date(entry.scannedAt).toLocaleString()} -{" "}
                    {entry.tableCount} tables
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(entry.id);
                  }}
                  className="p-1 rounded hover:bg-[#2E2E35] text-[#5A5650] hover:text-[#E85A6B] transition-colors"
                  title="Delete scan"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
          <div className="px-4 py-2 border-t border-[#232328]">
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] text-[#5A5650] hover:text-[#E85A6B] transition-colors"
            >
              Clear all history
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

function exportJson(result: ScanResult, sourceName: string) {
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

function exportCsv(result: ScanResult, sourceName: string) {
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

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function SourceProfilerPage() {
  // ── State ──────────────────────────────────────────────────────────
  const [selectedSourceId, setSelectedSourceId] = useState<number | "">("");
  const [tableFilter, setTableFilter] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [resultSourceName, setResultSourceName] = useState("");
  const [history, setHistory] = useState<ScanHistoryEntry[]>(loadHistory);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sampleRows, setSampleRows] = useState(10000);
  const scanStartRef = useRef<number>(0);

  // ── Queries ────────────────────────────────────────────────────────
  const { data: sources = [] } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const { data: health } = useWhiteRabbitHealth();
  const scanMutation = useScanDatabase();

  // ── Derived data ───────────────────────────────────────────────────
  const selectedSource = sources.find((s) => s.id === selectedSourceId);

  const filteredTables = useMemo(() => {
    if (!result) return [];
    let tables = result.tables;

    if (tableSearch) {
      const lc = tableSearch.toLowerCase();
      tables = tables.filter((t) => t.table_name.toLowerCase().includes(lc));
    }

    const sorted = [...tables].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.table_name.localeCompare(b.table_name);
          break;
        case "rows":
          cmp = a.row_count - b.row_count;
          break;
        case "columns":
          cmp = a.column_count - b.column_count;
          break;
        case "nullScore":
          cmp = tableNullScore(a) - tableNullScore(b);
          break;
        case "grade":
          cmp = tableNullScore(a) - tableNullScore(b);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [result, tableSearch, sortField, sortDir]);

  const totalCols = result?.tables.reduce((s, t) => s + t.column_count, 0) ?? 0;
  const totalRows = result?.tables.reduce((s, t) => s + t.row_count, 0) ?? 0;

  // ── Handlers ───────────────────────────────────────────────────────
  const handleScan = useCallback(() => {
    if (!selectedSourceId) return;
    const tables = tableFilter
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    scanStartRef.current = Date.now();

    scanMutation.mutate(
      {
        source_id: Number(selectedSourceId),
        tables: tables.length ? tables : undefined,
      },
      {
        onSuccess: (data) => {
          setResult(data);
          setSelectedHistoryId(null);
          setTableSearch("");

          const srcName = selectedSource?.source_name ?? `Source ${selectedSourceId}`;
          setResultSourceName(srcName);

          // Save to history
          const entry: ScanHistoryEntry = {
            id: generateId(),
            sourceName: srcName,
            sourceId: Number(selectedSourceId),
            scannedAt: new Date().toISOString(),
            tableCount: data.tables.length,
            totalRows: data.tables.reduce((s, t) => s + t.row_count, 0),
            totalColumns: data.tables.reduce((s, t) => s + t.column_count, 0),
            scanTimeSeconds: data.scan_time_seconds,
            overallScore: overallGrade(data.tables).letter,
            result: data,
          };
          const updated = [entry, ...history].slice(0, MAX_HISTORY);
          setHistory(updated);
          saveHistory(updated);
        },
      },
    );
  }, [selectedSourceId, tableFilter, selectedSource, history, scanMutation]);

  const handleHistorySelect = useCallback((entry: ScanHistoryEntry) => {
    setResult(entry.result);
    setResultSourceName(entry.sourceName);
    setSelectedHistoryId(entry.id);
    setTableSearch("");
  }, []);

  const handleHistoryDelete = useCallback(
    (id: string) => {
      const updated = history.filter((h) => h.id !== id);
      setHistory(updated);
      saveHistory(updated);
      if (selectedHistoryId === id) {
        setResult(null);
        setSelectedHistoryId(null);
      }
    },
    [history, selectedHistoryId],
  );

  const handleHistoryClear = useCallback(() => {
    setHistory([]);
    saveHistory([]);
    if (selectedHistoryId) {
      setResult(null);
      setSelectedHistoryId(null);
    }
  }, [selectedHistoryId]);

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField],
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">Source Profiler</h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Profile source databases with WhiteRabbit to assess data completeness,
            cardinality, and quality before ETL
          </p>
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[rgba(155,27,48,0.12)]">
          <ScanSearch size={20} className="text-[#9B1B30]" />
        </div>
      </div>

      {/* Service health */}
      {health !== undefined && (
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
            health.available
              ? "bg-[rgba(45,212,191,0.08)] text-[#2DD4BF]"
              : "bg-[rgba(232,90,107,0.08)] text-[#E85A6B]",
          )}
        >
          {health.available ? (
            <CheckCircle2 size={13} />
          ) : (
            <AlertTriangle size={13} />
          )}
          WhiteRabbit service{" "}
          {health.available ? "available" : "unavailable \u2014 scan may fail"}{" "}
          {health.version ? `(v${health.version})` : ""}
        </div>
      )}

      {/* ── Two-column layout: config + history ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: scan config */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border border-[#232328] bg-[#151518] p-5 space-y-4">
            <h3 className="text-sm font-medium text-[#F0EDE8] flex items-center gap-2">
              <Database size={15} className="text-[#8A857D]" />
              Scan Configuration
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
                  Data Source
                </label>
                <select
                  value={selectedSourceId}
                  onChange={(e) =>
                    setSelectedSourceId(
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                  className="w-full rounded-lg bg-[#1C1C20] border border-[#2E2E35] px-3 py-2 text-sm text-[#F0EDE8] focus:outline-none focus:border-[#9B1B30]"
                >
                  <option value="">Select a source...</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.source_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
                  Table Filter{" "}
                  <span className="normal-case font-normal text-[#5A5650]">
                    (comma-separated)
                  </span>
                </label>
                <input
                  type="text"
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  placeholder="e.g. person, visit_occurrence, condition_occurrence"
                  className="w-full rounded-lg bg-[#1C1C20] border border-[#2E2E35] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none focus:border-[#9B1B30]"
                />
              </div>
            </div>

            {/* Advanced options */}
            <button
              type="button"
              onClick={() => setShowAdvanced((p) => !p)}
              className="flex items-center gap-1.5 text-xs text-[#5A5650] hover:text-[#8A857D] transition-colors"
            >
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Advanced options
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-[#232328]">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
                    Sample Rows per Table
                  </label>
                  <input
                    type="number"
                    value={sampleRows}
                    onChange={(e) =>
                      setSampleRows(
                        Math.max(100, Math.min(1_000_000, Number(e.target.value))),
                      )
                    }
                    min={100}
                    max={1_000_000}
                    className="w-full rounded-lg bg-[#1C1C20] border border-[#2E2E35] px-3 py-2 text-sm text-[#F0EDE8] focus:outline-none focus:border-[#9B1B30]"
                  />
                  <p className="text-[11px] text-[#5A5650]">
                    Limits row sampling for large tables. Default: 10,000.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleScan}
                disabled={!selectedSourceId || scanMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-5 py-2.5 text-sm font-medium text-[#F0EDE8] hover:bg-[#B82D42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scanMutation.isPending ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <ScanSearch size={15} />
                    Scan Database
                  </>
                )}
              </button>

              {result && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportJson(result, resultSourceName)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#2E2E35] bg-[#1C1C20] px-3 py-2.5 text-xs text-[#C5C0B8] hover:bg-[#232328] transition-colors"
                  >
                    <Download size={13} />
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCsv(result, resultSourceName)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#2E2E35] bg-[#1C1C20] px-3 py-2.5 text-xs text-[#C5C0B8] hover:bg-[#232328] transition-colors"
                  >
                    <Download size={13} />
                    CSV
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: scan history */}
        <div>
          <ScanHistorySidebar
            history={history}
            onSelect={handleHistorySelect}
            onDelete={handleHistoryDelete}
            onClear={handleHistoryClear}
            selectedId={selectedHistoryId}
          />
        </div>
      </div>

      {/* ── Loading state ──────────────────────────────────────────── */}
      {scanMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-[#2E2E35] bg-[#151518]">
          <Loader2 size={32} className="animate-spin text-[#9B1B30] mb-4" />
          <p className="text-sm text-[#C5C0B8] font-medium">
            Scanning database...
          </p>
          <p className="text-xs text-[#8A857D] mt-1">
            This may take several minutes for large databases.
          </p>
        </div>
      )}

      {/* ── Error state ────────────────────────────────────────────── */}
      {scanMutation.isError && (
        <div className="flex items-start gap-3 rounded-lg bg-[rgba(232,90,107,0.08)] border border-[rgba(232,90,107,0.2)] px-4 py-3">
          <AlertTriangle size={16} className="text-[#E85A6B] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#E85A6B]">Scan failed</p>
            <p className="text-xs text-[#8A857D] mt-0.5">
              {(scanMutation.error as Error)?.message ?? "Unknown error"}
            </p>
          </div>
        </div>
      )}

      {/* ── Results Dashboard ──────────────────────────────────────── */}
      {result && !scanMutation.isPending && (
        <div className="space-y-6">
          {/* Source name + timestamp header */}
          {resultSourceName && (
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-[#F0EDE8]">
                {resultSourceName}
              </h2>
              {selectedHistoryId && (
                <span className="text-xs text-[#5A5650] flex items-center gap-1">
                  <Clock size={11} />
                  {new Date(
                    history.find((h) => h.id === selectedHistoryId)?.scannedAt ?? "",
                  ).toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* Summary metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              {
                label: "Tables",
                value: fmtNumberFull(result.tables.length),
                color: "#2DD4BF",
              },
              {
                label: "Columns",
                value: fmtNumberFull(totalCols),
                color: "#60A5FA",
              },
              {
                label: "Total Rows",
                value: fmtNumber(totalRows),
                color: "#C9A227",
              },
              {
                label: "Scan Time",
                value: `${result.scan_time_seconds.toFixed(1)}s`,
                color: "#A78BFA",
              },
              {
                label: "Grade",
                value: overallGrade(result.tables).letter,
                color: overallGrade(result.tables).color,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3"
              >
                <p className="text-[11px] uppercase tracking-wider text-[#8A857D]">
                  {stat.label}
                </p>
                <p
                  className="text-2xl font-bold mt-1 tabular-nums"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Scorecard + size chart row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DataQualityScorecard tables={result.tables} />
            <TableSizeChart tables={result.tables} />
          </div>

          {/* Heatmap */}
          {result.tables.length > 1 && (
            <CompletenessHeatmap tables={result.tables} />
          )}

          {/* ── Table list section ─────────────────────────────────── */}
          <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
                />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Search tables..."
                  className="w-full rounded-lg bg-[#1C1C20] border border-[#2E2E35] pl-9 pr-8 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none focus:border-[#9B1B30]"
                />
                {tableSearch && (
                  <button
                    type="button"
                    onClick={() => setTableSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5A5650] hover:text-[#C5C0B8]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Sort controls */}
              <div className="flex items-center gap-1.5 text-xs text-[#8A857D]">
                <ArrowUpDown size={13} />
                {(
                  [
                    ["name", "Name"],
                    ["rows", "Rows"],
                    ["columns", "Cols"],
                    ["grade", "Grade"],
                  ] as [SortField, string][]
                ).map(([field, label]) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => toggleSort(field)}
                    className={cn(
                      "px-2 py-1 rounded text-[11px] transition-colors",
                      sortField === field
                        ? "bg-[#9B1B30]/20 text-[#F0EDE8]"
                        : "bg-[#1C1C20] text-[#5A5650] hover:text-[#8A857D]",
                    )}
                  >
                    {label}
                    {sortField === field && (sortDir === "asc" ? " \u2191" : " \u2193")}
                  </button>
                ))}
              </div>

              {/* View mode toggle */}
              <div className="flex items-center gap-1 bg-[#1C1C20] rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    viewMode === "list"
                      ? "bg-[#9B1B30]/20 text-[#F0EDE8]"
                      : "text-[#5A5650] hover:text-[#8A857D]",
                  )}
                  title="List view"
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("heatmap")}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    viewMode === "heatmap"
                      ? "bg-[#9B1B30]/20 text-[#F0EDE8]"
                      : "text-[#5A5650] hover:text-[#8A857D]",
                  )}
                  title="Compact view"
                >
                  <Grid3X3 size={14} />
                </button>
              </div>

              <span className="text-[11px] text-[#5A5650]">
                {filteredTables.length}
                {tableSearch ? ` / ${result.tables.length}` : ""} tables
              </span>
            </div>

            {/* Table list or compact view */}
            {viewMode === "list" ? (
              <div className="space-y-2">
                {filteredTables.map((table) => (
                  <TableAccordion key={table.table_name} table={table} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {filteredTables.map((table) => {
                  const score = tableNullScore(table);
                  const grade = scoreToGrade(score);
                  const highNullCount = table.columns.filter(
                    (c) => c.fraction_empty > 0.5,
                  ).length;

                  return (
                    <div
                      key={table.table_name}
                      className="rounded-lg border border-[#232328] bg-[#151518] p-3 hover:bg-[#1C1C20] transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <GradeBadge score={score} />
                        <span className="font-mono text-xs text-[#F0EDE8] truncate flex-1">
                          {table.table_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-[#8A857D]">
                        <span>{fmtNumber(table.row_count)} rows</span>
                        <span>{table.column_count} cols</span>
                        {highNullCount > 0 && (
                          <span className="text-[#C9A227]">
                            {highNullCount} high-null
                          </span>
                        )}
                      </div>
                      {/* Mini completeness bar */}
                      <div className="mt-2 h-1 rounded-full bg-[#232328] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max((1 - score) * 100, 2)}%`,
                            backgroundColor: grade.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* No results from search */}
            {filteredTables.length === 0 && tableSearch && (
              <div className="text-center py-8 text-sm text-[#8A857D]">
                No tables matching &quot;{tableSearch}&quot;
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────── */}
      {!result && !scanMutation.isPending && !scanMutation.isError && (
        <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed border-[#2E2E35] bg-[#151518]">
          <div className="w-16 h-16 rounded-full bg-[#1C1C20] flex items-center justify-center mb-4">
            <ScanSearch size={28} className="text-[#8A857D]" />
          </div>
          <h3 className="text-[#F0EDE8] font-semibold text-lg">
            No scan results yet
          </h3>
          <p className="text-sm text-[#8A857D] mt-1 text-center max-w-md">
            Select a data source and click &quot;Scan Database&quot; to profile your
            source data. Results include column completeness, cardinality, value
            distributions, and data quality grades.
          </p>
          {history.length > 0 && (
            <p className="text-xs text-[#5A5650] mt-3">
              Or select a previous scan from the history panel.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
