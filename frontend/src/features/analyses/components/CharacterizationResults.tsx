import { useState, useMemo } from "react";
import { Loader2, Download, AlertCircle, Users, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/formatters";
import { FeatureComparisonTable } from "./FeatureComparisonTable";
import { CharacterizationVerdictDashboard } from "./CharacterizationVerdictDashboard";
import { LovePlot } from "@/features/estimation/components/LovePlot";
import type { CovariateBalanceEntry } from "@/features/estimation/types/estimation";
import type {
  AnalysisExecution,
  FeatureType,
  CharacterizationResult,
  FeatureResult,
  DirectRunResult,
  AggregateCovariateRow,
} from "../types/analysis";

const FEATURE_TYPE_LABELS: Record<FeatureType, string> = {
  demographics: "Demographics",
  conditions: "Conditions",
  drugs: "Drugs",
  procedures: "Procedures",
  measurements: "Measurements",
  visits: "Visits",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CharacterizationResultsProps {
  execution?: AnalysisExecution | null;
  directResult?: DirectRunResult | null;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers for queue-based execution results
// ---------------------------------------------------------------------------

function parseResults(
  execution: AnalysisExecution | null | undefined,
): CharacterizationResult[] {
  if (!execution?.result_json) return [];
  const json = execution.result_json;
  if (Array.isArray(json)) return json as CharacterizationResult[];
  if (typeof json === "object" && "results" in json) {
    return (json as { results: CharacterizationResult[] }).results;
  }
  return [];
}

function getAvailableFeatureTypes(
  results: CharacterizationResult[],
): FeatureType[] {
  const types = new Set<FeatureType>();
  for (const r of results) {
    if (r.features) {
      for (const key of Object.keys(r.features)) {
        const features = r.features[key as FeatureType];
        if (features && features.length > 0) {
          types.add(key as FeatureType);
        }
      }
    }
  }
  return Array.from(types);
}

function computeSmdFromFeatures(
  targetFeatures: FeatureResult[],
  comparatorFeatures: FeatureResult[],
): CovariateBalanceEntry[] {
  const comparatorMap = new Map<string, FeatureResult>();
  for (const f of comparatorFeatures) {
    comparatorMap.set(f.feature_name, f);
  }

  const entries: CovariateBalanceEntry[] = [];
  for (const tf of targetFeatures) {
    const cf = comparatorMap.get(tf.feature_name);
    if (!cf) continue;

    const p1 = tf.percent / 100;
    const p2 = cf.percent / 100;
    const pooledSd = Math.sqrt(((p1 * (1 - p1)) + (p2 * (1 - p2))) / 2);
    const smd = pooledSd > 0 ? (p1 - p2) / pooledSd : 0;

    entries.push({
      covariate_name: tf.feature_name,
      smd_before: smd,
      smd_after: smd,
      mean_target_before: 0,
      mean_comp_before: 0,
      mean_target_after: 0,
      mean_comp_after: 0,
    });
  }

  return entries.sort((a, b) => Math.abs(b.smd_before) - Math.abs(a.smd_before));
}

function downloadCSV(results: CharacterizationResult[]) {
  const rows: string[] = [
    "Cohort,Feature Type,Feature Name,Count,Percent",
  ];

  for (const result of results) {
    if (!result.features) continue;
    for (const [type, features] of Object.entries(result.features)) {
      for (const f of features as FeatureResult[]) {
        rows.push(
          `"${result.cohort_name}","${type}","${f.feature_name.replace(/"/g, '""')}",${f.count},${f.percent}`,
        );
      }
    }
  }

  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "characterization_results.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Table 1 component (aggregate covariates from direct run)
// ---------------------------------------------------------------------------

type SmdFilter = "all" | "imbalanced" | "balanced";

function Table1View({
  rows,
}: {
  rows: AggregateCovariateRow[];
}) {
  const [search, setSearch] = useState("");
  const [smdFilter, setSmdFilter] = useState<SmdFilter>("all");
  const [sortBy, setSortBy] = useState<"name" | "smd">("smd");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let data = rows;

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter((r) =>
        r.covariate_name.toLowerCase().includes(q),
      );
    }

    if (smdFilter === "imbalanced") {
      data = data.filter((r) => Math.abs(r.smd) >= 0.1);
    } else if (smdFilter === "balanced") {
      data = data.filter((r) => Math.abs(r.smd) < 0.1);
    }

    return [...data].sort((a, b) => {
      const getVal = (row: AggregateCovariateRow) =>
        sortBy === "name" ? row.covariate_name : Math.abs(row.smd);
      const av = getVal(a);
      const bv = getVal(b);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, search, smdFilter, sortBy, sortDir]);

  const handleSort = (field: "name" | "smd") => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  const imbalancedCount = rows.filter((r) => Math.abs(r.smd) >= 0.1).length;
  const highImbalanceCount = rows.filter((r) => Math.abs(r.smd) >= 0.2).length;

  function SmdBadge({ value }: { value: number }) {
    const abs = Math.abs(value);
    const color =
      abs >= 0.2
        ? "#E85A6B"
        : abs >= 0.1
          ? "#F59E0B"
          : "#2DD4BF";
    return (
      <div className="flex items-center justify-end gap-2">
        <div
          className="h-1.5 rounded-full"
          style={{
            width: `${Math.min(Math.abs(value) * 100, 100)}%`,
            maxWidth: "60px",
            background: color,
            opacity: 0.7,
          }}
        />
        <span
          className="font-['IBM_Plex_Mono',monospace] text-sm font-medium"
          style={{ color, minWidth: "3.5rem", textAlign: "right" }}
        >
          {fmt(Math.abs(value), 3)}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-4 rounded-lg border px-4 py-3" style={{ borderColor: "#232328", background: "#151518" }}>
        <div className="flex-1">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total Covariates</p>
          <p className="text-lg font-bold font-['IBM_Plex_Mono',monospace]" style={{ color: "#F0EDE8" }}>
            {rows.length.toLocaleString()}
          </p>
        </div>
        <div className="flex-1">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Imbalanced (|SMD| ≥ 0.1)</p>
          <p className="text-lg font-bold font-['IBM_Plex_Mono',monospace]" style={{ color: imbalancedCount > 0 ? "#F59E0B" : "#2DD4BF" }}>
            {imbalancedCount.toLocaleString()}
          </p>
        </div>
        <div className="flex-1">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>High imbalance (|SMD| ≥ 0.2)</p>
          <p className="text-lg font-bold font-['IBM_Plex_Mono',monospace]" style={{ color: highImbalanceCount > 0 ? "#E85A6B" : "#2DD4BF" }}>
            {highImbalanceCount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#5A5650" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter covariates..."
            className={cn(
              "w-full rounded-lg border pl-9 pr-3 py-2 text-sm",
              "focus:outline-none focus:ring-1",
            )}
            style={{
              borderColor: "#232328",
              background: "#0E0E11",
              color: "#F0EDE8",
            }}
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1" style={{ borderColor: "#232328", background: "#151518" }}>
          {(["all", "imbalanced", "balanced"] as SmdFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setSmdFilter(f)}
              className="rounded px-3 py-1.5 text-xs font-medium transition-colors capitalize"
              style={smdFilter === f
                ? { background: "#232328", color: "#F0EDE8" }
                : { color: "#8A857D" }
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#232328", background: "#151518" }}>
        <div className="max-h-[500px] overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10" style={{ background: "#1C1C20" }}>
              <tr>
                <th
                  className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80 select-none"
                  style={{ color: "#8A857D" }}
                  onClick={() => handleSort("name")}
                >
                  Covariate Name {sortBy === "name" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#2DD4BF" }}>
                  Mean (Target)
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#C9A227" }}>
                  Mean (Outcome)
                </th>
                <th
                  className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80 select-none"
                  style={{ color: "#8A857D" }}
                  onClick={() => handleSort("smd")}
                >
                  |SMD| {sortBy === "smd" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr
                  key={`${row.covariate_name}-${i}`}
                  className="border-t"
                  style={{
                    borderColor: "#1C1C20",
                    background: i % 2 === 0 ? "#151518" : "#1A1A1E",
                  }}
                >
                  <td className="px-4 py-2.5 text-sm" style={{ color: "#F0EDE8", maxWidth: "400px" }}>
                    <span className="break-words">{row.covariate_name}</span>
                    {row.time_window && (
                      <span className="ml-2 text-[10px] rounded px-1.5 py-0.5" style={{ background: "#232328", color: "#8A857D" }}>
                        {row.time_window}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-['IBM_Plex_Mono',monospace] text-sm" style={{ color: "#2DD4BF" }}>
                    {fmt(row.mean_target, 3)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-['IBM_Plex_Mono',monospace] text-sm" style={{ color: "#C9A227" }}>
                    {fmt(row.mean_outcome, 3)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <SmdBadge value={row.smd} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: "#5A5650" }}>
                    No covariates match the current filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px]" style={{ color: "#5A5650" }}>
        Showing {filtered.length} of {rows.length} covariates
        {" · "}
        SMD color: <span style={{ color: "#2DD4BF" }}>green &lt; 0.1</span>
        {", "}
        <span style={{ color: "#F59E0B" }}>yellow 0.1–0.2</span>
        {", "}
        <span style={{ color: "#E85A6B" }}>red ≥ 0.2</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SMD Love Plot from direct run aggregate_covariates
// ---------------------------------------------------------------------------

function DirectLovePlot({ rows }: { rows: AggregateCovariateRow[] }) {
  if (rows.length === 0) return null;

  const sorted = [...rows]
    .sort((a, b) => Math.abs(b.smd) - Math.abs(a.smd))
    .slice(0, 150);

  // Build CovariateBalanceEntry from direct run SMD (no before/after — use smd for both)
  const entries: CovariateBalanceEntry[] = sorted.map((r) => ({
    covariate_name: r.covariate_name,
    smd_before: r.smd,
    smd_after: r.smd,
    mean_target_before: r.mean_target,
    mean_comp_before: r.mean_outcome,
    mean_target_after: r.mean_target,
    mean_comp_after: r.mean_outcome,
  }));

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: "#232328", background: "#151518" }}>
      <h3 className="text-sm font-semibold mb-1" style={{ color: "#F0EDE8" }}>
        SMD Love Plot — Covariate Balance
      </h3>
      <p className="text-xs mb-4" style={{ color: "#8A857D" }}>
        Showing top {sorted.length} covariates by |SMD|. Reference lines at 0.1 (balance threshold).
      </p>
      <div className="flex justify-center">
        <LovePlot data={entries} maxDisplay={150} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time-to-event section
// ---------------------------------------------------------------------------

function TimeToEventSection({
  rows,
}: {
  rows: NonNullable<DirectRunResult["time_to_event"]>;
}) {
  if (rows.length === 0) return null;

  // Group by target/outcome cohort pair
  const pairs = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.target_cohort_id ?? "?"}-${row.outcome_cohort_id ?? "?"}`;
    const group = pairs.get(key) ?? [];
    group.push(row);
    pairs.set(key, group);
  }

  return (
    <div className="rounded-lg border p-4 space-y-4" style={{ borderColor: "#232328", background: "#151518" }}>
      <h3 className="text-sm font-semibold" style={{ color: "#F0EDE8" }}>
        Time to Event
      </h3>
      {Array.from(pairs.entries()).map(([key, pairRows]) => {
        const first = pairRows[0];
        const label = [
          first.target_cohort_name ?? `Target #${first.target_cohort_id}`,
          "→",
          first.outcome_cohort_name ?? `Outcome #${first.outcome_cohort_id}`,
        ].join(" ");

        const maxEvents = Math.max(...pairRows.map((r) => r.num_events), 1);

        return (
          <div key={key}>
            <p className="text-xs font-medium mb-2" style={{ color: "#C5C0B8" }}>
              {label}
            </p>
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#232328" }}>
              <table className="w-full">
                <thead style={{ background: "#1C1C20" }}>
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8A857D" }}>
                      Time (days)
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8A857D" }}>
                      Events
                    </th>
                    {pairRows[0].num_at_risk !== undefined && (
                      <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8A857D" }}>
                        At Risk
                      </th>
                    )}
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8A857D" }}>
                      Distribution
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pairRows.slice(0, 30).map((row, i) => (
                    <tr
                      key={i}
                      className="border-t"
                      style={{ borderColor: "#1C1C20", background: i % 2 === 0 ? "#151518" : "#1A1A1E" }}
                    >
                      <td className="px-3 py-2 font-['IBM_Plex_Mono',monospace] text-sm" style={{ color: "#F0EDE8" }}>
                        {row.time_days}
                      </td>
                      <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-sm" style={{ color: "#2DD4BF" }}>
                        {row.num_events.toLocaleString()}
                      </td>
                      {row.num_at_risk !== undefined && (
                        <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-sm" style={{ color: "#C5C0B8" }}>
                          {row.num_at_risk.toLocaleString()}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ background: "#232328" }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(row.num_events / maxEvents) * 100}%`,
                              background: "#9B1B30",
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pairRows.length > 30 && (
              <p className="text-[10px] mt-1" style={{ color: "#5A5650" }}>
                Showing first 30 of {pairRows.length} rows
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cohort count cards
// ---------------------------------------------------------------------------

function CohortCountCards({
  counts,
}: {
  counts: NonNullable<DirectRunResult["cohort_counts"]>;
}) {
  if (counts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {counts.map((c) => (
        <div
          key={c.cohort_id}
          className="flex items-center gap-3 rounded-lg border px-4 py-3"
          style={{ borderColor: "#232328", background: "#151518" }}
        >
          <Users size={16} style={{ color: "#9B1B30" }} />
          <div>
            <p className="text-xs font-medium" style={{ color: "#8A857D" }}>
              {c.cohort_name ?? `Cohort #${c.cohort_id}`}
            </p>
            <p
              className="text-xl font-bold font-['IBM_Plex_Mono',monospace]"
              style={{ color: "#F0EDE8" }}
            >
              {c.person_count.toLocaleString()}
              <span className="text-xs font-normal ml-1" style={{ color: "#8A857D" }}>
                persons
              </span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Direct Run Results view
// ---------------------------------------------------------------------------

type DirectTab = "table1" | "love_plot" | "time_to_event";

function DirectRunResultsView({ result }: { result: DirectRunResult }) {
  const hasTable1 =
    result.aggregate_covariates && result.aggregate_covariates.length > 0;
  const hasTimeToEvent =
    result.time_to_event && result.time_to_event.length > 0;

  const availableTabs: { key: DirectTab; label: string }[] = [
    ...(hasTable1
      ? [
          { key: "table1" as DirectTab, label: "Table 1" },
          { key: "love_plot" as DirectTab, label: "SMD Love Plot" },
        ]
      : []),
    ...(hasTimeToEvent
      ? [{ key: "time_to_event" as DirectTab, label: "Time to Event" }]
      : []),
  ];

  const [activeTab, setActiveTab] = useState<DirectTab>(
    availableTabs[0]?.key ?? "table1",
  );

  if (result.error) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center" style={{ borderColor: "#323238", background: "#151518" }}>
        <AlertCircle size={20} className="mx-auto mb-2" style={{ color: "#E85A6B" }} />
        <p className="text-sm font-semibold" style={{ color: "#F0EDE8" }}>R execution error</p>
        <p className="mt-1 text-xs" style={{ color: "#E85A6B" }}>{result.error}</p>
      </div>
    );
  }

  if (availableTabs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center" style={{ borderColor: "#323238", background: "#151518" }}>
        <AlertCircle size={20} className="mx-auto mb-2" style={{ color: "#323238" }} />
        <p className="text-sm" style={{ color: "#8A857D" }}>
          No result data returned from R execution.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cohort counts */}
      {result.cohort_counts && result.cohort_counts.length > 0 && (
        <CohortCountCards counts={result.cohort_counts} />
      )}

      {/* Execution time */}
      {result.execution_time_seconds !== undefined && (
        <p className="text-xs" style={{ color: "#5A5650" }}>
          R execution time: {result.execution_time_seconds.toFixed(1)}s
        </p>
      )}

      {/* Tab bar */}
      {availableTabs.length > 1 && (
        <div className="flex items-center gap-1 border-b" style={{ borderColor: "#232328" }}>
          {availableTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
              )}
              style={activeTab === tab.key
                ? { color: "#2DD4BF" }
                : { color: "#8A857D" }
              }
            >
              {tab.label}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#2DD4BF" }} />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      {activeTab === "table1" && hasTable1 && (
        <Table1View rows={result.aggregate_covariates!} />
      )}
      {activeTab === "love_plot" && hasTable1 && (
        <DirectLovePlot rows={result.aggregate_covariates!} />
      )}
      {activeTab === "time_to_event" && hasTimeToEvent && (
        <TimeToEventSection rows={result.time_to_event!} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function CharacterizationResults({
  execution,
  directResult,
  isLoading,
}: CharacterizationResultsProps) {
  const [activeTab, setActiveTab] = useState<FeatureType | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  // Show direct run result if present, above (or instead of) execution results
  if (directResult) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border px-4 py-2 flex items-center gap-2" style={{ borderColor: "#9B1B3040", background: "#9B1B3010" }}>
          <span className="text-xs font-semibold" style={{ color: "#9B1B30" }}>OHDSI Direct Run Result</span>
          <span className="text-xs" style={{ color: "#8A857D" }}>via R Characterization package</span>
        </div>
        <DirectRunResultsView result={directResult} />
      </div>
    );
  }

  if (!execution || execution.status !== "completed") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <AlertCircle size={24} className="text-[#323238] mb-3" />
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          No results available
        </h3>
        <p className="mt-1 text-xs text-[#8A857D]">
          {execution
            ? `Execution status: ${execution.status}`
            : "Execute the analysis to generate results, or use Run Direct (OHDSI) from the Design tab."}
        </p>
        {execution?.fail_message && (
          <p className="mt-2 text-xs text-[#E85A6B] max-w-md text-center">
            {execution.fail_message}
          </p>
        )}
      </div>
    );
  }

  const results = parseResults(execution);

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <AlertCircle size={24} className="text-[#323238] mb-3" />
        <p className="text-sm text-[#8A857D]">
          Execution completed but no results were returned.
        </p>
      </div>
    );
  }

  const featureTypes = getAvailableFeatureTypes(results);
  const currentTab = activeTab ?? featureTypes[0] ?? null;

  const target = results[0];
  const comparator = results.length > 1 ? results[1] : null;

  // Compute SMD for Love Plot when comparator exists
  const balanceEntries: CovariateBalanceEntry[] = [];
  if (comparator) {
    for (const ft of featureTypes) {
      const tf = target.features?.[ft];
      const cf = comparator.features?.[ft];
      if (tf && cf) {
        balanceEntries.push(...computeSmdFromFeatures(tf, cf));
      }
    }
    balanceEntries.sort((a, b) => Math.abs(b.smd_before) - Math.abs(a.smd_before));
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {results.map((r) => (
              <div key={r.cohort_id} className="space-y-1">
                <p style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--text-muted)" }}>
                  {r.cohort_name}
                </p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--primary)" }}>
                  {r.person_count.toLocaleString()}
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 400, color: "var(--text-muted)", marginLeft: "var(--space-1)" }}>
                    persons
                  </span>
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => downloadCSV(results)}
            className="btn btn-secondary btn-sm"
          >
            <Download size={14} />
            Download CSV
          </button>
        </div>
      </div>

      {/* Verdict Dashboard (when comparator present) */}
      {balanceEntries.length > 0 && (
        <CharacterizationVerdictDashboard
          balanceEntries={balanceEntries}
          targetLabel={target.cohort_name}
          comparatorLabel={comparator?.cohort_name}
        />
      )}

      {/* Covariate Balance Love Plot (when comparator present) */}
      {balanceEntries.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">
            Covariate Balance — Standardized Mean Differences
          </h3>
          <div className="flex justify-center">
            <LovePlot data={balanceEntries} />
          </div>
        </div>
      )}

      {/* Feature Type Tabs */}
      {featureTypes.length > 0 && (
        <>
          <div className="tab-bar">
            {featureTypes.map((ft) => (
              <button
                key={ft}
                type="button"
                onClick={() => setActiveTab(ft)}
                className={cn("tab-item", currentTab === ft && "active")}
              >
                {FEATURE_TYPE_LABELS[ft]}
              </button>
            ))}
          </div>

          {/* Feature Table */}
          {currentTab && target?.features?.[currentTab] && (
            <FeatureComparisonTable
              targetFeatures={target.features[currentTab]}
              comparatorFeatures={
                comparator?.features?.[currentTab]
              }
              targetLabel={target.cohort_name}
              comparatorLabel={comparator?.cohort_name}
            />
          )}
        </>
      )}
    </div>
  );
}
