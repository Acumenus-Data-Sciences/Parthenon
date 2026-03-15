import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Database,
  ScanSearch,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Download,
  Users,
  Activity,
  Rows3,
  Columns3,
  RefreshCw,
  GitMerge,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import {
  useScanDatabase,
  useGenerateSynthea,
  useWhiteRabbitHealth,
  useSyntheaStatus,
  type TableProfile,
  type ColumnProfile,
  type ScanResult,
  type SyntheaGenerateResult,
} from "../api";
import FhirIngestionPanel from "../components/FhirIngestionPanel";

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function fmtNumber(n: number): string {
  return n.toLocaleString();
}

function nullPct(col: ColumnProfile): number {
  return Math.round(col.fraction_empty * 100);
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
          "text-xs tabular-nums",
          isHigh ? "text-[#E85A6B]" : "text-[#8A857D]",
        )}
      >
        {pct}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sample values chip list (top-5)
// ---------------------------------------------------------------------------

function SampleValues({ values }: { values?: Record<string, number> }) {
  if (!values) return <span className="text-[#5A5650] text-xs">—</span>;
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
          {v.length > 20 ? v.slice(0, 20) + "…" : v}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible table accordion row
// ---------------------------------------------------------------------------

function TableAccordion({ table }: { table: TableProfile }) {
  const [open, setOpen] = useState(false);
  const highNullCols = table.columns.filter((c) => c.fraction_empty > 0.5);
  const lowCardCols = table.columns.filter(
    (c) => c.unique_count < 5 && c.n_rows > 100,
  );

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      {/* Accordion header */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#1C1C20] transition-colors"
      >
        <span className="text-[#8A857D]">
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
        <span className="flex-1 text-sm font-medium text-[#F0EDE8] font-mono">
          {table.table_name}
        </span>
        <span className="flex items-center gap-3 text-xs text-[#8A857D]">
          <span className="flex items-center gap-1">
            <Rows3 size={12} />
            {fmtNumber(table.row_count)} rows
          </span>
          <span className="flex items-center gap-1">
            <Columns3 size={12} />
            {table.column_count} cols
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

      {/* Column detail table */}
      {open && (
        <div className="border-t border-[#232328] overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#1C1C20]">
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Column
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Type
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Null %
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Distinct
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Sample Values
                </th>
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
                          <AlertTriangle size={11} className="text-[#E85A6B] shrink-0" />
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
                      {fmtNumber(col.unique_count)}
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
// Source Profiler tab
// ---------------------------------------------------------------------------

function SourceProfilerTab() {
  const [selectedSourceId, setSelectedSourceId] = useState<number | "">("");
  const [tableFilter, setTableFilter] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);

  const { data: sources = [] } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const { data: health } = useWhiteRabbitHealth();
  const scanMutation = useScanDatabase();

  function handleScan() {
    if (!selectedSourceId) return;
    const tables = tableFilter
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    scanMutation.mutate(
      { source_id: Number(selectedSourceId), tables: tables.length ? tables : undefined },
      { onSuccess: (data) => setResult(data) },
    );
  }

  function handleExport() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scan-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalCols = result?.tables.reduce((s, t) => s + t.column_count, 0) ?? 0;
  const totalRows = result?.tables.reduce((s, t) => s + t.row_count, 0) ?? 0;
  const flaggedTables = result?.tables.filter((t) =>
    t.columns.some((c) => c.fraction_empty > 0.5),
  );

  return (
    <div className="space-y-5">
      {/* Service health indicator */}
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
          {health.available ? "available" : "unavailable — scan may fail"}{" "}
          {health.version ? `(v${health.version})` : ""}
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
            Data Source
          </label>
          <select
            value={selectedSourceId}
            onChange={(e) =>
              setSelectedSourceId(e.target.value ? Number(e.target.value) : "")
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

        <div className="space-y-1.5 md:col-span-2">
          <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
            Table Filter{" "}
            <span className="normal-case font-normal text-[#5A5650]">
              (optional — comma-separated)
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

      <div className="flex items-center gap-3">
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
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2E2E35] bg-[#1C1C20] px-4 py-2.5 text-sm text-[#C5C0B8] hover:bg-[#232328] transition-colors"
          >
            <Download size={15} />
            Export Report
          </button>
        )}
      </div>

      {/* Loading state */}
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

      {/* Error state */}
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

      {/* Results */}
      {result && !scanMutation.isPending && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Tables Scanned",
                value: fmtNumber(result.tables.length),
                color: "#2DD4BF",
              },
              {
                label: "Total Columns",
                value: fmtNumber(totalCols),
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

          {/* DQ flags */}
          {flaggedTables && flaggedTables.length > 0 && (
            <div className="rounded-lg bg-[rgba(201,162,39,0.06)] border border-[rgba(201,162,39,0.15)] px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-[#C9A227]" />
                <span className="text-sm font-medium text-[#C9A227]">
                  Data Quality Flags
                </span>
              </div>
              <ul className="space-y-0.5">
                {flaggedTables.map((t) => {
                  const highNull = t.columns.filter(
                    (c) => c.fraction_empty > 0.5,
                  );
                  return (
                    <li key={t.table_name} className="text-xs text-[#8A857D]">
                      <span className="font-mono text-[#C5C0B8]">
                        {t.table_name}
                      </span>{" "}
                      — {highNull.length} column
                      {highNull.length !== 1 ? "s" : ""} with &gt;50% nulls:{" "}
                      <span className="font-mono">
                        {highNull.map((c) => c.name).join(", ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Table accordion list */}
          <div className="space-y-2">
            {result.tables.map((table) => (
              <TableAccordion key={table.table_name} table={table} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !scanMutation.isPending && !scanMutation.isError && (
        <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-[#2E2E35] bg-[#151518]">
          <div className="w-14 h-14 rounded-full bg-[#1C1C20] flex items-center justify-center mb-4">
            <ScanSearch size={24} className="text-[#8A857D]" />
          </div>
          <h3 className="text-[#F0EDE8] font-semibold">No scan results yet</h3>
          <p className="text-sm text-[#8A857D] mt-1">
            Select a source and click "Scan Database" to profile your data.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Synthea Generator tab
// ---------------------------------------------------------------------------

function SyntheaGeneratorTab() {
  const [selectedSourceId, setSelectedSourceId] = useState<number | "">("");
  const [patientCount, setPatientCount] = useState(1000);
  const [csvFolder, setCsvFolder] = useState("");
  const [cdmVersion, setCdmVersion] = useState("5.4");
  const [result, setResult] = useState<SyntheaGenerateResult | null>(null);

  const { data: sources = [] } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const { data: status } = useSyntheaStatus();
  const generateMutation = useGenerateSynthea();

  function handleGenerate() {
    if (!selectedSourceId || !csvFolder.trim()) return;
    generateMutation.mutate(
      {
        source_id: Number(selectedSourceId),
        patient_count: patientCount,
        synthea_csv_folder: csvFolder.trim(),
        cdm_version: cdmVersion,
      },
      { onSuccess: (data) => setResult(data) },
    );
  }

  const tableEntries = result
    ? Object.entries(result.summary.tables).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="space-y-5">
      {/* Service status */}
      {status !== undefined && (
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
            status.available
              ? "bg-[rgba(45,212,191,0.08)] text-[#2DD4BF]"
              : "bg-[rgba(232,90,107,0.08)] text-[#E85A6B]",
          )}
        >
          {status.available ? (
            <CheckCircle2 size={13} />
          ) : (
            <AlertTriangle size={13} />
          )}
          Synthea ETL service{" "}
          {status.available ? `available (${status.version})` : "unavailable"}
          {status.capabilities?.length > 0 && status.available && (
            <span className="ml-2 text-[#5A5650]">
              Capabilities: {status.capabilities.join(", ")}
            </span>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
            Target Source
          </label>
          <select
            value={selectedSourceId}
            onChange={(e) =>
              setSelectedSourceId(e.target.value ? Number(e.target.value) : "")
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

        {/* Patient count */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
            Patient Count
          </label>
          <input
            type="number"
            value={patientCount}
            onChange={(e) =>
              setPatientCount(Math.min(100_000, Math.max(1, Number(e.target.value))))
            }
            min={1}
            max={100_000}
            className="w-full rounded-lg bg-[#1C1C20] border border-[#2E2E35] px-3 py-2 text-sm text-[#F0EDE8] focus:outline-none focus:border-[#9B1B30]"
          />
          <p className="text-[11px] text-[#5A5650]">Min 1 — Max 100,000</p>
        </div>

        {/* CSV folder */}
        <div className="space-y-1.5 md:col-span-2">
          <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
            Synthea CSV Output Folder
          </label>
          <input
            type="text"
            value={csvFolder}
            onChange={(e) => setCsvFolder(e.target.value)}
            placeholder="/data/synthea/output/csv"
            className="w-full rounded-lg bg-[#1C1C20] border border-[#2E2E35] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none focus:border-[#9B1B30]"
          />
          <p className="text-[11px] text-[#5A5650]">
            Absolute path accessible by the R runtime container. The Synthea
            CSV files (patients.csv, encounters.csv, etc.) must exist at this
            path before running ETL.
          </p>
        </div>

        {/* CDM version */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
            CDM Version
          </label>
          <select
            value={cdmVersion}
            onChange={(e) => setCdmVersion(e.target.value)}
            className="w-full rounded-lg bg-[#1C1C20] border border-[#2E2E35] px-3 py-2 text-sm text-[#F0EDE8] focus:outline-none focus:border-[#9B1B30]"
          >
            <option value="5.4">OMOP CDM 5.4</option>
            <option value="5.3">OMOP CDM 5.3</option>
          </select>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!selectedSourceId || !csvFolder.trim() || generateMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-5 py-2.5 text-sm font-medium text-[#F0EDE8] hover:bg-[#B82D42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw size={15} />
              Generate
            </>
          )}
        </button>
      </div>

      {/* Loading state */}
      {generateMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-[#2E2E35] bg-[#151518]">
          <Loader2 size={32} className="animate-spin text-[#9B1B30] mb-4" />
          <p className="text-sm text-[#C5C0B8] font-medium">
            Generating synthetic data...
          </p>
          <p className="text-xs text-[#8A857D] mt-1">
            Loading Synthea CSVs into OMOP CDM. Please wait.
          </p>
        </div>
      )}

      {/* Error state */}
      {generateMutation.isError && (
        <div className="flex items-start gap-3 rounded-lg bg-[rgba(232,90,107,0.08)] border border-[rgba(232,90,107,0.2)] px-4 py-3">
          <AlertTriangle size={16} className="text-[#E85A6B] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#E85A6B]">Generation failed</p>
            <p className="text-xs text-[#8A857D] mt-0.5">
              {(generateMutation.error as Error)?.message ?? "Unknown error"}
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !generateMutation.isPending && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[rgba(45,212,191,0.12)] flex items-center justify-center">
                <Users size={20} className="text-[#2DD4BF]" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#8A857D]">
                  Persons Generated
                </p>
                <p className="text-2xl font-bold text-[#2DD4BF] tabular-nums mt-0.5">
                  {fmtNumber(result.summary.person_count)}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[rgba(96,165,250,0.12)] flex items-center justify-center">
                <Rows3 size={20} className="text-[#60A5FA]" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#8A857D]">
                  Total Rows Inserted
                </p>
                <p className="text-2xl font-bold text-[#60A5FA] tabular-nums mt-0.5">
                  {fmtNumber(result.summary.total_rows)}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[rgba(201,162,39,0.12)] flex items-center justify-center">
                <Activity size={20} className="text-[#C9A227]" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#8A857D]">
                  Elapsed Time
                </p>
                <p className="text-2xl font-bold text-[#C9A227] tabular-nums mt-0.5">
                  {result.elapsed_seconds.toFixed(1)}s
                </p>
              </div>
            </div>
          </div>

          {/* Per-table breakdown */}
          {tableEntries.length > 0 && (
            <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
              <div className="px-4 py-3 bg-[#1C1C20] border-b border-[#232328]">
                <h4 className="text-sm font-medium text-[#F0EDE8]">
                  Per-Table Row Counts
                </h4>
              </div>
              <div className="divide-y divide-[#1C1C20]">
                {tableEntries.map(([tableName, rowCount]) => {
                  const maxCount = tableEntries[0][1];
                  const pct = maxCount > 0 ? (rowCount / maxCount) * 100 : 0;
                  return (
                    <div
                      key={tableName}
                      className="flex items-center gap-4 px-4 py-2.5"
                    >
                      <span className="w-44 shrink-0 font-mono text-xs text-[#C5C0B8]">
                        {tableName}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-[#232328] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#9B1B30]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-20 text-right tabular-nums text-xs text-[#8A857D]">
                        {fmtNumber(rowCount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !generateMutation.isPending && !generateMutation.isError && (
        <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-[#2E2E35] bg-[#151518]">
          <div className="w-14 h-14 rounded-full bg-[#1C1C20] flex items-center justify-center mb-4">
            <RefreshCw size={24} className="text-[#8A857D]" />
          </div>
          <h3 className="text-[#F0EDE8] font-semibold">
            Ready to generate synthetic data
          </h3>
          <p className="text-sm text-[#8A857D] mt-1 text-center max-w-md">
            Configure the options above and click Generate to load Synthea CSV
            data into your OMOP CDM source.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page — tabs
// ---------------------------------------------------------------------------

type Tab = "profiler" | "synthea" | "fhir";

export default function EtlToolsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profiler");

  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "profiler", label: "Source Profiler", icon: ScanSearch },
    { id: "synthea", label: "Synthea Generator", icon: RefreshCw },
    { id: "fhir", label: "FHIR Ingestion", icon: GitMerge },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">ETL Tools</h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Profile source databases with WhiteRabbit, generate synthetic OMOP
            data with Synthea, or ingest FHIR resources directly into the CDM
          </p>
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[rgba(155,27,48,0.12)]">
          <Database size={20} className="text-[#9B1B30]" />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[#232328]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-[#9B1B30] text-[#F0EDE8]"
                  : "border-transparent text-[#8A857D] hover:text-[#C5C0B8]",
              )}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "profiler" && <SourceProfilerTab />}
        {activeTab === "synthea" && <SyntheaGeneratorTab />}
        {activeTab === "fhir" && <FhirIngestionPanel />}
      </div>
    </div>
  );
}
