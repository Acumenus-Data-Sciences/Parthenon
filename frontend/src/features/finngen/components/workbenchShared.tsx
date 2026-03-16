/**
 * Shared constants, utility functions, and small presentation components
 * used across all four FINNGEN workbench tab components.
 */
import type React from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type {
  FinnGenArtifact,
  FinnGenCo2AnalysisResult,
  FinnGenCohortOperationsResult,
  FinnGenHadesExtrasResult,
  FinnGenMetricPoint,
  FinnGenRomopapiResult,
  FinnGenRun,
  FinnGenRuntime,
  FinnGenSource,
  FinnGenTimelineStep,
} from "../types";

// ── Service name type ────────────────────────────────────────────────

export type ServiceName =
  | "finngen_romopapi"
  | "finngen_hades_extras"
  | "finngen_cohort_operations"
  | "finngen_co2_analysis";

// ── Option arrays ────────────────────────────────────────────────────

export const cohortPresets = [
  {
    label: "Condition cohort",
    value: JSON.stringify(
      {
        conceptSets: [{ id: 1, name: "Target conditions", expression: { items: [] } }],
        PrimaryCriteria: {
          CriteriaList: [{ ConditionOccurrence: { CodesetId: 1, ConditionTypeExclude: false } }],
          ObservationWindow: { PriorDays: 0, PostDays: 0 },
        },
        AdditionalCriteria: { CriteriaList: [] },
        QualifiedLimit: { Type: "First" },
        ExpressionLimit: { Type: "First" },
      },
      null,
      2,
    ),
  },
  {
    label: "Drug exposure cohort",
    value: JSON.stringify(
      {
        conceptSets: [{ id: 1, name: "Target drugs", expression: { items: [] } }],
        PrimaryCriteria: {
          CriteriaList: [{ DrugExposure: { CodesetId: 1, DrugTypeExclude: false } }],
          ObservationWindow: { PriorDays: 30, PostDays: 0 },
        },
        AdditionalCriteria: { CriteriaList: [] },
        QualifiedLimit: { Type: "All" },
        ExpressionLimit: { Type: "All" },
      },
      null,
      2,
    ),
  },
] as const;

export const moduleOptions = [
  { value: "comparative_effectiveness", label: "Comparative effectiveness" },
  { value: "codewas_preview", label: "CodeWAS preview" },
  { value: "timecodewas_preview", label: "timeCodeWAS preview" },
  { value: "condition_burden", label: "Condition burden" },
  { value: "cohort_demographics_preview", label: "Cohort demographics" },
  { value: "drug_utilization", label: "Drug utilization" },
  { value: "gwas_preview", label: "GWAS preview" },
  { value: "sex_stratified_preview", label: "Sex stratified preview" },
] as const;

export const burdenDomainOptions = [
  { value: "condition_occurrence", label: "Condition occurrence" },
  { value: "procedure_occurrence", label: "Procedure occurrence" },
  { value: "drug_exposure", label: "Drug exposure" },
] as const;

export const exposureWindowOptions = [
  { value: "30 days", label: "30 days" },
  { value: "90 days", label: "90 days" },
  { value: "180 days", label: "180 days" },
  { value: "365 days", label: "365 days" },
] as const;

export const stratifyByOptions = [
  { value: "sex", label: "Sex" },
  { value: "age_band", label: "Age band" },
  { value: "care_site", label: "Care site" },
] as const;

export const timeWindowUnitOptions = [
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
] as const;

export const gwasMethodOptions = [
  { value: "regenie", label: "Regenie preview" },
  { value: "logistic", label: "Logistic scan" },
  { value: "linear", label: "Linear scan" },
] as const;

export const queryTemplates = [
  "condition_occurrence -> person -> observation_period",
  "drug_exposure -> person -> visit_occurrence",
  "measurement -> person -> concept",
] as const;

export const romopapiDomainOptions = [
  { value: "all", label: "All domains" },
  { value: "Condition", label: "Condition" },
  { value: "Drug", label: "Drug" },
  { value: "Measurement", label: "Measurement" },
] as const;

export const romopapiStratifyOptions = [
  { value: "overall", label: "Overall" },
  { value: "age_band", label: "Age band" },
  { value: "sex", label: "Sex" },
  { value: "care_site", label: "Care site" },
] as const;

export const romopapiLimitOptions = [10, 25, 50, 100] as const;
export const romopapiLineageDepthOptions = [2, 3, 4, 5] as const;

export const romopapiRequestMethodOptions = [
  { value: "POST", label: "POST" },
  { value: "GET", label: "GET" },
] as const;

export const romopapiResponseFormatOptions = [
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV" },
  { value: "html", label: "HTML" },
] as const;

export const romopapiCacheModeOptions = [
  { value: "memoized_preview", label: "Memoized preview" },
  { value: "refresh", label: "Refresh cache" },
  { value: "bypass", label: "Bypass cache" },
] as const;

export const romopapiReportFormatOptions = [
  { value: "markdown_html", label: "Markdown + HTML" },
  { value: "markdown", label: "Markdown only" },
  { value: "html", label: "HTML only" },
] as const;

export const hadesConfigProfiles = [
  { value: "acumenus_default", label: "Acumenus default" },
  { value: "cohort_generation", label: "Cohort generation" },
  { value: "analysis_bundle", label: "Analysis bundle" },
] as const;

export const hadesArtifactModes = [
  { value: "sql_only", label: "SQL only" },
  { value: "sql_and_manifest", label: "SQL + manifest" },
  { value: "full_bundle", label: "Full bundle" },
] as const;

export const hadesPackageSkeletons = [
  { value: "ohdsi_study", label: "OHDSI study" },
  { value: "lightweight_sql", label: "Lightweight SQL" },
  { value: "finngen_extension", label: "FINNGEN extension" },
] as const;

export const defaultHadesYaml = [
  "package:",
  "  name: AcumenusFinnGenPackage",
  "  profile: acumenus_default",
  "render:",
  "  target: postgresql",
  "  artifact_mode: full_bundle",
  "cohort:",
  "  table: results.cohort",
  "  results_schema: results",
].join("\n");

export const cohortImportModes = [
  { value: "parthenon", label: "Parthenon cohorts" },
  { value: "atlas", label: "Atlas/WebAPI" },
  { value: "cohort_table", label: "Cohort table" },
  { value: "json", label: "JSON definition" },
] as const;

export const cohortOperationTypes = [
  { value: "union", label: "Union" },
  { value: "intersect", label: "Intersect" },
  { value: "subtract", label: "Subtract" },
] as const;

export const cohortMatchingStrategies = [
  { value: "nearest-neighbor", label: "Nearest neighbor" },
  { value: "exact", label: "Exact matching" },
  { value: "stratified", label: "Stratified preview" },
] as const;

export const cohortMatchingTargets = [
  { value: "primary_vs_comparators", label: "Primary vs comparators" },
  { value: "pairwise_balance", label: "Pairwise balance" },
] as const;

export const defaultMatchingCovariates = ["age", "sex", "index year"] as const;

// ── Utility functions ────────────────────────────────────────────────

export function getSchemaQualifier(
  source: FinnGenSource | null | undefined,
  daimonType: string,
): string {
  return (
    source?.daimons?.find((item) => item.daimon_type === daimonType)
      ?.table_qualifier ?? ""
  );
}

export function safeParseJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function requireSource(source: FinnGenSource | null): FinnGenSource {
  if (!source) throw new Error("A source must be selected.");
  return source;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Preview failed.";
}

export function humanizeKey(value: string): string {
  return value.replaceAll("_", " ");
}

export function formatValue(value: unknown): string {
  if (Array.isArray(value))
    return value.map((item) => formatValue(item)).join(", ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  if (typeof value === "number")
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(3);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value ?? "");
}

export function flattenRecord(
  record: Record<string, unknown>,
  prefix = "",
): Record<string, unknown> {
  return Object.entries(record).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      const nextKey = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(
          acc,
          flattenRecord(value as Record<string, unknown>, nextKey),
        );
        return acc;
      }
      acc[nextKey] = value;
      return acc;
    },
    {},
  );
}

export function toLabeledNumbers(
  value: unknown,
  metricKey: string,
  countEntries = false,
  labelKey = "label",
): Record<string, number> {
  if (!Array.isArray(value)) return {};
  return value.reduce<Record<string, number>>((acc, item, index) => {
    if (!item || typeof item !== "object") return acc;
    const record = item as Record<string, unknown>;
    const label = String(
      record[labelKey] ?? record.stage ?? `Item ${index + 1}`,
    );
    if (countEntries) {
      acc[label] = 1;
      return acc;
    }
    const metric = record[metricKey];
    acc[label] = typeof metric === "number" ? metric : Number(metric ?? 0);
    return acc;
  }, {});
}

export function parseIntegerList(value: string): number[] {
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

export function parseStringList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function collectSqlSubstitutions(
  template: string,
  rendered: string,
): string[] {
  const substitutions: string[] = [];
  const templateMatches = template.match(/@[a-z_]+/gi) ?? [];
  for (const match of templateMatches) {
    const normalized = match.replace("@", "");
    if (!rendered.includes(match))
      substitutions.push(
        `${match} -> resolved in rendered SQL (${normalized})`,
      );
  }
  return substitutions;
}

export function downloadJson(filename: string, payload: unknown): void {
  downloadText(filename, JSON.stringify(payload, null, 2), "application/json");
}

export function downloadText(
  filename: string,
  content: string,
  type = "text/plain",
): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// ── Shared presentation components ───────────────────────────────────

export function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export function ActionButton({
  label,
  onClick,
  loading,
  disabled,
}: {
  label: string;
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#9B1B30]/80 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {label}
    </button>
  );
}

export function ResultPanel({
  title,
  loading,
  children,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-3 text-sm font-medium text-white">{title}</div>
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Running preview...
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/** Only renders when `data` is truthy — eliminates empty placeholder panels. */
export function ResultSection({
  title,
  data,
  loading,
  children,
}: {
  title: string;
  data: unknown;
  loading: boolean;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="mb-3 text-sm font-medium text-white">{title}</div>
        <div className="flex items-center gap-2 py-4 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Running...
        </div>
      </div>
    );
  }
  if (!data) return null;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-3 text-sm font-medium text-white">{title}</div>
      {children}
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return <div className="py-8 text-sm text-zinc-500">{label}</div>;
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/10 px-3 py-2 text-sm text-[#F0EDE8]">
      {message}
    </div>
  );
}

export function KeyValueGrid({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  if (entries.length === 0)
    return <EmptyState label="No details were returned for this run." />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"
        >
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            {humanizeKey(key)}
          </div>
          <div className="mt-2 text-sm font-medium text-zinc-100">
            {formatValue(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecordTable({
  rows,
}: {
  rows: Array<Record<string, unknown>>;
}) {
  if (rows.length === 0) return <EmptyState label="No rows were returned." />;
  const columns = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row))),
  ).slice(0, 8);
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/70">
      <table className="min-w-full divide-y divide-zinc-800 text-left text-sm text-zinc-300">
        <thead className="bg-zinc-900/70 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 font-semibold">
                {humanizeKey(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td
                  key={col}
                  className="px-3 py-2 align-top text-zinc-300"
                >
                  {formatValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LabelValueList({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3"
        >
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            {item.label}
          </div>
          <div className="mt-1 text-sm font-medium text-zinc-100">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatusListView({
  items,
}: {
  items: Array<{ label: string; status: string; detail: string }>;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={`${item.label}-${item.status}`}
          className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-100">
              {item.label}
            </div>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                item.status === "ready"
                  ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
                  : item.status === "review"
                    ? "bg-[#C9A227]/15 text-[#F3D97A]"
                    : "bg-zinc-800 text-zinc-300"
              }`}
            >
              {item.status}
            </span>
          </div>
          <div className="mt-1 text-sm text-zinc-400">{item.detail}</div>
        </div>
      ))}
    </div>
  );
}

export function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-zinc-100">{value}</div>
    </div>
  );
}

export function ProgressRow({
  label,
  value,
  total,
  color,
  suffix,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  suffix?: string;
}) {
  const width = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-zinc-200">{label}</span>
        <span className="text-zinc-500">
          {value.toLocaleString()}
          {suffix ? ` · ${suffix}` : ""}
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800">
        <div
          className="h-2 rounded-full"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function CodeBlock({
  title,
  code,
}: {
  title: string;
  code: string;
}) {
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
        {title}
      </div>
      <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function JsonPreview({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  return <CodeBlock title={title} code={JSON.stringify(value, null, 2)} />;
}

export function RuntimePanel({ runtime }: { runtime?: FinnGenRuntime }) {
  if (!runtime) return null;

  const accentClass =
    runtime.mode === "parthenon_native"
      ? "border-[#C9A227]/30 bg-[#C9A227]/10 text-[#F3D97A]"
      : "border-[#2DD4BF]/30 bg-[#2DD4BF]/10 text-[#7CE8D5]";

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white">Runtime Path</div>
          <div className="mt-1 text-sm text-zinc-400">
            {runtime.mode_label}
          </div>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${accentClass}`}
        >
          {runtime.fallback_active ? "Fallback Active" : "Adapter Configured"}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <RuntimeMetric
          label="Mode"
          value={runtime.mode.replaceAll("_", " ")}
        />
        <RuntimeMetric
          label="Adapter"
          value={
            runtime.adapter_configured ? "Configured" : "Not configured"
          }
        />
        <RuntimeMetric
          label="Capabilities"
          value={String(
            Object.values(runtime.capabilities ?? {}).filter(Boolean).length,
          )}
        />
      </div>
    </div>
  );
}

export function RuntimeMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium capitalize text-zinc-100">
        {value}
      </div>
    </div>
  );
}

export function ArtifactList({
  artifacts,
}: {
  artifacts: Array<Record<string, unknown>>;
}) {
  return (
    <div className="space-y-2">
      {artifacts.map((artifact, index) => (
        <div
          key={`${String(artifact.name ?? "artifact")}-${index}`}
          className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-100">
              {String(artifact.name ?? "Artifact")}
            </div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {String(artifact.type ?? "file")}
            </div>
          </div>
          {"summary" in artifact ? (
            <div className="mt-1 text-sm text-zinc-400">
              {String(artifact.summary ?? "")}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function PlausibilityBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn";
}) {
  const styles =
    tone === "good"
      ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/10 text-[#D8FFF6]"
      : "border-[#C9A227]/30 bg-[#C9A227]/10 text-[#F6E7A5]";
  return (
    <div className={`rounded-lg border p-3 ${styles}`}>
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

// ── Run Inspector shared components ──────────────────────────────────

export function RecentRunsView({
  runs,
  selectedRunId,
  onSelect,
}: {
  runs: FinnGenRun[];
  selectedRunId: number | null;
  onSelect: (runId: number) => void;
}) {
  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <button
          key={run.id}
          type="button"
          onClick={() => onSelect(run.id)}
          className={`block w-full rounded-lg border p-4 text-left transition-colors ${
            run.id === selectedRunId
              ? "border-[#9B1B30]/50 bg-[#9B1B30]/10"
              : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-700"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-zinc-100">
                Run #{run.id}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {String(run.source.source_key ?? "source")} ·{" "}
                {run.submitted_at
                  ? formatTimestamp(run.submitted_at)
                  : "Pending timestamp"}
              </div>
            </div>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/15 text-[#2DD4BF]">
              {run.status}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

export function RunInspectorView({
  run,
  onReplay,
  onExport,
  replaying,
}: {
  run: FinnGenRun;
  onReplay: () => void;
  onExport: () => void;
  replaying: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onExport}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:text-white"
        >
          Export Bundle
        </button>
        <button
          type="button"
          onClick={onReplay}
          disabled={replaying}
          className="inline-flex items-center gap-2 rounded-lg border border-[#9B1B30]/30 bg-[#9B1B30]/10 px-3 py-2 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]/20 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {replaying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Replay Run
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <MiniMetric label="Run" value={`#${run.id}`} />
        <MiniMetric
          label="Status"
          value={String(run.status ?? "unknown")}
        />
        <MiniMetric
          label="Submitted"
          value={
            run.submitted_at
              ? formatTimestamp(run.submitted_at)
              : "n/a"
          }
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
              Source Snapshot
            </div>
            <KeyValueGrid data={run.source ?? {}} />
          </div>
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
              Summary
            </div>
            <KeyValueGrid data={run.summary ?? {}} />
          </div>
        </div>
        <div className="space-y-4">
          <JsonPreview
            title="Stored Request"
            value={run.request_payload ?? {}}
          />
          <JsonPreview
            title="Stored Result"
            value={run.result_payload ?? {}}
          />
        </div>
      </div>
    </div>
  );
}

export function RunComparisonPanel({
  runs,
  selectedRun,
  compareRun,
  compareRunId,
  onCompareRunChange,
}: {
  runs: FinnGenRun[];
  selectedRun: FinnGenRun;
  compareRun: FinnGenRun | null | undefined;
  compareRunId: number | null;
  onCompareRunChange: (runId: number | null) => void;
}) {
  const compareCandidates = runs.filter(
    (run) => run.id !== selectedRun.id,
  );

  return (
    <div className="space-y-4">
      {compareCandidates.length ? (
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Compare Against
          </span>
          <select
            value={compareRunId ?? ""}
            onChange={(event) =>
              onCompareRunChange(
                event.target.value ? Number(event.target.value) : null,
              )
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
          >
            <option value="">Choose a prior run</option>
            {compareCandidates.map((run) => (
              <option key={run.id} value={run.id}>
                Run #{run.id} ·{" "}
                {run.submitted_at
                  ? formatTimestamp(run.submitted_at)
                  : "No timestamp"}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <EmptyState label="At least two persisted runs for the active tool and source are required for comparison." />
      )}

      {compareRun ? (
        <RunComparisonView left={selectedRun} right={compareRun} />
      ) : compareCandidates.length ? (
        <EmptyState label="Choose a second run to inspect summary and result deltas." />
      ) : null}
    </div>
  );
}

function RunComparisonView({
  left,
  right,
}: {
  left: FinnGenRun;
  right: FinnGenRun;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-[#9B1B30]/40 bg-[#9B1B30]/10 p-4">
          <div className="text-xs uppercase tracking-wide text-[#E85A6B]">
            Primary
          </div>
          <div className="mt-1 text-sm font-medium text-zinc-100">
            Run #{left.id}
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            {left.submitted_at
              ? formatTimestamp(left.submitted_at)
              : "No timestamp"}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Comparison
          </div>
          <div className="mt-1 text-sm font-medium text-zinc-100">
            Run #{right.id}
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            {right.submitted_at
              ? formatTimestamp(right.submitted_at)
              : "No timestamp"}
          </div>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">
            Summary Delta
          </div>
          <ComparisonTable
            left={left.summary ?? {}}
            right={right.summary ?? {}}
          />
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">
            Runtime Delta
          </div>
          <ComparisonTable
            left={flattenRecord(left.runtime ?? {})}
            right={flattenRecord(right.runtime ?? {})}
          />
        </div>
      </div>
    </div>
  );
}

export function ComparisonTable({
  left,
  right,
}: {
  left: Record<string, unknown>;
  right: Record<string, unknown>;
}) {
  const keys = Array.from(
    new Set([...Object.keys(left), ...Object.keys(right)]),
  ).sort();
  if (!keys.length)
    return (
      <EmptyState label="No comparable fields were stored for these runs." />
    );
  return (
    <div className="space-y-2">
      {keys.map((key) => (
        <div
          key={key}
          className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
        >
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            {humanizeKey(key)}
          </div>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            <div className="text-sm text-zinc-300">
              {formatValue(left[key]) || "n/a"}
            </div>
            <div className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
              vs
            </div>
            <div className="text-sm text-zinc-100">
              {formatValue(right[key]) || "n/a"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
