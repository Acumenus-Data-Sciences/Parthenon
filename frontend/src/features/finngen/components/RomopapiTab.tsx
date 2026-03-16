import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  FinnGenRomopapiResult,
  FinnGenSource,
} from "../types";
import {
  exportFinnGenRun,
  fetchFinnGenRun,
  fetchFinnGenRuns,
  previewFinnGenRomopapi,
  replayFinnGenRun,
} from "../api";
import {
  FormField,
  ActionButton,
  ResultSection,
  KeyValueGrid,
  RecordTable,
  LabelValueList,
  ProgressRow,
  EmptyState,
  ErrorBanner,
  RuntimePanel,
  RecentRunsView,
  RunInspectorView,
  RunComparisonPanel,
  PlausibilityBadge,
  CodeBlock,
  MiniMetric,
  getSchemaQualifier,
  requireSource,
  getErrorMessage,
  formatValue,
  downloadText,
  downloadJson,
  formatTimestamp,
  romopapiDomainOptions,
  romopapiStratifyOptions,
  romopapiLimitOptions,
  romopapiLineageDepthOptions,
  romopapiRequestMethodOptions,
  romopapiResponseFormatOptions,
  romopapiCacheModeOptions,
  romopapiReportFormatOptions,
  queryTemplates,
} from "./workbenchShared";
import { CollapsibleSection } from "./CollapsibleSection";

// ── ROMOPAPI-specific result view components ─────────────────────────

function SchemaNodeView({ result }: { result: FinnGenRomopapiResult }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {result.schema_nodes.map((node) => (
        <div key={node.name} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="text-sm font-medium text-zinc-100">{node.name}</div>
          <div className="mt-1 text-xs text-zinc-500">{node.group} · {node.connections} connections</div>
          {typeof node.estimated_rows === "number" ? (
            <div className="mt-2 text-xs text-zinc-400">
              Estimated rows: {node.estimated_rows.toLocaleString()}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function HierarchyMapView({ result }: { result: FinnGenRomopapiResult }) {
  return (
    <div className="space-y-3">
      {result.lineage_trace.map((item, index) => (
        <div key={item.step} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#60A5FA]/30 bg-[#60A5FA]/10 text-xs font-semibold text-[#93C5FD]">
              {item.step}
            </div>
            {index < result.lineage_trace.length - 1 ? (
              <div className="mt-1 h-8 w-px bg-zinc-800" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <div className="text-sm font-medium text-zinc-100">{item.label}</div>
            <div className="mt-1 text-sm text-zinc-400">{item.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SchemaDensityView({ result }: { result: FinnGenRomopapiResult }) {
  const maxConnections = Math.max(...result.schema_nodes.map((node) => node.connections), 1);

  return (
    <div className="space-y-3">
      {result.schema_nodes.slice(0, 6).map((node) => (
        <div key={node.name}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-zinc-200">{node.name}</span>
            <span className="text-zinc-500">{node.connections} links</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full bg-[#60A5FA]"
              style={{ width: `${(node.connections / maxConnections) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CountSurfaceView({ result }: { result: FinnGenRomopapiResult }) {
  const rows = result.schema_nodes.map((node) => ({
    table: node.name,
    links: node.connections,
    estimated_rows: node.estimated_rows ?? "n/a",
  }));

  return <RecordTable rows={rows} />;
}

function ReportPreviewView({ result }: { result: FinnGenRomopapiResult }) {
  const markdownReport =
    result.report_content?.markdown ??
    [
      "# ROMOPAPI Report",
      "",
      `- Schema scope: ${String(result.metadata_summary.schema_scope ?? "n/a")}`,
      `- Tables surfaced: ${result.schema_nodes.length}`,
      `- Estimated join rows: ${String(result.query_plan.estimated_rows ?? "n/a")}`,
      `- Primary path: ${String(result.query_plan.template ?? "n/a")}`,
    ].join("\n");
  const htmlReport = result.report_content?.html;
  const manifest = Array.isArray(result.report_content?.manifest) ? result.report_content.manifest : [];
  const reportBundle = result.report_bundle ?? {};

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
        <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Report snapshot</div>
        <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-300">{markdownReport}</pre>
      </div>
      {manifest.length ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
          <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Report manifest</div>
          <div className="space-y-2">
            {manifest.map((item) => (
              <div key={item.name} className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                <div className="text-sm font-medium text-zinc-100">{item.name}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {item.kind}
                  {item.summary ? ` · ${item.summary}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {htmlReport ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
          <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">HTML preview</div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs text-zinc-300">{htmlReport}</pre>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadText("romopapi-report.md", markdownReport)}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-[#60A5FA]/40 hover:text-white"
        >
          Download Markdown Report
        </button>
        {htmlReport ? (
          <button
            type="button"
            onClick={() => downloadText("romopapi-report.html", htmlReport)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-[#60A5FA]/40 hover:text-white"
          >
            Download HTML Report
          </button>
        ) : null}
        {manifest.length ? (
          <button
            type="button"
            onClick={() => downloadJson("romopapi-report-manifest.json", manifest)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-[#60A5FA]/40 hover:text-white"
          >
            Download Manifest
          </button>
        ) : null}
        {Object.keys(reportBundle).length ? (
          <button
            type="button"
            onClick={() =>
              downloadJson(
                String(reportBundle.download_name ?? "romopapi-report-bundle.json"),
                reportBundle,
              )
            }
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-[#60A5FA]/40 hover:text-white"
          >
            Download Bundle Metadata
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => downloadJson("romopapi-result.json", result)}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-[#60A5FA]/40 hover:text-white"
        >
          Download JSON
        </button>
        {result.report_artifacts?.length ? (
          <button
            type="button"
            onClick={() => downloadJson("romopapi-artifacts.json", result.report_artifacts)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-[#60A5FA]/40 hover:text-white"
          >
            Download Artifact Index
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PersistedRomopapiArtifactsView({
  resultPayload,
  exportPayload,
}: {
  resultPayload: Record<string, unknown>;
  exportPayload: Record<string, unknown> | null;
}) {
  const reportBundle =
    resultPayload.report_bundle && typeof resultPayload.report_bundle === "object"
      ? (resultPayload.report_bundle as Record<string, unknown>)
      : {};
  const reportArtifacts = Array.isArray(resultPayload.report_artifacts)
    ? (resultPayload.report_artifacts as Array<Record<string, unknown>>)
    : [];
  const artifactPayloads = Array.isArray(exportPayload?.artifact_payloads)
    ? (exportPayload.artifact_payloads as Array<Record<string, unknown>>)
    : [];
  const artifactPayloadByName = new Map(
    artifactPayloads.map((item) => [String(item.name ?? ""), item]),
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Report Bundle</div>
        {Object.keys(reportBundle).length ? (
          <div className="space-y-4">
            <KeyValueGrid data={reportBundle} />
            <div className="flex flex-wrap gap-2">
              <ActionButton
                label="Download stored bundle"
                onClick={() =>
                  downloadJson(
                    String(reportBundle.download_name ?? "romopapi-report-bundle.json"),
                    reportBundle,
                  )
                }
              />
            </div>
          </div>
        ) : (
          <EmptyState label="No data yet." />
        )}
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Report Artifacts</div>
        {reportArtifacts.length ? (
          <div className="space-y-3">
            <RecordTable rows={reportArtifacts} />
            <div className="space-y-2">
              {reportArtifacts.map((entry) => {
                const name = String(entry.name ?? "artifact");
                const payload = artifactPayloadByName.get(name);
                return (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-100">{name}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {String(entry.summary ?? entry.type ?? "Artifact")}
                      </div>
                    </div>
                    <ActionButton
                      label="Download entry"
                      onClick={() => {
                        if (!payload) return;
                        const blob = new Blob([String(payload.content ?? "")], {
                          type: String(payload.mime_type ?? "application/json"),
                        });
                        const url = URL.createObjectURL(blob);
                        const anchor = document.createElement("a");
                        anchor.href = url;
                        anchor.download = String(
                          payload.download_name ?? payload.name ?? name,
                        );
                        document.body.appendChild(anchor);
                        anchor.click();
                        anchor.remove();
                        URL.revokeObjectURL(url);
                      }}
                      disabled={!payload}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState label="No data yet." />
        )}
      </div>
    </div>
  );
}

function CodeCountsView({ result }: { result: FinnGenRomopapiResult }) {
  return (
    <RecordTable
      rows={(result.code_counts ?? []).map((row) => ({
        concept: row.concept,
        domain: row.domain ?? "n/a",
        stratum: row.stratum ?? "overall",
        count: row.count,
      }))}
    />
  );
}

function StratifiedCountsView({ result }: { result: FinnGenRomopapiResult }) {
  const items = result.stratified_counts ?? [];
  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <ProgressRow
          key={item.label}
          label={item.label}
          value={item.count}
          total={maxCount}
          color="#60A5FA"
          suffix={item.percent != null ? `${Math.round(item.percent * 100)}%` : undefined}
        />
      ))}
    </div>
  );
}

function LineageView({ result }: { result: FinnGenRomopapiResult }) {
  return (
    <div className="space-y-3">
      {result.lineage_trace.map((item) => (
        <div key={item.step} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="text-sm font-medium text-zinc-100">{item.step}. {item.label}</div>
          <div className="mt-1 text-sm text-zinc-400">{item.detail}</div>
        </div>
      ))}
    </div>
  );
}

function ResultProfileView({ result }: { result: FinnGenRomopapiResult }) {
  return (
    <div className="space-y-3">
      {result.result_profile.map((item) => (
        <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-500">{item.label}</div>
          <div className="mt-1 text-sm font-medium text-zinc-100">{item.value}</div>
        </div>
      ))}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
        Planned query: {String(result.query_plan.template ?? "")}
      </div>
    </div>
  );
}

function RomopapiPlausibilityView({ result }: { result: FinnGenRomopapiResult }) {
  const metadataSummary = (result.metadata_summary ?? {}) as Record<string, unknown>;
  const codeCounts = Array.isArray(result.code_counts) ? result.code_counts : [];
  const resultProfile = Array.isArray(result.result_profile) ? result.result_profile : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <PlausibilityBadge
          label="Schema scope"
          value={formatValue(metadataSummary.schema_scope ?? "Unknown")}
          tone={metadataSummary.schema_scope ? "good" : "warn"}
        />
        <PlausibilityBadge
          label="Code counts"
          value={codeCounts.length ? `${codeCounts.length} rows` : "No counts"}
          tone={codeCounts.length ? "good" : "warn"}
        />
        <PlausibilityBadge
          label="Result profile"
          value={resultProfile.length ? `${resultProfile.length} facets` : "No profile"}
          tone={resultProfile.length ? "good" : "warn"}
        />
      </div>
      {codeCounts.length ? (
        <div className="space-y-2">
          {codeCounts.slice(0, 4).map((row, index) => {
            const record = row as Record<string, unknown>;
            return (
              <div key={`${String(record.concept ?? "concept")}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-zinc-100">{String(record.concept ?? "Concept")}</div>
                  <div className="text-sm text-zinc-400">{formatValue(record.count ?? 0)}</div>
                </div>
                <div className="mt-1 text-xs text-zinc-500">{String(record.domain ?? "Domain unavailable")}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState label="No data yet." />
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────

export function RomopapiTab({
  selectedSource,
  onHandoffToHades,
}: {
  selectedSource: FinnGenSource | null;
  onHandoffToHades?: (context: Record<string, unknown>) => void;
}) {
  const queryClient = useQueryClient();
  const selectedSourceId = selectedSource?.id ?? null;

  // ── Local state ──────────────────────────────────────────────────
  const [schemaScope, setSchemaScope] = useState("");
  const [queryTemplate, setQueryTemplate] = useState(
    "condition_occurrence -> person -> observation_period",
  );
  const [conceptDomain, setConceptDomain] =
    useState<(typeof romopapiDomainOptions)[number]["value"]>("all");
  const [romopapiStratifyBy, setRomopapiStratifyBy] =
    useState<(typeof romopapiStratifyOptions)[number]["value"]>("overall");
  const [resultLimit, setResultLimit] =
    useState<(typeof romopapiLimitOptions)[number]>(25);
  const [lineageDepth, setLineageDepth] =
    useState<(typeof romopapiLineageDepthOptions)[number]>(3);
  const [romopapiRequestMethod, setRomopapiRequestMethod] =
    useState<(typeof romopapiRequestMethodOptions)[number]["value"]>("POST");
  const [romopapiResponseFormat, setRomopapiResponseFormat] =
    useState<(typeof romopapiResponseFormatOptions)[number]["value"]>("json");
  const [romopapiCacheMode, setRomopapiCacheMode] =
    useState<(typeof romopapiCacheModeOptions)[number]["value"]>("memoized_preview");
  const [romopapiReportFormat, setRomopapiReportFormat] =
    useState<(typeof romopapiReportFormatOptions)[number]["value"]>("markdown_html");

  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [compareRunId, setCompareRunId] = useState<number | null>(null);

  // ── Initialize schemaScope from source ───────────────────────────
  useEffect(() => {
    if (!selectedSource) return;
    if (!schemaScope) {
      setSchemaScope(getSchemaQualifier(selectedSource, "cdm"));
    }
  }, [schemaScope, selectedSource]);

  // ── Reset run selection when source changes ──────────────────────
  useEffect(() => {
    setSelectedRunId(null);
    setCompareRunId(null);
  }, [selectedSourceId]);

  // ── Mutation ─────────────────────────────────────────────────────
  const romopapiMutation = useMutation({
    mutationFn: () =>
      previewFinnGenRomopapi({
        source: requireSource(selectedSource),
        schema_scope: schemaScope,
        query_template: queryTemplate,
        concept_domain: conceptDomain,
        stratify_by: romopapiStratifyBy,
        result_limit: resultLimit,
        lineage_depth: lineageDepth,
        request_method: romopapiRequestMethod,
        response_format: romopapiResponseFormat,
        cache_mode: romopapiCacheMode,
        report_format: romopapiReportFormat,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finngen-runs", "finngen_romopapi", selectedSourceId] });
    },
  });

  // ── Run history queries ──────────────────────────────────────────
  const runsQuery = useQuery({
    queryKey: ["finngen-runs", "finngen_romopapi", selectedSourceId],
    queryFn: () =>
      fetchFinnGenRuns({
        service_name: "finngen_romopapi",
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
  const exportBundleQuery = useQuery({
    queryKey: ["finngen-run-export", "romopapi", selectedRunId],
    queryFn: () => exportFinnGenRun(selectedRunId as number),
    enabled: Boolean(selectedRunId),
  });

  const replayRunMutation = useMutation({
    mutationFn: (runId: number) => replayFinnGenRun(runId),
    onSuccess: async (run) => {
      await queryClient.invalidateQueries({ queryKey: ["finngen-runs", "finngen_romopapi", selectedSourceId] });
      if (run?.id) {
        setSelectedRunId(run.id);
        setCompareRunId(null);
        queryClient.invalidateQueries({ queryKey: ["finngen-run", run.id] });
      }
    },
  });

  const data = romopapiMutation.data;
  const isPending = romopapiMutation.isPending;

  // ── Select class constant ────────────────────────────────────────
  const selectClass =
    "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none";

  return (
    <div className="space-y-4">
      {/* ── Controls ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Schema scope">
            <input
              value={schemaScope}
              onChange={(e) => setSchemaScope(e.target.value)}
              className={selectClass}
            />
          </FormField>
          <FormField label="Query template">
            <input
              value={queryTemplate}
              onChange={(e) => setQueryTemplate(e.target.value)}
              className={selectClass}
            />
          </FormField>
        </div>

        <div className="flex flex-wrap gap-2">
          {queryTemplates.map((template) => (
            <button
              key={template}
              type="button"
              onClick={() => setQueryTemplate(template)}
              className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-[#9B1B30]/40 hover:text-white"
            >
              {template}
            </button>
          ))}
        </div>

        <CollapsibleSection title="Advanced Options">
          <div className="space-y-0">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Concept domain">
                <select
                  value={conceptDomain}
                  onChange={(e) => setConceptDomain(e.target.value as (typeof romopapiDomainOptions)[number]["value"])}
                  className={selectClass}
                >
                  {romopapiDomainOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Stratify by">
                <select
                  value={romopapiStratifyBy}
                  onChange={(e) => setRomopapiStratifyBy(e.target.value as (typeof romopapiStratifyOptions)[number]["value"])}
                  className={selectClass}
                >
                  {romopapiStratifyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Result limit">
                <select
                  value={String(resultLimit)}
                  onChange={(e) => setResultLimit(Number(e.target.value) as (typeof romopapiLimitOptions)[number])}
                  className={selectClass}
                >
                  {romopapiLimitOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Lineage depth">
                <select
                  value={String(lineageDepth)}
                  onChange={(e) => setLineageDepth(Number(e.target.value) as (typeof romopapiLineageDepthOptions)[number])}
                  className={selectClass}
                >
                  {romopapiLineageDepthOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Request method">
                <select
                  value={romopapiRequestMethod}
                  onChange={(e) => setRomopapiRequestMethod(e.target.value as (typeof romopapiRequestMethodOptions)[number]["value"])}
                  className={selectClass}
                >
                  {romopapiRequestMethodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Response format">
                <select
                  value={romopapiResponseFormat}
                  onChange={(e) => setRomopapiResponseFormat(e.target.value as (typeof romopapiResponseFormatOptions)[number]["value"])}
                  className={selectClass}
                >
                  {romopapiResponseFormatOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Cache mode">
                <select
                  value={romopapiCacheMode}
                  onChange={(e) => setRomopapiCacheMode(e.target.value as (typeof romopapiCacheModeOptions)[number]["value"])}
                  className={selectClass}
                >
                  {romopapiCacheModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Report format">
                <select
                  value={romopapiReportFormat}
                  onChange={(e) => setRomopapiReportFormat(e.target.value as (typeof romopapiReportFormatOptions)[number]["value"])}
                  className={selectClass}
                >
                  {romopapiReportFormatOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </div>
        </CollapsibleSection>

        <ActionButton
          label="Run Query Plan Preview"
          onClick={() => romopapiMutation.mutate()}
          loading={isPending}
          disabled={!selectedSource}
        />
        {romopapiMutation.isError ? <ErrorBanner message={getErrorMessage(romopapiMutation.error)} /> : null}
      </div>

      {/* ── Results ───────────────────────────────────────────────────── */}
      {!data && !isPending ? (
        <p className="text-sm text-zinc-500">Run a query plan preview to explore the source.</p>
      ) : (
        <>
          {/* ── Key Results (3 hero panels) ──────────────────────────── */}
          <ResultSection title="Metadata Summary" data={data} loading={isPending}>
            <KeyValueGrid data={data?.metadata_summary ?? {}} />
          </ResultSection>

          <ResultSection title="Schema Graph" data={data} loading={isPending}>
            <SchemaNodeView result={data as FinnGenRomopapiResult} />
          </ResultSection>

          <ResultSection title="Report Preview" data={data} loading={isPending}>
            <ReportPreviewView result={data as FinnGenRomopapiResult} />
          </ResultSection>

          {/* ── Cross-tool handoff ────────────────────────────────────── */}
          {data && onHandoffToHades ? (
            <button
              type="button"
              onClick={() =>
                onHandoffToHades({
                  schema_scope: schemaScope,
                  query_template: queryTemplate,
                  concept_domain: conceptDomain,
                  source_key: selectedSource?.source_key,
                })
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-4 py-2.5 text-sm font-medium text-[#B9FFF1] transition-colors hover:bg-[#2DD4BF]/20"
            >
              Use in HADES Extras →
            </button>
          ) : null}

          {/* ── Detailed Results ─────────────────────────────────────── */}
          <CollapsibleSection title="Detailed Results">
            <div className="space-y-4">
              <ResultSection title="Hierarchy Map" data={data} loading={isPending}>
                <HierarchyMapView result={data as FinnGenRomopapiResult} />
              </ResultSection>

              <ResultSection title="Schema Density" data={data} loading={isPending}>
                <SchemaDensityView result={data as FinnGenRomopapiResult} />
              </ResultSection>

              <ResultSection title="Count Surface" data={data} loading={isPending}>
                <CountSurfaceView result={data as FinnGenRomopapiResult} />
              </ResultSection>

              <ResultSection title="Code Counts" data={data?.code_counts?.length} loading={isPending}>
                <CodeCountsView result={data as FinnGenRomopapiResult} />
              </ResultSection>

              <ResultSection title="Stratified Counts" data={data?.stratified_counts?.length} loading={isPending}>
                <StratifiedCountsView result={data as FinnGenRomopapiResult} />
              </ResultSection>

              <ResultSection title="Lineage" data={data} loading={isPending}>
                <LineageView result={data as FinnGenRomopapiResult} />
              </ResultSection>

              <ResultSection title="Result Profile" data={data} loading={isPending}>
                <ResultProfileView result={data as FinnGenRomopapiResult} />
              </ResultSection>

              <ResultSection title="Query Plan" data={data} loading={isPending}>
                <KeyValueGrid data={data?.query_plan ?? {}} />
              </ResultSection>

              <ResultSection title="Endpoint Manifest" data={data?.endpoint_manifest?.length} loading={isPending}>
                <RecordTable
                  rows={(data?.endpoint_manifest ?? []).map((endpoint) => ({
                    name: endpoint.name,
                    method: endpoint.method,
                    path: endpoint.path,
                    summary: endpoint.summary ?? "",
                  }))}
                />
              </ResultSection>

              <ResultSection title="Plausibility Sample" data={data} loading={isPending}>
                <RomopapiPlausibilityView result={data as FinnGenRomopapiResult} />
              </ResultSection>
            </div>
          </CollapsibleSection>
        </>
      )}

      {/* ── Run History ───────────────────────────────────────────────── */}
      <CollapsibleSection title="Run History">
        <div className="space-y-4">
          {runsQuery.data?.length ? (
            <>
              <RecentRunsView
                runs={runsQuery.data}
                selectedRunId={selectedRunId}
                onSelect={setSelectedRunId}
              />
              {selectedRunId && runDetailQuery.data ? (
                <>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                    <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Request Envelope</div>
                    {runDetailQuery.data.result_payload && typeof runDetailQuery.data.result_payload === "object" && (runDetailQuery.data.result_payload as Record<string, unknown>).request_envelope ? (
                      <KeyValueGrid data={((runDetailQuery.data.result_payload as Record<string, unknown>).request_envelope ?? {}) as Record<string, unknown>} />
                    ) : (
                      <EmptyState label="No data yet." />
                    )}
                  </div>
                  <PersistedRomopapiArtifactsView
                    resultPayload={(runDetailQuery.data.result_payload ?? {}) as Record<string, unknown>}
                    exportPayload={exportBundleQuery.data ?? null}
                  />
                  <RunInspectorView
                    run={runDetailQuery.data}
                    onReplay={() => replayRunMutation.mutate(selectedRunId)}
                    onExport={async () => {
                      const bundle = await exportFinnGenRun(selectedRunId);
                      if (bundle) downloadJson(`finngen-run-${selectedRunId}.json`, bundle);
                    }}
                    replaying={replayRunMutation.isPending}
                  />
                  <RunComparisonPanel
                    runs={runsQuery.data}
                    selectedRun={runDetailQuery.data}
                    compareRun={compareRunDetailQuery.data}
                    compareRunId={compareRunId}
                    onCompareRunChange={setCompareRunId}
                  />
                </>
              ) : null}
            </>
          ) : (
            <EmptyState label="No data yet." />
          )}
        </div>
      </CollapsibleSection>

      {/* ── Diagnostics ───────────────────────────────────────────────── */}
      <CollapsibleSection title="Diagnostics">
        <RuntimePanel runtime={data?.runtime} />
      </CollapsibleSection>
    </div>
  );
}
