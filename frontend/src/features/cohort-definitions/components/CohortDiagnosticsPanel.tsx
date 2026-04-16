import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Check,
  Info,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { runRCohortDiagnostics } from "../api/cohortApi";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useSourceStore } from "@/stores/sourceStore";
import type {
  RDiagnosticsResponse,
  RDiagnosticsResults,
  IncidenceRateRow,
  OrphanConceptRow,
  IndexEventBreakdownRow,
  VisitContextRow,
  InclusionStatRow,
  TemporalCharacterizationRow,
  RunCohortDiagnosticsPayload,
} from "../types/cohortExpression";

// ---------------------------------------------------------------------------
// Toggle config
// ---------------------------------------------------------------------------

interface DiagnosticToggle {
  key: keyof Omit<RunCohortDiagnosticsPayload, "cohort_definition_ids" | "source_id" | "min_cell_count">;
  label: string;
  description: string;
  defaultOn: boolean;
  expensive?: boolean;
}

const DIAGNOSTIC_TOGGLES: DiagnosticToggle[] = [
  {
    key: "run_incidence_rate",
    label: "Incidence Rate",
    description: "Rates per 1,000 person-years by age, gender, and calendar year",
    defaultOn: true,
  },
  {
    key: "run_orphan_concepts",
    label: "Orphan Concepts",
    description: "Concepts used in the cohort definition not in standard hierarchy",
    defaultOn: true,
  },
  {
    key: "run_breakdown_index_events",
    label: "Index Event Breakdown",
    description: "Distribution of index event source concepts",
    defaultOn: true,
  },
  {
    key: "run_visit_context",
    label: "Visit Context",
    description: "Visit type at time of cohort entry",
    defaultOn: true,
  },
  {
    key: "run_inclusion_statistics",
    label: "Inclusion Statistics",
    description: "Attrition funnel for each inclusion rule",
    defaultOn: true,
  },
  {
    key: "run_temporal_characterization",
    label: "Temporal Characterization",
    description: "Time-windowed covariate prevalence (slow — adds several minutes)",
    defaultOn: false,
    expensive: true,
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  count,
  open,
  onToggle,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between px-4 py-3 bg-surface-overlay hover:bg-surface-elevated transition-colors"
    >
      <div className="flex items-center gap-2">
        {open ? (
          <ChevronDown size={14} className="text-text-ghost" />
        ) : (
          <ChevronRight size={14} className="text-text-ghost" />
        )}
        <span className="text-sm font-semibold text-text-primary">{title}</span>
        {count !== undefined && (
          <span className="rounded px-1.5 py-0.5 text-[9px] font-medium bg-success/15 text-success">
            {count.toLocaleString()}
          </span>
        )}
      </div>
    </button>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-6 text-xs text-text-ghost">
      <Info size={12} />
      {message}
    </div>
  );
}

// ---- Incidence Rate ----

function IncidenceRateSection({ rows }: { rows: IncidenceRateRow[] }) {
  const [open, setOpen] = useState(true);
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        <SectionHeader title="Incidence Rate" open={open} onToggle={() => setOpen(!open)} />
        {open && <EmptySection message="No incidence rate data returned." />}
      </div>
    );
  }

  // Show top 50 rows
  const display = rows.slice(0, 50);

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <SectionHeader
        title="Incidence Rate"
        count={rows.length}
        open={open}
        onToggle={() => setOpen(!open)}
      />
      {open && (
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-raised">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-text-muted">Cohort ID</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">Age Group</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">Gender</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">Calendar Year</th>
                <th className="px-3 py-2 text-right font-medium text-text-muted">Rate / 1K py</th>
                <th className="px-3 py-2 text-right font-medium text-text-muted">Cohort Count</th>
                <th className="px-3 py-2 text-right font-medium text-text-muted">Person Years</th>
              </tr>
            </thead>
            <tbody>
              {display.map((row, i) => (
                <tr
                  key={i}
                  className="border-t border-border-subtle hover:bg-surface-overlay transition-colors"
                >
                  <td className="px-3 py-2 font-['IBM_Plex_Mono',monospace] text-text-secondary">
                    {row.cohortId}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{row.ageGroup ?? "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">{row.gender ?? "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">{row.calendarYear ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-success">
                    {row.incidenceRate100kpy != null
                      ? Number(row.incidenceRate100kpy).toFixed(2)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-primary">
                    {row.cohortCount?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-muted">
                    {row.personYears != null
                      ? Number(row.personYears).toLocaleString(undefined, { maximumFractionDigits: 0 })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 50 && (
            <p className="px-4 py-2 text-[10px] text-text-ghost">
              Showing first 50 of {rows.length.toLocaleString()} rows.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Orphan Concepts ----

function OrphanConceptsSection({ rows }: { rows: OrphanConceptRow[] }) {
  const [open, setOpen] = useState(true);
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        <SectionHeader title="Orphan Concepts" open={open} onToggle={() => setOpen(!open)} />
        {open && (
          <div className="flex items-center gap-2 px-4 py-6 text-xs text-success">
            <Check size={12} />
            No orphan concepts found.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <SectionHeader
        title="Orphan Concepts"
        count={rows.length}
        open={open}
        onToggle={() => setOpen(!open)}
      />
      {open && (
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-raised">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-text-muted">Concept ID</th>
                <th className="px-3 py-2 text-left font-medium text-text-muted">Concept Name</th>
                <th className="px-3 py-2 text-right font-medium text-text-muted">Record Count</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-t border-border-subtle hover:bg-surface-overlay transition-colors"
                >
                  <td className="px-3 py-2 font-['IBM_Plex_Mono',monospace] text-accent">
                    {row.conceptId}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{row.conceptName ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-primary">
                    {row.conceptCount?.toLocaleString() ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- Index Event Breakdown ----

function IndexEventBreakdownSection({ rows }: { rows: IndexEventBreakdownRow[] }) {
  const [open, setOpen] = useState(true);
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        <SectionHeader
          title="Index Event Breakdown"
          open={open}
          onToggle={() => setOpen(!open)}
        />
        {open && <EmptySection message="No index event breakdown data returned." />}
      </div>
    );
  }

  const totalSubjects = rows.reduce((s, r) => s + (r.subjectCount ?? 0), 0) || 1;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <SectionHeader
        title="Index Event Breakdown"
        count={rows.length}
        open={open}
        onToggle={() => setOpen(!open)}
      />
      {open && (
        <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
          {rows.map((row, i) => {
            const pct = ((row.subjectCount ?? 0) / totalSubjects) * 100;
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-text-secondary truncate max-w-xs">
                    {row.conceptName ?? `Concept ${row.conceptId}`}
                  </span>
                  <span className="font-['IBM_Plex_Mono',monospace] text-text-muted ml-2 shrink-0">
                    {row.subjectCount?.toLocaleString() ?? 0} ({pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-4 bg-surface-base rounded overflow-hidden">
                  <div
                    className="h-full bg-primary rounded transition-all"
                    style={{ width: `${Math.max(pct, 0.5)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Visit Context ----

function VisitContextSection({ rows }: { rows: VisitContextRow[] }) {
  const [open, setOpen] = useState(true);
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        <SectionHeader title="Visit Context" open={open} onToggle={() => setOpen(!open)} />
        {open && <EmptySection message="No visit context data returned." />}
      </div>
    );
  }

  const maxCount = Math.max(...rows.map((r) => r.subjectCount ?? 0), 1);

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <SectionHeader
        title="Visit Context"
        count={rows.length}
        open={open}
        onToggle={() => setOpen(!open)}
      />
      {open && (
        <div className="p-4 space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-text-secondary w-44 shrink-0 truncate">
                {row.visitConceptName ?? row.visitContext ?? `Visit ${row.visitConceptId}`}
              </span>
              <div className="flex-1 h-5 bg-surface-base rounded overflow-hidden">
                <div
                  className="h-full bg-success rounded"
                  style={{
                    width: `${((row.subjectCount ?? 0) / maxCount) * 100}%`,
                    minWidth: (row.subjectCount ?? 0) > 0 ? 2 : 0,
                  }}
                />
              </div>
              <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-muted w-16 text-right">
                {row.subjectCount?.toLocaleString() ?? "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Inclusion Statistics ----

function InclusionStatisticsSection({ rows }: { rows: InclusionStatRow[] }) {
  const [open, setOpen] = useState(true);
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        <SectionHeader
          title="Inclusion Statistics"
          open={open}
          onToggle={() => setOpen(!open)}
        />
        {open && <EmptySection message="No inclusion statistics returned." />}
      </div>
    );
  }

  const maxTotal = Math.max(...rows.map((r) => r.totalSubjects ?? 0), 1);

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <SectionHeader
        title="Inclusion Statistics"
        count={rows.length}
        open={open}
        onToggle={() => setOpen(!open)}
      />
      {open && (
        <div className="p-4 space-y-3">
          {rows.map((row, i) => {
            const pct = ((row.meetSubjects ?? 0) / maxTotal) * 100;
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-text-secondary">
                    <span className="font-['IBM_Plex_Mono',monospace] text-text-ghost mr-1.5">
                      #{row.ruleSequence ?? i + 1}
                    </span>
                    {row.ruleName ?? `Rule ${(row.ruleSequence ?? i) + 1}`}
                  </span>
                  <div className="flex items-center gap-3 ml-2 shrink-0">
                    <span className="text-success font-['IBM_Plex_Mono',monospace]">
                      {row.meetSubjects?.toLocaleString() ?? "—"} meet
                    </span>
                    <span className="text-text-muted font-['IBM_Plex_Mono',monospace]">
                      {row.gainSubjects?.toLocaleString() ?? "—"} gain
                    </span>
                  </div>
                </div>
                <div className="h-3 bg-surface-base rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#2DD4BF] to-[#C9A227] rounded transition-all"
                    style={{ width: `${Math.max(pct, 0.5)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Temporal Characterization ----

function TemporalCharacterizationSection({
  rows,
}: {
  rows: TemporalCharacterizationRow[];
}) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        <SectionHeader
          title="Temporal Characterization"
          open={open}
          onToggle={() => setOpen(!open)}
        />
        {open && <EmptySection message="No temporal characterization data returned." />}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <SectionHeader
        title="Temporal Characterization"
        count={rows.length}
        open={open}
        onToggle={() => setOpen(!open)}
      />
      {open && (
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-raised">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-text-muted">Covariate</th>
                <th className="px-3 py-2 text-right font-medium text-text-muted">Time Window</th>
                <th className="px-3 py-2 text-right font-medium text-text-muted">Mean</th>
                <th className="px-3 py-2 text-right font-medium text-text-muted">SD</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-t border-border-subtle hover:bg-surface-overlay transition-colors"
                >
                  <td className="px-3 py-2 text-text-secondary max-w-xs truncate">
                    {row.covariateName ?? `Covariate ${row.covariateId}`}
                  </td>
                  <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-muted">
                    {row.timeId ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-accent">
                    {row.mean != null ? Number(row.mean).toFixed(4) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-muted">
                    {row.sd != null ? Number(row.sd).toFixed(4) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- Results renderer ----

function DiagnosticsResults({
  response,
  enabledToggles: _enabledToggles,
}: {
  response: RDiagnosticsResponse;
  enabledToggles: Set<string>;
}) {
  const r: RDiagnosticsResults = response.results ?? {};

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-default bg-surface-raised px-4 py-3">
        <div className="flex items-center gap-2">
          <Check size={14} className="text-success" />
          <span className="text-xs font-medium text-text-primary">
            Diagnostics completed
          </span>
        </div>
        {response.cohort_count != null && (
          <span className="text-xs text-text-muted">
            {response.cohort_count} cohort{response.cohort_count !== 1 ? "s" : ""}
          </span>
        )}
        {response.elapsed_seconds != null && (
          <span className="text-xs text-text-ghost font-['IBM_Plex_Mono',monospace]">
            {response.elapsed_seconds.toFixed(1)}s
          </span>
        )}
        {response.database_id && (
          <span className="rounded px-1.5 py-0.5 text-[9px] bg-surface-overlay border border-border-default text-text-muted font-['IBM_Plex_Mono',monospace]">
            {response.database_id}
          </span>
        )}
      </div>

      {/* Cohort counts */}
      {r.cohort_counts && r.cohort_counts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {r.cohort_counts.map((cc, i) => (
            <div
              key={i}
              className="rounded-lg border border-border-default bg-surface-raised p-3 text-center"
            >
              <p className="font-['IBM_Plex_Mono',monospace] text-lg font-bold text-text-primary">
                {(cc.cohortSubjects ?? 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-text-muted">Subjects</p>
              <p className="text-[10px] text-text-ghost font-['IBM_Plex_Mono',monospace]">
                Cohort {cc.cohortId}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Individual result sections */}
      {r.incidence_rates && (
        <IncidenceRateSection rows={r.incidence_rates} />
      )}

      {r.orphan_concepts && (
        <OrphanConceptsSection rows={r.orphan_concepts} />
      )}

      {r.index_event_breakdown && (
        <IndexEventBreakdownSection rows={r.index_event_breakdown} />
      )}

      {r.visit_context && (
        <VisitContextSection rows={r.visit_context} />
      )}

      {r.inclusion_statistics && (
        <InclusionStatisticsSection rows={r.inclusion_statistics} />
      )}

      {r.temporal_characterization && (
        <TemporalCharacterizationSection rows={r.temporal_characterization} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface CohortDiagnosticsPanelProps {
  definitionId: number;
}

export function CohortDiagnosticsPanel({
  definitionId,
}: CohortDiagnosticsPanelProps) {
  // ---- State ----
  const [result, setResult] = useState<RDiagnosticsResponse | null>(null);
  const [sourceId, setSourceId] = useState<number | "">("");
  const [toggles, setToggles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DIAGNOSTIC_TOGGLES.map((t) => [t.key, t.defaultOn]))
  );

  // ---- Data ----
  const { data: sources, isLoading: sourcesLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const userDefaultSourceId = useSourceStore((s) => s.defaultSourceId);

  // Auto-select user's default source
  if (!sourceId && sources && sources.length > 0 && sources[0]) {
    const def = (userDefaultSourceId ? sources.find((s) => s.id === userDefaultSourceId) : null) ?? sources[0];
    setSourceId(def.id);
  }

  const mutation = useMutation({
    mutationFn: (payload: RunCohortDiagnosticsPayload) =>
      runRCohortDiagnostics(payload),
    onSuccess: (data) => setResult(data),
  });

  const handleRun = () => {
    if (!sourceId) return;
    const payload: RunCohortDiagnosticsPayload = {
      cohort_definition_ids: [definitionId],
      source_id: sourceId as number,
      ...Object.fromEntries(
        DIAGNOSTIC_TOGGLES.map((t) => [t.key, toggles[t.key] ?? t.defaultOn])
      ),
    };
    mutation.mutate(payload);
  };

  const enabledToggles = new Set(
    DIAGNOSTIC_TOGGLES.filter((t) => toggles[t.key]).map((t) => t.key)
  );

  // ---- Loading state ----
  if (mutation.isPending) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-raised p-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-success" />
          <p className="text-sm font-medium text-text-primary">Running diagnostics…</p>
          <p className="text-xs text-text-muted">
            This may take several minutes depending on cohort size and selected analyses.
          </p>
        </div>
      </div>
    );
  }

  // ---- Results view ----
  if (result) {
    return (
      <div className="space-y-4">
        {/* Re-run controls */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            Cohort Diagnostics Results
          </h3>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
          >
            <RefreshCw size={12} />
            Re-configure
          </button>
        </div>

        <DiagnosticsResults response={result} enabledToggles={enabledToggles} />
      </div>
    );
  }

  // ---- Configuration / idle view ----
  return (
    <div className="space-y-4">
      {/* Panel header */}
      <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-surface-overlay">
          <Activity size={14} className="text-primary" />
          <h4 className="text-sm font-semibold text-text-primary">Cohort Diagnostics</h4>
          <span className="rounded px-1.5 py-0.5 text-[9px] font-medium bg-primary/15 text-primary">
            R / HADES
          </span>
        </div>

        <div className="p-4 space-y-5">
          {/* Source selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted">
              Data Source
            </label>
            {sourcesLoading ? (
              <div className="flex items-center gap-2 text-xs text-text-ghost">
                <Loader2 size={12} className="animate-spin" />
                Loading sources…
              </div>
            ) : !sources || sources.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-critical">
                <AlertCircle size={12} />
                No data sources configured. Add one in Admin &rarr; Sources.
              </div>
            ) : (
              <select
                value={sourceId}
                onChange={(e) => setSourceId(Number(e.target.value))}
                className={cn(
                  "w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary",
                  "focus:outline-none focus:border-success transition-colors"
                )}
              >
                <option value="" disabled>
                  Select a source…
                </option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.source_name}
                    {s.id === userDefaultSourceId ? " (default)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Diagnostic toggles */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-text-muted">Diagnostic Analyses</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DIAGNOSTIC_TOGGLES.map((toggle) => (
                <label
                  key={toggle.key}
                  className={cn(
                    "flex items-start gap-2.5 rounded-md border px-3 py-2.5 cursor-pointer transition-colors",
                    toggles[toggle.key]
                      ? "border-success/30 bg-success/5"
                      : "border-border-default bg-surface-base hover:border-surface-highlight"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={toggles[toggle.key] ?? toggle.defaultOn}
                    onChange={(e) =>
                      setToggles((prev) => ({
                        ...prev,
                        [toggle.key]: e.target.checked,
                      }))
                    }
                    className="mt-0.5 h-3.5 w-3.5 rounded border-text-ghost bg-surface-base accent-success"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                      {toggle.label}
                      {toggle.expensive && (
                        <span className="text-[9px] text-accent bg-accent/10 rounded px-1 py-0.5">
                          slow
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-text-ghost leading-snug">
                      {toggle.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Error display */}
          {mutation.isError && (
            <div className="flex items-start gap-2 rounded-md border border-red-800/50 bg-red-900/20 px-3 py-2.5 text-xs text-red-300">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              <span>
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "Failed to run diagnostics. Check Darkstar is healthy."}
              </span>
            </div>
          )}

          {/* Run button */}
          <button
            type="button"
            onClick={handleRun}
            disabled={!sourceId || mutation.isPending}
            className={cn(
              "w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              sourceId && !mutation.isPending
                ? "bg-primary text-primary-foreground hover:bg-primary/80"
                : "bg-surface-overlay text-text-ghost cursor-not-allowed border border-border-default"
            )}
          >
            {mutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Activity size={14} />
            )}
            Run Diagnostics
          </button>

          <p className="text-[10px] text-text-ghost text-center">
            Diagnostics run directly against the CDM and may take 1–5 minutes.
            Results are not persisted.
          </p>
        </div>
      </div>
    </div>
  );
}
