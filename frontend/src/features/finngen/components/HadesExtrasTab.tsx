import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CollapsibleSection } from "./CollapsibleSection";
import {
  FormField,
  ActionButton,
  ResultSection,
  KeyValueGrid,
  LabelValueList,
  MiniMetric,
  CodeBlock,
  ErrorBanner,
  EmptyState,
  RuntimePanel,
  RecordTable,
  ArtifactList,
  RecentRunsView,
  RunInspectorView,
  RunComparisonPanel,
  requireSource,
  getErrorMessage,
  downloadText,
  downloadJson,
  collectSqlSubstitutions,
  hadesConfigProfiles,
  hadesArtifactModes,
  hadesPackageSkeletons,
  defaultHadesYaml,
} from "./workbenchShared";
import type {
  FinnGenHadesExtrasResult,
  FinnGenSource,
} from "../types";
import {
  previewFinnGenHadesExtras,
  fetchFinnGenRuns,
  fetchFinnGenRun,
  exportFinnGenRun,
  replayFinnGenRun,
} from "../api";

// ── HADES-specific inline result views ───────────────────────────────

function SqlPreviewView({ result }: { result: FinnGenHadesExtrasResult }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CodeBlock title="Template" code={result.sql_preview.template} />
      <CodeBlock title="Rendered" code={result.sql_preview.rendered} />
    </div>
  );
}

function SqlDiffView({ result }: { result: FinnGenHadesExtrasResult }) {
  const templateLines = result.sql_preview.template.split("\n");
  const renderedLines = result.sql_preview.rendered.split("\n");
  const added = renderedLines.filter((line) => !templateLines.includes(line));
  const retained = renderedLines.filter((line) => templateLines.includes(line));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniMetric label="Template lines" value={String(templateLines.length)} />
        <MiniMetric label="Rendered lines" value={String(renderedLines.length)} />
        <MiniMetric label="New lines" value={String(added.length)} />
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Rendered additions</div>
        <div className="space-y-2 text-sm text-zinc-300">
          {(added.length ? added : retained.slice(0, 3)).map((line, index) => (
            <div key={`${index}-${line}`} className="rounded bg-zinc-900/70 px-2 py-1 font-mono text-xs">
              {line || "(blank line)"}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OperationLineageView({ result }: { result: FinnGenHadesExtrasResult }) {
  const substitutions = collectSqlSubstitutions(result.sql_preview.template, result.sql_preview.rendered);
  const lineage = result.sql_lineage ?? [];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <MiniMetric label="Artifacts" value={String(result.artifacts.length)} />
        <MiniMetric label="Pipeline stages" value={String(result.artifact_pipeline.length)} />
        <MiniMetric label="Lineage steps" value={String(Math.max(lineage.length, substitutions.length))} />
      </div>
      <div className="space-y-2">
        {(lineage.length
          ? lineage
          : result.artifact_pipeline.map((stage) => ({ stage: stage.name, detail: `Status: ${stage.status}` }))
        ).map((stage, index) => (
          <div key={`${stage.stage}-${index}`} className="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 text-xs font-semibold text-[#7CE8D5]">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-zinc-100">{stage.stage}</div>
              <div className="mt-1 text-xs text-zinc-500">{stage.detail}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Schema substitutions</div>
        <div className="space-y-2 text-sm text-zinc-300">
          {(substitutions.length ? substitutions : ["No schema token substitutions detected in this render."]).map((item) => (
            <div key={item} className="rounded bg-zinc-900/70 px-2 py-1 font-mono text-xs">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CohortTableLifecycleView({ result }: { result: FinnGenHadesExtrasResult }) {
  const lifecycle = result.cohort_table_lifecycle ?? [];

  return lifecycle.length ? (
    <div className="space-y-3">
      {lifecycle.map((item, index) => (
        <div key={`${item.name}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-100">{item.name}</div>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-300">
              {item.status}
            </span>
          </div>
          {item.detail ? <div className="mt-2 text-xs text-zinc-500">{item.detail}</div> : null}
        </div>
      ))}
    </div>
  ) : (
    <EmptyState label="No data yet." />
  );
}

function HelperLogsView({ result }: { result: FinnGenHadesExtrasResult }) {
  const logs = result.helper_logs ?? [];

  return logs.length ? (
    <div className="space-y-3">
      {logs.map((log, index) => (
        <div key={`${log.step}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-zinc-100">{log.step}</div>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-300">
              {log.status}
            </span>
          </div>
          <div className="mt-2 text-xs text-zinc-500">{log.detail}</div>
        </div>
      ))}
    </div>
  ) : (
    <EmptyState label="No data yet." />
  );
}

function PipelineView({ result }: { result: FinnGenHadesExtrasResult }) {
  return (
    <div className="space-y-3">
      {result.artifact_pipeline.map((item) => (
        <div key={item.name} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-100">{item.name}</span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/15 text-[#2DD4BF]">
              {item.status}
            </span>
          </div>
        </div>
      ))}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
        {result.artifacts.map((artifact) => (
          <div key={artifact.name} className="flex items-center justify-between gap-3 py-1">
            <span>{artifact.name}</span>
            {artifact.type ? <span className="text-xs uppercase tracking-wide text-zinc-500">{artifact.type}</span> : null}
          </div>
        ))}
      </div>
      {result.explain_plan?.length ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Explain Plan</div>
          <div className="space-y-2 text-sm text-zinc-300">
            {result.explain_plan.map((row, index) => (
              <div key={`${index}-${JSON.stringify(row)}`}>{Object.values(row).join(" ")}</div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PackageManifestView({ result }: { result: FinnGenHadesExtrasResult }) {
  const manifest = result.package_manifest ?? [];

  return (
    <ArtifactList
      artifacts={manifest.map((item) => ({
        name: item.path,
        type: item.kind,
        summary: item.summary,
      }))}
    />
  );
}

function PackageBundleView({ result }: { result: FinnGenHadesExtrasResult }) {
  const bundle = result.package_bundle;

  if (!bundle) {
    return <EmptyState label="No data yet." />;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <MiniMetric label="Bundle name" value={bundle.name ?? "Unavailable"} />
        <MiniMetric label="Format" value={bundle.format ?? "Unavailable"} />
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Bundle entrypoints</div>
        <div className="space-y-2 text-sm text-zinc-300">
          {(bundle.entrypoints ?? []).map((item) => (
            <div key={item} className="rounded bg-zinc-900/70 px-2 py-1 font-mono text-xs">
              {item}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadJson(bundle.download_name ?? "hades-package-bundle.json", bundle)}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-[#2DD4BF]/40 hover:text-white"
        >
          Download Bundle Metadata
        </button>
        {result.package_manifest?.length ? (
          <button
            type="button"
            onClick={() => downloadJson("hades-package-manifest.json", result.package_manifest)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-[#2DD4BF]/40 hover:text-white"
          >
            Download Package Manifest
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PersistedHadesArtifactsView({
  resultPayload,
  exportPayload,
}: {
  resultPayload: Record<string, unknown>;
  exportPayload: Record<string, unknown> | null;
}) {
  const packageBundle =
    resultPayload.package_bundle && typeof resultPayload.package_bundle === "object"
      ? (resultPayload.package_bundle as Record<string, unknown>)
      : {};
  const packageManifest = Array.isArray(resultPayload.package_manifest)
    ? (resultPayload.package_manifest as Array<Record<string, unknown>>)
    : [];
  const cohortTableLifecycle = Array.isArray(resultPayload.cohort_table_lifecycle)
    ? (resultPayload.cohort_table_lifecycle as Array<Record<string, unknown>>)
    : [];
  const helperLogs = Array.isArray(resultPayload.helper_logs)
    ? (resultPayload.helper_logs as Array<Record<string, unknown>>)
    : [];
  const artifactPayloads = Array.isArray(exportPayload?.artifact_payloads)
    ? (exportPayload.artifact_payloads as Array<Record<string, unknown>>)
    : [];
  const artifactPayloadByName = new Map(
    artifactPayloads.map((item) => [String(item.name ?? ""), item]),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Cohort Table Lifecycle</div>
          {cohortTableLifecycle.length ? (
            <RecordTable rows={cohortTableLifecycle} />
          ) : (
            <EmptyState label="No data yet." />
          )}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Helper Logs</div>
          {helperLogs.length ? (
            <RecordTable rows={helperLogs} />
          ) : (
            <EmptyState label="No data yet." />
          )}
        </div>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Package Bundle</div>
        {Object.keys(packageBundle).length ? (
          <div className="space-y-4">
            <KeyValueGrid data={packageBundle} />
            <ActionButton
              label="Download stored bundle"
              onClick={() =>
                downloadJson(
                  String(packageBundle.download_name ?? "hades-package-bundle.json"),
                  packageBundle,
                )
              }
            />
          </div>
        ) : (
          <EmptyState label="No data yet." />
        )}
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="mb-3 text-sm font-medium text-zinc-100">Persisted Package Manifest</div>
        {packageManifest.length ? (
          <div className="space-y-3">
            <RecordTable rows={packageManifest} />
            <div className="space-y-2">
              {packageManifest.map((entry) => {
                const path = String(entry.path ?? "artifact");
                const payload = artifactPayloadByName.get(path);
                return (
                  <div key={path} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-100">{path}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {String(entry.summary ?? entry.kind ?? "Artifact")}
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
                        anchor.download = String(payload.download_name ?? payload.name ?? path);
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

function PlausibilityView({
  result,
  persisted = false,
}: {
  result: FinnGenHadesExtrasResult;
  persisted?: boolean;
}) {
  const sqlPreview = result.sql_preview ?? ({} as Record<string, unknown>);
  const explainPlan = Array.isArray(result.explain_plan) ? result.explain_plan : [];
  const artifactPipeline = Array.isArray(result.artifact_pipeline) ? result.artifact_pipeline : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <PlausibilityBadge
          label="SQL rendered"
          value={typeof sqlPreview.rendered === "string" && sqlPreview.rendered.length ? "Rendered" : "Missing"}
          tone={typeof sqlPreview.rendered === "string" && sqlPreview.rendered.length ? "good" : "warn"}
        />
        <PlausibilityBadge
          label="Explain rows"
          value={explainPlan.length ? `${explainPlan.length} plan rows` : "No plan"}
          tone={explainPlan.length ? "good" : "warn"}
        />
        <PlausibilityBadge
          label="Artifacts staged"
          value={artifactPipeline.length ? `${artifactPipeline.length} stages` : "No stages"}
          tone={artifactPipeline.length ? "good" : "warn"}
        />
      </div>
      {typeof sqlPreview.rendered === "string" && sqlPreview.rendered.length ? (
        <CodeBlock title="Rendered SQL sample" code={sqlPreview.rendered.split("\n").slice(0, 6).join("\n")} />
      ) : (
        <EmptyState label={`${persisted ? "Persisted" : "Live"} rendered SQL samples will appear here when available.`} />
      )}
    </div>
  );
}

function PlausibilityBadge({
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

// ── Main tab component ───────────────────────────────────────────────

export function HadesExtrasTab({
  selectedSource,
  hadesContext,
  onHandoffToCohortOps,
}: {
  selectedSource: FinnGenSource | null;
  hadesContext?: Record<string, unknown> | null;
  onHandoffToCohortOps?: (context: Record<string, unknown>) => void;
}) {
  const queryClient = useQueryClient();
  const selectedSourceId = selectedSource?.id ?? null;

  const [sqlTemplate, setSqlTemplate] = useState(
    "SELECT person_id, COUNT(*) AS condition_count\nFROM @cdm_schema.condition_occurrence\nGROUP BY person_id\nLIMIT 100;",
  );
  const [packageName, setPackageName] = useState("AcumenusFinnGenPackage");
  const [hadesConfigProfile, setHadesConfigProfile] =
    useState<(typeof hadesConfigProfiles)[number]["value"]>("acumenus_default");
  const [hadesArtifactMode, setHadesArtifactMode] =
    useState<(typeof hadesArtifactModes)[number]["value"]>("full_bundle");
  const [hadesPackageSkeleton, setHadesPackageSkeleton] =
    useState<(typeof hadesPackageSkeletons)[number]["value"]>("ohdsi_study");
  const [hadesCohortTable, setHadesCohortTable] = useState("results.cohort");
  const [hadesConfigYaml, setHadesConfigYaml] = useState(defaultHadesYaml);

  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [compareRunId, setCompareRunId] = useState<number | null>(null);

  // Apply ROMOPAPI handoff context
  useEffect(() => {
    if (!hadesContext) return;
    if (hadesContext.schema_scope) {
      setSqlTemplate((prev) =>
        prev.includes("@cdm_schema")
          ? prev
          : `SELECT person_id, COUNT(*) AS cnt\nFROM ${String(hadesContext.schema_scope)}.condition_occurrence\nGROUP BY person_id\nLIMIT 100;`,
      );
    }
  }, [hadesContext]);

  const hadesMutation = useMutation({
    mutationFn: () =>
      previewFinnGenHadesExtras({
        source: requireSource(selectedSource),
        sql_template: sqlTemplate,
        package_name: packageName,
        render_target: selectedSource?.source_dialect,
        config_profile: hadesConfigProfile,
        artifact_mode: hadesArtifactMode,
        package_skeleton: hadesPackageSkeleton,
        cohort_table: hadesCohortTable,
        config_yaml: hadesConfigYaml,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finngen-runs", "finngen_hades_extras", selectedSourceId] });
    },
  });

  const runsQuery = useQuery({
    queryKey: ["finngen-runs", "finngen_hades_extras", selectedSourceId],
    queryFn: () =>
      fetchFinnGenRuns({
        service_name: "finngen_hades_extras",
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
    queryKey: ["finngen-run-export", "hades", selectedRunId],
    queryFn: () => exportFinnGenRun(selectedRunId as number),
    enabled: Boolean(selectedRunId),
  });

  const replayRunMutation = useMutation({
    mutationFn: (runId: number) => replayFinnGenRun(runId),
    onSuccess: async (run) => {
      await queryClient.invalidateQueries({ queryKey: ["finngen-runs", "finngen_hades_extras", selectedSourceId] });
      if (run?.id) {
        setSelectedRunId(run.id);
        setCompareRunId(null);
        queryClient.invalidateQueries({ queryKey: ["finngen-run", run.id] });
      }
    },
  });

  useEffect(() => {
    setSelectedRunId(null);
    setCompareRunId(null);
  }, [selectedSourceId]);

  useEffect(() => {
    const runs = runsQuery.data ?? [];
    if (!runs.length) return;
    setSelectedRunId((current) => (runs.some((run) => run.id === current) ? current : runs[0]?.id ?? null));
  }, [runsQuery.data]);

  const data = hadesMutation.data;
  const loading = hadesMutation.isPending;

  return (
    <div className="space-y-4">
      {/* ── Controls ──────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
        <div>
          <div className="text-sm font-medium text-white">Render Preview</div>
          <p className="mt-1 text-sm leading-6 text-zinc-400">
            Render SQL and package artifacts for the selected source.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Package name">
            <input
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            />
          </FormField>
          <div className="flex items-end">
            <ActionButton
              label="Render Preview"
              onClick={() => hadesMutation.mutate()}
              loading={loading}
              disabled={!selectedSource}
            />
          </div>
        </div>

        <FormField label="SQL template">
          <textarea
            value={sqlTemplate}
            onChange={(e) => setSqlTemplate(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 font-mono text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
          />
        </FormField>

        {hadesMutation.isError ? <ErrorBanner message={getErrorMessage(hadesMutation.error)} /> : null}
      </div>

      <CollapsibleSection title="Advanced Options">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Config profile">
              <select
                value={hadesConfigProfile}
                onChange={(e) => setHadesConfigProfile(e.target.value as (typeof hadesConfigProfiles)[number]["value"])}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
              >
                {hadesConfigProfiles.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Artifact mode">
              <select
                value={hadesArtifactMode}
                onChange={(e) => setHadesArtifactMode(e.target.value as (typeof hadesArtifactModes)[number]["value"])}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
              >
                {hadesArtifactModes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Package skeleton">
              <select
                value={hadesPackageSkeleton}
                onChange={(e) => setHadesPackageSkeleton(e.target.value as (typeof hadesPackageSkeletons)[number]["value"])}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
              >
                {hadesPackageSkeletons.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Cohort table">
              <input
                value={hadesCohortTable}
                onChange={(e) => setHadesCohortTable(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
              />
            </FormField>
          </div>
          <FormField label="YAML config">
            <textarea
              value={hadesConfigYaml}
              onChange={(e) => setHadesConfigYaml(e.target.value)}
              rows={10}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 font-mono text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            />
          </FormField>
        </div>
      </CollapsibleSection>

      {/* ── Pre-run empty state ───────────────────────────────────────── */}
      {!data && !loading ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="py-4 text-center text-sm text-zinc-500">
            Render a preview to inspect SQL and package artifacts.
          </div>
        </div>
      ) : null}

      {/* ── Key Results (3 hero panels) ───────────────────────────────── */}
      <ResultSection title="Render Summary" data={data?.render_summary} loading={loading}>
        <KeyValueGrid data={data?.render_summary ?? {}} />
      </ResultSection>

      <ResultSection title="SQL Preview" data={data?.sql_preview} loading={loading}>
        {data ? <SqlPreviewView result={data} /> : null}
      </ResultSection>

      <ResultSection title="Package Bundle" data={data?.package_bundle} loading={loading}>
        {data ? <PackageBundleView result={data} /> : null}
      </ResultSection>

      {/* ── Cross-tool handoff ────────────────────────────────────────── */}
      {data && onHandoffToCohortOps ? (
        <button
          type="button"
          onClick={() =>
            onHandoffToCohortOps({
              cohort_table: hadesCohortTable,
              package_name: packageName,
              rendered_sql: data.sql_preview?.rendered,
            })
          }
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-4 py-2.5 text-sm font-medium text-[#B9FFF1] transition-colors hover:bg-[#2DD4BF]/20"
        >
          Use in Cohort Ops →
        </button>
      ) : null}

      {/* ── Detailed Results ──────────────────────────────────────────── */}
      {data ? (
        <CollapsibleSection title="Detailed Results">
          <div className="space-y-4">
            <ResultSection title="Package Setup" data={data.package_setup} loading={false}>
              <KeyValueGrid data={data.package_setup ?? {}} />
            </ResultSection>

            <ResultSection title="Connection Context" data={data.source} loading={false}>
              <KeyValueGrid data={data.source ?? {}} />
            </ResultSection>

            <ResultSection title="SQL Diff Lens" data={data.sql_preview} loading={false}>
              <SqlDiffView result={data} />
            </ResultSection>

            <ResultSection title="Config Summary" data={data.config_summary} loading={false}>
              <KeyValueGrid data={data.config_summary ?? {}} />
            </ResultSection>

            <ResultSection title="Cohort Summary" data={data.cohort_summary?.length ? data.cohort_summary : null} loading={false}>
              <LabelValueList items={data.cohort_summary ?? []} />
            </ResultSection>

            <ResultSection title="Config Export" data={data.config_exports} loading={false}>
              <div className="space-y-3">
                {data.config_exports?.json ? (
                  <KeyValueGrid data={data.config_exports.json} />
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {data.config_exports?.yaml ? (
                    <button
                      type="button"
                      onClick={() => downloadText("hades-config.yaml", data.config_exports?.yaml ?? "")}
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-[#9B1B30]/40 hover:text-white"
                    >
                      Download YAML
                    </button>
                  ) : null}
                  {data.config_exports?.json ? (
                    <button
                      type="button"
                      onClick={() => downloadJson("hades-config.json", data.config_exports?.json ?? {})}
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-[#9B1B30]/40 hover:text-white"
                    >
                      Download JSON
                    </button>
                  ) : null}
                </div>
              </div>
            </ResultSection>

            <ResultSection title="Operation Lineage" data={data} loading={false}>
              <OperationLineageView result={data} />
            </ResultSection>

            <ResultSection title="Artifact Pipeline" data={data.artifact_pipeline?.length ? data.artifact_pipeline : null} loading={false}>
              <PipelineView result={data} />
            </ResultSection>

            <ResultSection title="Package Manifest" data={data.package_manifest?.length ? data.package_manifest : null} loading={false}>
              <PackageManifestView result={data} />
            </ResultSection>

            <ResultSection title="Plausibility Sample" data={data} loading={false}>
              <PlausibilityView result={data} />
            </ResultSection>

            <ResultSection title="Config Validation" data={data.config_validation?.length ? data.config_validation : null} loading={false}>
              <LabelValueList items={(data.config_validation ?? []).map((item) => ({
                label: item.label,
                value: item.status,
                detail: item.detail,
              }))} />
            </ResultSection>

            <ResultSection title="Cohort Table Lifecycle" data={data.cohort_table_lifecycle?.length ? data.cohort_table_lifecycle : null} loading={false}>
              <CohortTableLifecycleView result={data} />
            </ResultSection>

            <ResultSection title="Helper Logs" data={data.helper_logs?.length ? data.helper_logs : null} loading={false}>
              <HelperLogsView result={data} />
            </ResultSection>
          </div>
        </CollapsibleSection>
      ) : null}

      {/* ── Run History ────────────────────────────────────────────────── */}
      <CollapsibleSection title="Run History">
        <div className="space-y-4">
          {runsQuery.isLoading ? (
            <EmptyState label="Loading run history..." />
          ) : runsQuery.data?.length ? (
            <RecentRunsView
              runs={runsQuery.data}
              selectedRunId={selectedRunId}
              onSelect={setSelectedRunId}
            />
          ) : (
            <EmptyState label="No data yet." />
          )}

          {runDetailQuery.isLoading ? (
            <EmptyState label="Loading run details..." />
          ) : runDetailQuery.data ? (
            <>
              <PersistedHadesArtifactsView
                resultPayload={(runDetailQuery.data.result_payload ?? {}) as Record<string, unknown>}
                exportPayload={exportBundleQuery.data ?? null}
              />
              <RunInspectorView
                run={runDetailQuery.data}
                onReplay={() => replayRunMutation.mutate(runDetailQuery.data?.id ?? 0)}
                onExport={async () => {
                  const bundle = await exportFinnGenRun(runDetailQuery.data?.id ?? 0);
                  if (bundle) {
                    downloadJson(`finngen-run-${runDetailQuery.data?.id}-bundle.json`, bundle);
                  }
                }}
                replaying={replayRunMutation.isPending}
              />
            </>
          ) : runsQuery.data?.length ? (
            <EmptyState label="Select a run to inspect its details." />
          ) : null}

          {runDetailQuery.data ? (
            <RunComparisonPanel
              runs={runsQuery.data ?? []}
              selectedRun={runDetailQuery.data}
              compareRun={compareRunDetailQuery.data}
              compareRunId={compareRunId}
              onCompareRunChange={setCompareRunId}
            />
          ) : null}
        </div>
      </CollapsibleSection>

      {/* ── Diagnostics ────────────────────────────────────────────────── */}
      <CollapsibleSection title="Diagnostics">
        <RuntimePanel runtime={data?.runtime} />
        {!data?.runtime ? (
          <EmptyState label="No data yet." />
        ) : null}
      </CollapsibleSection>
    </div>
  );
}
