import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScanSearch,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Download,
  ArrowUpDown,
  Search,
  Database,
  X,
  Grid3X3,
  List,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useWhiteRabbitHealth, type ScanResult } from "../api";
import type { ProfileSummary, PersistedFieldProfile } from "../api";
import { CdmContextPanel } from "../components/CdmContextPanel";
import ScanProgressIndicator from "../components/ScanProgressIndicator";
import { useProfileHistory, useRunScanWithProgress, useDeleteProfile, useComparison } from "../hooks/useProfilerData";
import { fetchProfile } from "../api";
import {
  fmtNumber,
  fmtNumberFull,
  overallGrade,
  scoreToGrade,
  tableNullScore,
  exportJson,
  exportCsv,
  HISTORY_KEY,
  type SortField,
  type SortDir,
  type ViewMode,
} from "../lib/profiler-utils";
import { GradeBadge } from "../components/profiler-badges";
import { CompletenessHeatmap } from "../components/CompletenessHeatmap";
import { DataQualityScorecard } from "../components/DataQualityScorecard";
import { TableSizeChart } from "../components/TableSizeChart";
import { FkRelationshipGraph } from "../components/FkRelationshipGraph";
import { TableAccordion } from "../components/TableAccordion";
import { ScanHistorySidebar } from "../components/ScanHistorySidebar";
import ComparisonSummary from "../components/ComparisonSummary";
import ComparisonDiff from "../components/ComparisonDiff";


// ---------------------------------------------------------------------------
// Transform persisted field data into the ScanResult shape used by rendering
// ---------------------------------------------------------------------------

function transformPersistedToScanResult(
  fields: PersistedFieldProfile[],
  summary: ProfileSummary,
): ScanResult {
  const tableMap = new Map<
    string,
    {
      columns: Array<{
        name: string;
        type: string;
        n_rows: number;
        fraction_empty: number;
        unique_count: number;
        values?: Record<string, number>;
        is_potential_pii?: boolean;
        pii_type?: string | null;
      }>;
      row_count: number;
    }
  >();

  for (const f of fields) {
    if (!tableMap.has(f.table_name)) {
      tableMap.set(f.table_name, { columns: [], row_count: f.row_count });
    }
    tableMap.get(f.table_name)!.columns.push({
      name: f.column_name,
      type: f.inferred_type,
      n_rows: f.row_count,
      fraction_empty: f.null_percentage / 100,
      unique_count: f.distinct_count,
      values: f.sample_values ?? undefined,
      is_potential_pii: f.is_potential_pii,
      pii_type: f.pii_type,
    });
  }

  const tables = Array.from(tableMap.entries()).map(([table_name, data]) => ({
    table_name,
    row_count: data.row_count,
    column_count: data.columns.length,
    columns: data.columns,
  }));

  return {
    status: "ok",
    tables,
    scan_time_seconds: summary.scan_time_seconds,
  };
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function SourceProfilerPage() {
  // -- State ----------------------------------------------------------------
  const [selectedSourceId, setSelectedSourceId] = useState<number | "">("");
  const [tableFilter, setTableFilter] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [resultSourceName, setResultSourceName] = useState("");
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sampleRows, setSampleRows] = useState(10000);

  const [compareMode, setCompareMode] = useState(false);
  const [compareCurrentId, setCompareCurrentId] = useState<number>(0);
  const [compareBaselineId, setCompareBaselineId] = useState<number>(0);
  const [comparisonFilter, setComparisonFilter] = useState<string | null>(null);

  // -- Clear stale localStorage on mount --
  useEffect(() => {
    localStorage.removeItem(HISTORY_KEY);
  }, []);

  // -- Queries --------------------------------------------------------------
  const { data: sources = [] } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const sourceIdNum = Number(selectedSourceId) || 0;
  const { data: health } = useWhiteRabbitHealth();
  const { data: profileHistoryData } = useProfileHistory(sourceIdNum);
  const profileHistory: ProfileSummary[] = profileHistoryData?.data ?? [];
  const { startScan, cancel: cancelScan, progress: scanProgress, error: scanError } = useRunScanWithProgress(sourceIdNum);
  const deleteMutation = useDeleteProfile(sourceIdNum);
  const comparison = useComparison(sourceIdNum, compareCurrentId, compareBaselineId);

  // -- Derived data ---------------------------------------------------------
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
  const piiColumnCount = useMemo(
    () =>
      result?.tables.reduce(
        (s, t) => s + t.columns.filter((c) => c.is_potential_pii === true).length,
        0,
      ) ?? 0,
    [result],
  );

  const graphFields = useMemo(() => {
    if (!result) return [];
    return result.tables.flatMap((t) =>
      t.columns.map((c) => ({
        table_name: t.table_name,
        column_name: c.name,
        inferred_type: c.type,
        row_count: t.row_count,
      }))
    );
  }, [result]);

  // -- Handlers -------------------------------------------------------------
  const handleScan = useCallback(() => {
    if (!selectedSourceId) return;
    const tables = tableFilter
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    startScan({
      tables: tables.length ? tables : undefined,
      sample_rows: sampleRows !== 10000 ? sampleRows : undefined,
    });
  }, [selectedSourceId, tableFilter, sampleRows, startScan]);

  const handleHistorySelect = useCallback(
    async (profile: ProfileSummary) => {
      setTableSearch("");
      const srcName = selectedSource?.source_name ?? `Source ${selectedSourceId}`;
      setResultSourceName(srcName);
      setSelectedHistoryId(profile.id);

      try {
        const detail = await fetchProfile(sourceIdNum, profile.id);
        const scanResult = transformPersistedToScanResult(detail.fields, profile);
        setResult(scanResult);
      } catch {
        setResult({
          status: "ok",
          tables: [],
          scan_time_seconds: profile.scan_time_seconds,
        });
      }
    },
    [selectedSource, selectedSourceId, sourceIdNum],
  );

  const handleHistoryDelete = useCallback(
    (profileId: number) => {
      deleteMutation.mutate(profileId);
      if (selectedHistoryId === profileId) {
        setResult(null);
        setSelectedHistoryId(null);
      }
    },
    [selectedHistoryId, deleteMutation],
  );

  const handleCompare = useCallback((currentId: number, baselineId: number) => {
    setCompareCurrentId(currentId);
    setCompareBaselineId(baselineId);
    setCompareMode(true);
    setComparisonFilter(null);
  }, []);

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

  // -- Render ---------------------------------------------------------------
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

      {/* CDM Context Panel */}
      {selectedSourceId && Number(selectedSourceId) > 0 && (
        <CdmContextPanel sourceId={Number(selectedSourceId)} />
      )}

      {/* -- Two-column layout: config + history -- */}
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
                disabled={!selectedSourceId || scanProgress.isScanning}
                className="inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-5 py-2.5 text-sm font-medium text-[#F0EDE8] hover:bg-[#B82D42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scanProgress.isScanning ? (
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
            profiles={profileHistory}
            onSelect={handleHistorySelect}
            onDelete={handleHistoryDelete}
            onCompare={handleCompare}
            selectedId={selectedHistoryId}
          />
        </div>
      </div>

      {/* -- Loading state -- */}
      <ScanProgressIndicator
        progress={scanProgress}
        onCancel={cancelScan}
      />

      {/* -- Error state -- */}
      {scanError && (
        <div className="flex items-start gap-3 rounded-lg bg-[rgba(232,90,107,0.08)] border border-[rgba(232,90,107,0.2)] px-4 py-3">
          <AlertTriangle size={16} className="text-[#E85A6B] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#E85A6B]">Scan failed</p>
            <p className="text-xs text-[#8A857D] mt-0.5">
              {scanError}
            </p>
          </div>
        </div>
      )}

      {/* -- Comparison View -- */}
      {compareMode && comparison.data && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Scan Comparison</h2>
            <button
              onClick={() => setCompareMode(false)}
              className="text-sm text-gray-400 hover:text-white"
            >
              &larr; Back to results
            </button>
          </div>
          <ComparisonSummary
            data={comparison.data}
            activeFilter={comparisonFilter}
            onFilterChange={setComparisonFilter}
          />
          <ComparisonDiff
            data={comparison.data}
            activeFilter={comparisonFilter}
          />
        </div>
      )}

      {/* -- Results Dashboard -- */}
      {result && !scanProgress.isScanning && !compareMode && (
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
                    profileHistory.find((h) => h.id === selectedHistoryId)?.created_at ?? "",
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
            <DataQualityScorecard tables={result.tables} piiColumnCount={piiColumnCount} />
            <TableSizeChart tables={result.tables} />
          </div>

          {/* Heatmap */}
          {result.tables.length > 1 && (
            <CompletenessHeatmap tables={result.tables} />
          )}

          {/* FK Relationship Graph */}
          {graphFields.length > 0 && (
            <FkRelationshipGraph
              fields={graphFields}
              onTableClick={(tableName) => {
                setTableSearch(tableName);
              }}
            />
          )}

          {/* -- Table list section -- */}
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

      {/* -- Empty state -- */}
      {!result && !scanProgress.isScanning && !scanError && (
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
          {profileHistory.length > 0 && (
            <p className="text-xs text-[#5A5650] mt-3">
              Or select a previous scan from the history panel.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
