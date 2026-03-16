import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import {
  FormField,
  ActionButton,
  ResultSection,
  KeyValueGrid,
  RecordTable,
  LabelValueList,
  StatusListView,
  MiniMetric,
  ProgressRow,
  ErrorBanner,
  EmptyState,
  RuntimePanel,
  RecentRunsView,
  RunInspectorView,
  RunComparisonPanel,
  requireSource,
  getErrorMessage,
  formatValue,
  downloadJson,
  formatTimestamp,
  moduleOptions,
  burdenDomainOptions,
  exposureWindowOptions,
  stratifyByOptions,
  timeWindowUnitOptions,
  gwasMethodOptions,
  PlausibilityBadge,
} from "./workbenchShared";
import { CollapsibleSection } from "./CollapsibleSection";
import type {
  FinnGenCo2AnalysisResult,
  FinnGenSource,
  FinnGenRuntime,
  FinnGenMetricPoint,
  FinnGenTimelineStep,
} from "../types";
import {
  previewFinnGenCo2Analysis,
  fetchFinnGenRuns,
  fetchFinnGenRun,
  exportFinnGenRun,
  replayFinnGenRun,
} from "../api";

// ── CO2-specific view components ──────────────────────────────────────

function ForestPlotView({ result }: { result: FinnGenCo2AnalysisResult }) {
  const family = String(
    result.module_family ?? result.analysis_summary.module_family ?? "comparative_effectiveness",
  );
  const titleLabel =
    family === "condition_burden"
      ? "Burden intensity"
      : family === "drug_utilization"
        ? "Exposure intensity"
        : family === "timecodewas"
          ? "Temporal code signal"
          : family === "gwas"
            ? "Association signal"
            : family === "sex_stratified"
              ? "Sex-stratified effect"
              : "Comparative effect";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs uppercase tracking-wide text-zinc-400">
        {titleLabel}
      </div>
      {result.forest_plot.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-200">{item.label}</span>
            <span className="text-zinc-400">
              HR {item.effect} ({item.lower}, {item.upper})
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-zinc-800">
            <div className="absolute left-1/2 top-[-4px] h-4 w-px bg-[#C9A227]" />
            <div
              className="absolute top-0 h-2 rounded-full bg-[#9B1B30]"
              style={{
                left: `${Math.max(0, ((item.lower ?? 0.5) / 2) * 100)}%`,
                width: `${Math.max(4, (((item.upper ?? 1) - (item.lower ?? 0.5)) / 2) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ModuleGalleryView({ result }: { result: FinnGenCo2AnalysisResult }) {
  return (
    <div className="space-y-2">
      {result.module_gallery.map((item) => (
        <div key={item.name} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-zinc-100">{item.name}</div>
              <div className="mt-1 text-xs text-zinc-500">{item.family}</div>
            </div>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                item.status === "selected"
                  ? "bg-[#9B1B30]/15 text-[#E85A6B]"
                  : "bg-zinc-800 text-zinc-300"
              }`}
            >
              {item.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Co2FamilyEvidenceView({ result }: { result: FinnGenCo2AnalysisResult }) {
  return (
    <div className="space-y-3">
      {result.family_evidence?.map((item) => (
        <div
          key={item.label}
          className={`rounded-lg border px-3 py-3 ${
            item.emphasis === "result"
              ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/10"
              : item.emphasis === "delta"
                ? "border-[#C9A227]/30 bg-[#C9A227]/10"
                : "border-zinc-800 bg-zinc-950/70"
          }`}
        >
          <div className="text-xs uppercase tracking-wide text-zinc-500">{item.label}</div>
          <div className="mt-2 text-lg font-semibold text-zinc-100">{String(item.value)}</div>
        </div>
      ))}
    </div>
  );
}

function Co2FamilyNotesView({ result }: { result: FinnGenCo2AnalysisResult }) {
  return (
    <div className="space-y-2">
      {result.family_notes?.map((note) => (
        <div
          key={note}
          className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3 text-sm text-zinc-300"
        >
          {note}
        </div>
      ))}
    </div>
  );
}

function Co2SpotlightView({ result }: { result: FinnGenCo2AnalysisResult }) {
  return (
    <div className="space-y-3">
      {(result.family_spotlight ?? []).map((item) => (
        <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">{item.label}</div>
          <div className="mt-2 text-lg font-semibold text-zinc-100">{String(item.value)}</div>
          {item.detail ? (
            <div className="mt-1 text-xs text-zinc-400">{item.detail}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Co2SegmentsView({ result }: { result: FinnGenCo2AnalysisResult }) {
  const segments = result.family_segments ?? [];
  const maxCount = Math.max(...segments.map((item) => item.count), 1);

  return (
    <div className="space-y-3">
      {segments.map((item) => (
        <ProgressRow
          key={item.label}
          label={item.label}
          value={item.count}
          total={maxCount}
          color="#2DD4BF"
          suffix={
            typeof item.share === "number"
              ? `${Math.round(item.share * 100)}%`
              : undefined
          }
        />
      ))}
    </div>
  );
}

function HeatmapView({ result }: { result: FinnGenCo2AnalysisResult }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {result.heatmap.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-zinc-800 p-4"
          style={{
            backgroundColor: `rgba(201, 162, 39, ${0.12 + item.value * 0.6})`,
          }}
        >
          <div className="text-sm font-medium text-zinc-100">{item.label}</div>
          <div className="mt-1 text-xs text-zinc-800">{item.value.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}

function SubgroupBalanceView({ result }: { result: FinnGenCo2AnalysisResult }) {
  const total = Math.max(...result.heatmap.map((item) => item.value), 0);

  return (
    <div className="space-y-3">
      {result.heatmap.map((item) => (
        <ProgressRow
          key={item.label}
          label={item.label}
          value={Math.round(item.value * 1000)}
          total={Math.round(total * 1000) || 1}
          color="#C9A227"
          suffix={`${Math.round(item.value * 100)}%`}
        />
      ))}
    </div>
  );
}

function PhenotypeScoringView({ result }: { result: FinnGenCo2AnalysisResult }) {
  const maxSignals = Math.max(
    ...result.top_signals.map((item) => item.count),
    1,
  );

  return (
    <div className="space-y-3">
      {result.top_signals.slice(0, 4).map((item, index) => {
        const score = item.count / maxSignals;
        return (
          <div
            key={item.label}
            className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-zinc-100">{item.label}</div>
              <div className="text-xs text-zinc-500">
                Score {(score * 100).toFixed(0)}
              </div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-zinc-800">
              <div
                className="h-2 rounded-full bg-[#9B1B30]"
                style={{ width: `${score * 100}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Rank {index + 1} of {result.top_signals.length} candidate phenotypes
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OverlapMatrixView({ result }: { result: FinnGenCo2AnalysisResult }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {(result.overlap_matrix ?? []).map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-zinc-800 p-4"
          style={{
            backgroundColor: `rgba(155, 27, 48, ${0.14 + item.value * 0.45})`,
          }}
        >
          <div className="text-sm font-medium text-zinc-100">{item.label}</div>
          <div className="mt-2 text-xl font-semibold text-white">
            {Math.round(item.value * 100)}%
          </div>
        </div>
      ))}
    </div>
  );
}

function TimeProfileView({ result }: { result: FinnGenCo2AnalysisResult }) {
  const points = result.time_profile ?? [];
  const maxCount = Math.max(...points.map((item) => item.count), 1);

  return (
    <div className="space-y-4">
      {points.map((item) => (
        <ProgressRow
          key={item.label}
          label={item.label}
          value={item.count}
          total={maxCount}
          color="#9B1B30"
        />
      ))}
    </div>
  );
}

function TemporalWindowsView({ result }: { result: FinnGenCo2AnalysisResult }) {
  const windows = result.temporal_windows ?? [];
  const maxCount = Math.max(...windows.map((item) => item.count), 1);

  return (
    <div className="space-y-3">
      {windows.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-100">{item.label}</div>
            <div className="text-sm text-zinc-400">{item.count.toLocaleString()}</div>
          </div>
          <div className="mt-2 h-2 rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full bg-[#60A5FA]"
              style={{ width: `${(item.count / maxCount) * 100}%` }}
            />
          </div>
          {item.detail ? (
            <div className="mt-2 text-xs text-zinc-500">{item.detail}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function TrendView({ result }: { result: FinnGenCo2AnalysisResult }) {
  const maxCount = Math.max(
    ...result.utilization_trend.map((item) => item.count),
    1,
  );

  return (
    <div className="space-y-3">
      {result.utilization_trend.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-zinc-300">{item.label}</span>
            <span className="text-zinc-500">{item.count.toLocaleString()}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full bg-[#C9A227]"
              style={{ width: `${(item.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TopSignalsView({ result }: { result: FinnGenCo2AnalysisResult }) {
  return (
    <div className="space-y-2">
      {result.top_signals.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3"
        >
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-100">{item.label}</div>
            <div className="text-xs text-zinc-500">
              {item.count.toLocaleString()} events
            </div>
          </div>
          <div className="h-2 rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full bg-[#2DD4BF]"
              style={{
                width: `${Math.min(
                  100,
                  (item.count /
                    Math.max(
                      ...result.top_signals.map((signal) => signal.count),
                      1,
                    )) *
                    100,
                )}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ExecutionTimelineView({ result }: { result: FinnGenCo2AnalysisResult }) {
  return (
    <div className="space-y-3">
      {result.execution_timeline.map((item) => (
        <div
          key={`${item.stage}-${item.duration_ms}`}
          className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-zinc-100">{item.stage}</div>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/15 text-[#2DD4BF]">
              {item.status}
            </span>
          </div>
          <div className="mt-1 text-sm text-zinc-400">
            {typeof item.duration_ms === "number"
              ? `${item.duration_ms} ms`
              : "n/a"}
          </div>
        </div>
      ))}
    </div>
  );
}

function Co2PlausibilityView({ result }: { result: FinnGenCo2AnalysisResult }) {
  const analysisSummary = (result.analysis_summary ?? {}) as Record<string, unknown>;
  const topSignals = Array.isArray(result.top_signals) ? result.top_signals : [];
  const trend = Array.isArray(result.utilization_trend)
    ? result.utilization_trend
    : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <PlausibilityBadge
          label="Population base"
          value={formatValue(analysisSummary.person_count ?? "Unavailable")}
          tone={Number(analysisSummary.person_count ?? 0) > 0 ? "good" : "warn"}
        />
        <PlausibilityBadge
          label="Signal count"
          value={
            topSignals.length
              ? `${topSignals.length} concepts`
              : "No signals"
          }
          tone={topSignals.length ? "good" : "warn"}
        />
        <PlausibilityBadge
          label="Trend buckets"
          value={
            trend.length ? `${trend.length} periods` : "No periods"
          }
          tone={trend.length ? "good" : "warn"}
        />
      </div>
      {topSignals.length ? (
        <div className="space-y-2">
          {topSignals.slice(0, 4).map((signal, index) => {
            const record = signal as Record<string, unknown>;
            return (
              <div
                key={`${String(record.label ?? "signal")}-${index}`}
                className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-zinc-100">
                    {String(record.label ?? "Signal")}
                  </div>
                  <div className="text-sm text-zinc-400">
                    {formatValue(record.count ?? 0)} events
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState label="Live CO2 signal samples will appear here when CDM-backed modules return them." />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

export function Co2AnalysisTab({
  selectedSource,
  cohortContext,
}: {
  selectedSource: FinnGenSource | null;
  cohortContext: {
    co2CohortContext: Record<string, unknown> | null;
    cohortLabel: string;
    outcomeName: string;
  };
}) {
  const queryClient = useQueryClient();
  const selectedSourceId = selectedSource?.id ?? null;

  // ── Form state ──────────────────────────────────────────────────────
  const [moduleKey, setModuleKey] = useState("comparative_effectiveness");
  const [cohortLabel, setCohortLabel] = useState(
    cohortContext.cohortLabel || "Acumenus diabetes cohort",
  );
  const [outcomeName, setOutcomeName] = useState(
    cohortContext.outcomeName || "Heart failure",
  );
  const [comparatorLabel, setComparatorLabel] = useState(
    "Standard care comparator",
  );
  const [sensitivityLabel, setSensitivityLabel] = useState(
    "Sensitivity exposure",
  );
  const [burdenDomain, setBurdenDomain] = useState<
    (typeof burdenDomainOptions)[number]["value"]
  >("condition_occurrence");
  const [exposureWindow, setExposureWindow] = useState<
    (typeof exposureWindowOptions)[number]["value"]
  >("90 days");
  const [stratifyBy, setStratifyBy] = useState<
    (typeof stratifyByOptions)[number]["value"]
  >("sex");
  const [timeWindowUnit, setTimeWindowUnit] = useState<
    (typeof timeWindowUnitOptions)[number]["value"]
  >("months");
  const [timeWindowCount, setTimeWindowCount] = useState("3");
  const [gwasTrait, setGwasTrait] = useState("Type 2 diabetes");
  const [gwasMethod, setGwasMethod] = useState<
    (typeof gwasMethodOptions)[number]["value"]
  >("regenie");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [compareRunId, setCompareRunId] = useState<number | null>(null);

  // ── Sync from parent cohort context ─────────────────────────────────
  useEffect(() => {
    if (cohortContext.cohortLabel) {
      setCohortLabel(cohortContext.cohortLabel);
    }
    if (cohortContext.outcomeName) {
      setOutcomeName(cohortContext.outcomeName);
    }
  }, [cohortContext.cohortLabel, cohortContext.outcomeName]);

  // ── Module-key defaults ─────────────────────────────────────────────
  useEffect(() => {
    if (
      moduleKey === "comparative_effectiveness" ||
      moduleKey === "codewas_preview"
    ) {
      setOutcomeName((current) => current || "Heart failure");
      setComparatorLabel((current) => current || "Standard care comparator");
      setSensitivityLabel((current) => current || "Sensitivity exposure");
      return;
    }

    if (moduleKey === "timecodewas_preview") {
      setOutcomeName((current) => current || "Phenotype trajectory");
      setTimeWindowUnit((current) => current || "months");
      setTimeWindowCount((current) => current || "3");
      return;
    }

    if (moduleKey === "condition_burden") {
      setBurdenDomain((current) => current || "condition_occurrence");
      return;
    }

    if (moduleKey === "cohort_demographics_preview") {
      setStratifyBy((current) => current || "age_band");
      setOutcomeName((current) => current || "Cohort demographics");
      return;
    }

    if (moduleKey === "drug_utilization") {
      setExposureWindow((current) => current || "90 days");
      setOutcomeName((current) => current || "Drug utilization");
      return;
    }

    if (moduleKey === "gwas_preview") {
      setOutcomeName((current) => current || "Genome-wide association");
      setGwasTrait((current) => current || "Type 2 diabetes");
      setGwasMethod((current) => current || "regenie");
      return;
    }

    setStratifyBy((current) => current || "sex");
  }, [moduleKey]);

  // ── Run history queries ─────────────────────────────────────────────
  const runsQuery = useQuery({
    queryKey: ["finngen-runs", "finngen_co2_analysis", selectedSourceId],
    queryFn: () =>
      fetchFinnGenRuns({
        service_name: "finngen_co2_analysis",
        source_id: selectedSourceId ?? undefined,
        limit: 8,
      }),
    enabled: Boolean(selectedSourceId),
  });

  const runDetailQuery = useQuery({
    queryKey: ["finngen-run", selectedRunId],
    queryFn: () => fetchFinnGenRun(selectedRunId as number),
    enabled: Boolean(selectedRunId),
  });

  const compareRunDetailQuery = useQuery({
    queryKey: ["finngen-run-compare", compareRunId],
    queryFn: () => fetchFinnGenRun(compareRunId as number),
    enabled: Boolean(compareRunId),
  });

  useEffect(() => {
    setSelectedRunId(null);
    setCompareRunId(null);
  }, [selectedSourceId]);

  useEffect(() => {
    const runs = runsQuery.data ?? [];
    if (!runs.length) return;
    setSelectedRunId((current) =>
      runs.some((run) => run.id === current) ? current : runs[0]?.id ?? null,
    );
  }, [runsQuery.data]);

  // ── Mutation ────────────────────────────────────────────────────────
  const replayRunMutation = useMutation({
    mutationFn: (runId: number) => replayFinnGenRun(runId),
    onSuccess: async (run) => {
      await queryClient.invalidateQueries({
        queryKey: ["finngen-runs", "finngen_co2_analysis", selectedSourceId],
      });
      if (run?.id) {
        setSelectedRunId(run.id);
        setCompareRunId(null);
        queryClient.invalidateQueries({ queryKey: ["finngen-run", run.id] });
      }
    },
  });

  const co2Mutation = useMutation({
    mutationFn: () =>
      previewFinnGenCo2Analysis({
        source: requireSource(selectedSource),
        module_key: moduleKey,
        cohort_label: cohortLabel,
        outcome_name: outcomeName,
        cohort_context: cohortContext.co2CohortContext ?? undefined,
        comparator_label: comparatorLabel,
        sensitivity_label: sensitivityLabel,
        burden_domain: burdenDomain,
        exposure_window: exposureWindow,
        stratify_by: stratifyBy,
        time_window_unit: timeWindowUnit,
        time_window_count: Number.parseInt(timeWindowCount, 10) || 3,
        gwas_trait: gwasTrait,
        gwas_method: gwasMethod,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["finngen-runs", "finngen_co2_analysis", selectedSourceId],
      });
    },
  });

  const data = co2Mutation.data;
  const loading = co2Mutation.isPending;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Lead: controls ───────────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
        <FormField label="Module key">
          <select
            value={moduleKey}
            onChange={(e) => setModuleKey(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
          >
            {moduleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Cohort label">
          <input
            value={cohortLabel}
            onChange={(e) => setCohortLabel(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
          />
        </FormField>

        <FormField label="Outcome name">
          <input
            value={outcomeName}
            onChange={(e) => setOutcomeName(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
          />
        </FormField>

        {/* Module-specific fields */}
        {moduleKey === "comparative_effectiveness" ||
        moduleKey === "codewas_preview" ? (
          <>
            <FormField label="Comparator label">
              <input
                value={comparatorLabel}
                onChange={(e) => setComparatorLabel(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
              />
            </FormField>
            <FormField label="Sensitivity label">
              <input
                value={sensitivityLabel}
                onChange={(e) => setSensitivityLabel(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
              />
            </FormField>
          </>
        ) : null}

        {moduleKey === "timecodewas_preview" ? (
          <>
            <FormField label="Time window count">
              <input
                value={timeWindowCount}
                onChange={(e) => setTimeWindowCount(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
              />
            </FormField>
            <FormField label="Time window unit">
              <select
                value={timeWindowUnit}
                onChange={(e) =>
                  setTimeWindowUnit(
                    e.target.value as (typeof timeWindowUnitOptions)[number]["value"],
                  )
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
              >
                {timeWindowUnitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          </>
        ) : null}

        {moduleKey === "cohort_demographics_preview" ? (
          <FormField label="Stratify by">
            <select
              value={stratifyBy}
              onChange={(e) => setStratifyBy(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            >
              {stratifyByOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}

        {moduleKey === "condition_burden" ? (
          <FormField label="Burden domain">
            <select
              value={burdenDomain}
              onChange={(e) =>
                setBurdenDomain(
                  e.target.value as (typeof burdenDomainOptions)[number]["value"],
                )
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            >
              {burdenDomainOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}

        {moduleKey === "drug_utilization" ? (
          <FormField label="Exposure window">
            <select
              value={exposureWindow}
              onChange={(e) =>
                setExposureWindow(
                  e.target.value as (typeof exposureWindowOptions)[number]["value"],
                )
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            >
              {exposureWindowOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}

        {moduleKey === "gwas_preview" ? (
          <>
            <FormField label="GWAS trait">
              <input
                value={gwasTrait}
                onChange={(e) => setGwasTrait(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
              />
            </FormField>
            <FormField label="GWAS method">
              <select
                value={gwasMethod}
                onChange={(e) =>
                  setGwasMethod(
                    e.target.value as (typeof gwasMethodOptions)[number]["value"],
                  )
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
              >
                {gwasMethodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          </>
        ) : null}

        {moduleKey === "sex_stratified_preview" ? (
          <FormField label="Stratify by">
            <select
              value={stratifyBy}
              onChange={(e) =>
                setStratifyBy(
                  e.target.value as (typeof stratifyByOptions)[number]["value"],
                )
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            >
              {stratifyByOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}

        {/* Cohort context info badge */}
        {cohortContext.co2CohortContext ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#2DD4BF]/20 bg-[#2DD4BF]/5 px-3 py-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2DD4BF]" />
            <div className="text-sm text-[#7CE8D5]">
              <span className="font-medium">Received from Cohort Ops</span>
              <span className="ml-2 text-zinc-400">
                {Object.keys(cohortContext.co2CohortContext).length} keys
                {typeof (cohortContext.co2CohortContext as Record<string, unknown>)
                  .person_count === "number"
                  ? ` · ${formatValue(
                      (cohortContext.co2CohortContext as Record<string, unknown>)
                        .person_count,
                    )} persons`
                  : ""}
              </span>
            </div>
          </div>
        ) : null}

        <ActionButton
          label="Run Module Preview"
          onClick={() => co2Mutation.mutate()}
          loading={loading}
          disabled={!selectedSource}
        />
        {co2Mutation.isError ? (
          <ErrorBanner message={getErrorMessage(co2Mutation.error)} />
        ) : null}
      </div>

      {/* ── Pre-run empty state ──────────────────────────────────────── */}
      {!data && !loading ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-6 py-10 text-center text-sm text-zinc-500">
          Select a module and click Run to see analysis results.
        </div>
      ) : null}

      {/* ── Result panels (only when data exists) ────────────────────── */}
      <ResultSection title="Derived Cohort Context" data={data?.cohort_context ?? cohortContext.co2CohortContext} loading={loading}>
        {data?.cohort_context ? (
          <KeyValueGrid data={data.cohort_context} />
        ) : cohortContext.co2CohortContext ? (
          <KeyValueGrid data={cohortContext.co2CohortContext} />
        ) : null}
      </ResultSection>

      <ResultSection title="Module Setup" data={data?.module_setup} loading={loading}>
        <KeyValueGrid data={data?.module_setup ?? {}} />
      </ResultSection>

      <ResultSection title="Analysis Summary" data={data} loading={loading}>
        <KeyValueGrid data={data?.analysis_summary ?? {}} />
      </ResultSection>

      <ResultSection title="Handoff Impact" data={data?.handoff_impact?.length} loading={loading}>
        {data ? (
          <Co2FamilyEvidenceView
            result={{
              ...data,
              family_evidence: data.handoff_impact ?? [],
            }}
          />
        ) : null}
      </ResultSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <ResultSection title="Family Evidence" data={data?.family_evidence?.length} loading={loading}>
          <Co2FamilyEvidenceView result={data!} />
        </ResultSection>
        <ResultSection title="Family Notes" data={data?.family_notes?.length} loading={loading}>
          <Co2FamilyNotesView result={data!} />
        </ResultSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ResultSection title="Family Result Summary" data={data?.family_result_summary} loading={loading}>
          <KeyValueGrid data={data?.family_result_summary ?? {}} />
        </ResultSection>
        <ResultSection title="Family Result Table" data={data?.result_table?.length} loading={loading}>
          <RecordTable rows={data?.result_table ?? []} />
        </ResultSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ResultSection title="Family Spotlight" data={data?.family_spotlight?.length} loading={loading}>
          <Co2SpotlightView result={data!} />
        </ResultSection>
        <ResultSection title="Family Segments" data={data?.family_segments?.length} loading={loading}>
          <Co2SegmentsView result={data!} />
        </ResultSection>
      </div>

      <ResultSection title="Forest Plot" data={data?.forest_plot?.length} loading={loading}>
        <ForestPlotView result={data!} />
      </ResultSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <ResultSection title="Module Gallery" data={data?.module_gallery?.length} loading={loading}>
          <ModuleGalleryView result={data!} />
        </ResultSection>
        <ResultSection title="Heatmap" data={data?.heatmap?.length} loading={loading}>
          <HeatmapView result={data!} />
        </ResultSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ResultSection title="Subgroup Balance" data={data?.heatmap?.length} loading={loading}>
          <SubgroupBalanceView result={data!} />
        </ResultSection>
        <ResultSection title="Phenotype Scoring Lens" data={data?.top_signals?.length} loading={loading}>
          <PhenotypeScoringView result={data!} />
        </ResultSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ResultSection title="Module Validation" data={data?.module_validation?.length} loading={loading}>
          <StatusListView items={data?.module_validation ?? []} />
        </ResultSection>
        <ResultSection title="Overlap Matrix" data={data?.overlap_matrix?.length} loading={loading}>
          <OverlapMatrixView result={data!} />
        </ResultSection>
      </div>

      <ResultSection title="Time Profile" data={data?.time_profile?.length} loading={loading}>
        <TimeProfileView result={data!} />
      </ResultSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <ResultSection title="Subgroup Summary" data={data?.subgroup_summary?.length} loading={loading}>
          <LabelValueList items={data?.subgroup_summary ?? []} />
        </ResultSection>
        <ResultSection title="Temporal Windows" data={data?.temporal_windows?.length} loading={loading}>
          <TemporalWindowsView result={data!} />
        </ResultSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ResultSection title="Utilization Trend" data={data?.utilization_trend?.length} loading={loading}>
          <TrendView result={data!} />
        </ResultSection>
        <ResultSection title="Top Signals" data={data?.top_signals?.length} loading={loading}>
          <TopSignalsView result={data!} />
        </ResultSection>
      </div>

      <ResultSection title="Plausibility Sample" data={data} loading={loading}>
        <Co2PlausibilityView result={data!} />
      </ResultSection>

      <ResultSection title="Execution Timeline" data={data?.execution_timeline?.length} loading={loading}>
        <ExecutionTimelineView result={data!} />
      </ResultSection>

      {/* ── Run History (bottom, collapsible) ─────────────────────────── */}
      <CollapsibleSection title="Run History">
        <div className="space-y-4">
          {runsQuery.isLoading ? (
            <EmptyState label="Loading run history..." />
          ) : runsQuery.data?.length ? (
            <>
              <RecentRunsView
                runs={runsQuery.data}
                selectedRunId={selectedRunId}
                onSelect={setSelectedRunId}
              />
              {runDetailQuery.isLoading ? (
                <EmptyState label="Loading run details..." />
              ) : runDetailQuery.data ? (
                <RunInspectorView
                  run={runDetailQuery.data}
                  onReplay={() =>
                    replayRunMutation.mutate(runDetailQuery.data?.id ?? 0)
                  }
                  onExport={async () => {
                    const bundle = await exportFinnGenRun(
                      runDetailQuery.data?.id ?? 0,
                    );
                    if (bundle) {
                      downloadJson(
                        `finngen-run-${runDetailQuery.data?.id}-bundle.json`,
                        bundle,
                      );
                    }
                  }}
                  replaying={replayRunMutation.isPending}
                />
              ) : (
                <EmptyState label="Select a persisted run to inspect its request, runtime, artifacts, and stored result payload." />
              )}
              {runDetailQuery.data ? (
                <RunComparisonPanel
                  runs={runsQuery.data}
                  selectedRun={runDetailQuery.data}
                  compareRun={compareRunDetailQuery.data}
                  compareRunId={compareRunId}
                  onCompareRunChange={setCompareRunId}
                />
              ) : null}
            </>
          ) : (
            <EmptyState label="Run history for CO2 modules will appear here once executions are persisted." />
          )}
        </div>
      </CollapsibleSection>

      {/* ── Diagnostics (bottom, collapsible) ─────────────────────────── */}
      <CollapsibleSection title="Diagnostics">
        <RuntimePanel runtime={data?.runtime} />
        {!data?.runtime ? (
          <EmptyState label="Runtime diagnostics will appear here after a module preview is executed." />
        ) : null}
      </CollapsibleSection>
    </div>
  );
}
