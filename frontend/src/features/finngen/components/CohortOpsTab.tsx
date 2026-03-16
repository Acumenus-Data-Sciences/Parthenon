import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Blocks, GripVertical, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  useCohortDefinition,
  useCohortDefinitions,
} from "@/features/cohort-definitions/hooks/useCohortDefinitions";
import type { CohortDefinition } from "@/features/cohort-definitions/types/cohortExpression";
import {
  previewFinnGenCohortOperations,
  fetchFinnGenRuns,
  fetchFinnGenRun,
  exportFinnGenRun,
  replayFinnGenRun,
} from "../api";
import type {
  FinnGenCohortOperationsResult,
  FinnGenSource,
  FinnGenRuntime,
  FinnGenMetricPoint,
  FinnGenTimelineStep,
  FinnGenArtifact,
} from "../types";
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
  CodeBlock,
  ErrorBanner,
  EmptyState,
  RuntimePanel,
  RecentRunsView,
  RunInspectorView,
  RunComparisonPanel,
  PlausibilityBadge,
  requireSource,
  getErrorMessage,
  safeParseJson,
  parseIntegerList,
  parseStringList,
  formatValue,
  downloadJson,
  formatTimestamp,
  cohortPresets,
  cohortImportModes,
  cohortAtlasImportBehaviorOptions,
  cohortOperationTypes,
  cohortMatchingStrategies,
  cohortMatchingTargets,
  defaultMatchingCovariates,
} from "./workbenchShared";
import { CollapsibleSection } from "./CollapsibleSection";

// ── Cohort-specific view components ──────────────────────────────────

function AttritionView({ result }: { result: FinnGenCohortOperationsResult }) {
  const maxCount = Math.max(
    ...result.attrition.map((item) => item.count ?? 0),
    1,
  );

  return (
    <div className="space-y-4">
      {result.attrition.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-zinc-200">{item.label}</span>
            <span className="text-zinc-400">
              {item.count?.toLocaleString()} · {item.percent}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-zinc-800">
            <div
              className="h-3 rounded-full bg-[#9B1B30] transition-all"
              style={{
                width: `${((item.count ?? 0) / maxCount) * 100}%`,
              }}
            />
          </div>
        </div>
      ))}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
          Artifacts
        </div>
        <div className="space-y-2 text-sm text-zinc-300">
          {result.artifacts.map((artifact) => (
            <div key={artifact.name}>
              {artifact.name} · {artifact.summary}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineView({
  items,
}: {
  items: FinnGenCohortOperationsResult["criteria_timeline"];
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={`${item.step}-${item.title}`}
          className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-zinc-100">
              {item.title}
            </div>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#C9A227]/15 text-[#C9A227]">
              {item.status}
            </span>
          </div>
          <div className="mt-1 text-sm text-zinc-400">{item.window}</div>
          <div className="mt-2 text-sm text-zinc-300">{item.detail}</div>
        </div>
      ))}
    </div>
  );
}

function ImportExportView({
  importMode,
  onImportModeChange,
  result,
}: {
  importMode: (typeof cohortImportModes)[number]["value"];
  onImportModeChange: (
    value: (typeof cohortImportModes)[number]["value"],
  ) => void;
  result: FinnGenCohortOperationsResult;
}) {
  const sourceKey = String(
    result.compile_summary.source_key ??
      result.source.source_key ??
      "source",
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {cohortImportModes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => onImportModeChange(mode.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              importMode === mode.value
                ? "border-[#9B1B30]/40 bg-[#9B1B30]/10 text-[#E85A6B]"
                : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-[#9B1B30]/30 hover:text-white"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
        {importMode === "parthenon"
          ? "Existing Parthenon cohorts are active. This preview now uses the selected cohort set and the chosen operation semantics before exporting the derived cohort and handoff artifacts."
          : importMode === "atlas"
            ? `Atlas/WebAPI import is the target parity path. This preview is compiled for ${sourceKey} and can already be exported as SQL and sample artifacts.`
            : importMode === "cohort_table"
              ? "Cohort-table import is now validating the selected table against the source and exposing discovered cohort IDs, row counts, and downstream artifacts."
              : importMode === "file"
                ? "File import is active. This preview now treats the uploaded-style cohort file as the source framing and includes file-aware export artifacts below."
              : "JSON definition import is active now. This preview uses the current definition payload and returns the first exportable artifacts below."}
      </div>
      <div className="space-y-2">
        {result.artifacts.map((artifact) => (
          <div
            key={artifact.name}
            className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-zinc-100">
                {artifact.name}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {artifact.summary ?? artifact.type ?? "Artifact"}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                downloadJson(
                  `${artifact.name.replaceAll("/", "_")}.json`,
                  artifact,
                )
              }
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-[#9B1B30]/30 hover:text-white"
            >
              Export
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CohortHandoffView({
  exportSummary,
  onHandoff,
}: {
  exportSummary: Record<string, unknown>;
  onHandoff: () => void;
}) {
  const handoffReady = Boolean(exportSummary.handoff_ready);

  return (
    <div className="space-y-4">
      <KeyValueGrid data={exportSummary} />
      <button
        type="button"
        onClick={onHandoff}
        disabled={!handoffReady}
        className="inline-flex items-center gap-2 rounded-lg border border-[#9B1B30]/30 bg-[#9B1B30]/10 px-3 py-2 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ArrowUpRight className="h-4 w-4" />
        Hand Off To CO2 Modules
      </button>
    </div>
  );
}

function PersistedCohortRunArtifacts({
  resultPayload,
  exportPayload,
}: {
  resultPayload: Record<string, unknown>;
  exportPayload: Record<string, unknown> | null;
}) {
  const fileImportSummary =
    resultPayload.file_import_summary &&
    typeof resultPayload.file_import_summary === "object"
      ? (resultPayload.file_import_summary as Record<string, unknown>)
      : {};
  const exportBundle =
    resultPayload.export_bundle &&
    typeof resultPayload.export_bundle === "object"
      ? (resultPayload.export_bundle as Record<string, unknown>)
      : {};
  const atlasConceptSetSummary = Array.isArray(resultPayload.atlas_concept_set_summary)
    ? (resultPayload.atlas_concept_set_summary as Array<Record<string, unknown>>)
    : [];
  const atlasImportDiagnostics =
    resultPayload.atlas_import_diagnostics &&
    typeof resultPayload.atlas_import_diagnostics === "object"
      ? (resultPayload.atlas_import_diagnostics as Record<string, unknown>)
      : {};
  const exportManifest = Array.isArray(resultPayload.export_manifest)
    ? (resultPayload.export_manifest as Array<Record<string, unknown>>)
    : [];
  const artifactPayloads = Array.isArray(exportPayload?.artifact_payloads)
    ? (exportPayload?.artifact_payloads as Array<Record<string, unknown>>)
    : [];
  const artifactPayloadByName = new Map(
    artifactPayloads.map((item) => [String(item.name ?? ""), item]),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">
            Persisted Atlas Concept Set Remap
          </div>
          {atlasConceptSetSummary.length ? (
            <RecordTable rows={atlasConceptSetSummary} />
          ) : (
            <EmptyState label="Persisted Atlas concept-set remap details will appear here for Atlas-backed runs." />
          )}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">
            Persisted Atlas Import Diagnostics
          </div>
          {Object.keys(atlasImportDiagnostics).length ? (
            <KeyValueGrid data={atlasImportDiagnostics} />
          ) : (
            <EmptyState label="Persisted Atlas import diagnostics will appear here for Atlas-backed runs." />
          )}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">
            Persisted File Import Summary
          </div>
          {Object.keys(fileImportSummary).length ? (
            <KeyValueGrid data={fileImportSummary} />
          ) : (
            <EmptyState label="Persisted file import details will appear here when a run stores them." />
          )}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">
            Persisted Export Bundle
          </div>
          {Object.keys(exportBundle).length ? (
            <div className="space-y-4">
              <KeyValueGrid data={exportBundle} />
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  label="Download stored bundle"
                  onClick={() =>
                    downloadJson(
                      String(
                        exportBundle.download_name ??
                          "cohort-ops-export-bundle.json",
                      ),
                      exportBundle,
                    )
                  }
                />
              </div>
            </div>
          ) : (
            <EmptyState label="Persisted export bundle metadata will appear here when a run stores it." />
          )}
        </div>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
        <div className="mb-3 text-sm font-medium text-zinc-100">
          Persisted Export Manifest
        </div>
        {exportManifest.length ? (
          <div className="space-y-3">
            <RecordTable rows={exportManifest} />
            <div className="space-y-2">
              {exportManifest.map((entry) => {
                const name = String(entry.name ?? "artifact");
                const payload = artifactPayloadByName.get(name);
                return (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-100">
                        {name}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {String(entry.summary ?? entry.type ?? "Artifact")}
                      </div>
                    </div>
                    <ActionButton
                      label="Download entry"
                      onClick={() => {
                        if (!payload) return;
                        const filename = String(
                          payload.download_name ?? payload.name ?? name,
                        );
                        const mimeType = String(
                          payload.mime_type ?? "application/json",
                        );
                        const content = String(payload.content ?? "");
                        const blob = new Blob([content], { type: mimeType });
                        const url = URL.createObjectURL(blob);
                        const anchor = document.createElement("a");
                        anchor.href = url;
                        anchor.download = filename;
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
          <EmptyState label="Persisted export manifest entries will appear here when a run stores them." />
        )}
      </div>
    </div>
  );
}

function MatchingReviewView({
  result,
}: {
  result: FinnGenCohortOperationsResult;
}) {
  const compiled = Number(result.compile_summary.criteria_count ?? 0);
  const additional = Number(
    result.compile_summary.additional_criteria_count ?? 0,
  );
  const baseline = Math.max(
    Number(
      result.matching_summary?.eligible_rows ??
        result.compile_summary.cohort_count ??
        0,
    ),
    1,
  );
  const matched = Math.max(
    0,
    Number(
      result.matching_summary?.matched_rows ?? Math.round(baseline * 0.84),
    ),
  );
  const excluded = Math.max(
    0,
    Number(result.matching_summary?.excluded_rows ?? baseline - matched),
  );
  const strategy = String(
    result.matching_summary?.match_strategy ?? "nearest-neighbor preview",
  );
  const ratio = String(result.matching_summary?.match_ratio ?? "1.0");
  const caliper = String(result.matching_summary?.match_caliper ?? "0.20");
  const balanceScore = Number(result.matching_summary?.balance_score ?? 0);
  const operationType = String(
    result.operation_summary?.operation_type ??
      result.compile_summary.operation_type ??
      "union",
  );
  const operationPhrase = String(
    result.operation_summary?.operation_phrase ?? "set-operation preview",
  );
  const matchedSamples = Array.isArray(result.matching_review?.matched_samples)
    ? (result.matching_review?.matched_samples ?? [])
    : [];
  const excludedSamples = Array.isArray(
    result.matching_review?.excluded_samples,
  )
    ? (result.matching_review?.excluded_samples ?? [])
    : [];
  const balanceNotes = Array.isArray(result.matching_review?.balance_notes)
    ? (result.matching_review?.balance_notes ?? [])
    : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        <MiniMetric label="Primary rules" value={String(compiled)} />
        <MiniMetric label="Additional rules" value={String(additional)} />
        <MiniMetric label="Matched rows" value={matched.toLocaleString()} />
        <MiniMetric label="Ratio" value={ratio} />
        <MiniMetric label="Caliper" value={caliper} />
      </div>
      <div className="space-y-3">
        <ProgressRow
          label="Eligible set"
          value={baseline}
          total={baseline}
          color="#60A5FA"
        />
        <ProgressRow
          label="Matched set"
          value={matched}
          total={baseline}
          color="#2DD4BF"
        />
        <ProgressRow
          label="Excluded in review"
          value={excluded}
          total={baseline}
          color="#C9A227"
        />
      </div>
      {balanceScore > 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
            Balance score
          </div>
          <ProgressRow
            label="Estimated balance"
            value={Math.round(balanceScore * 100)}
            total={100}
            color="#2DD4BF"
          />
        </div>
      ) : null}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
        {operationType.toUpperCase()} preview with {operationPhrase}. Matching
        strategy: {strategy}.
      </div>
      {balanceNotes.length ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
            Balance notes
          </div>
          <div className="space-y-2 text-sm text-zinc-300">
            {balanceNotes.map((note) => (
              <div key={note}>{note}</div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">
            Matched samples
          </div>
          {matchedSamples.length ? (
            <RecordTable rows={matchedSamples} />
          ) : (
            <EmptyState label="Matched sample evidence will appear here." />
          )}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">
            Excluded samples
          </div>
          {excludedSamples.length ? (
            <RecordTable rows={excludedSamples} />
          ) : (
            <EmptyState label="Excluded sample evidence will appear here." />
          )}
        </div>
      </div>
    </div>
  );
}

function OperationEvidenceView({
  result,
}: {
  result: FinnGenCohortOperationsResult;
}) {
  const evidence = result.operation_evidence ?? [];

  return (
    <div className="space-y-3">
      {evidence.map((item) => (
        <ProgressRow
          key={item.label}
          label={item.label}
          value={Number(item.value ?? 0)}
          total={Math.max(
            Number(
              result.operation_summary?.candidate_rows ??
                evidence[0]?.value ??
                1,
            ),
            1,
          )}
          color={
            item.emphasis === "result"
              ? "#2DD4BF"
              : item.emphasis === "delta"
                ? "#C9A227"
                : "#60A5FA"
          }
        />
      ))}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-300">
        Derived cohort:{" "}
        {String(
          result.operation_summary?.derived_cohort_label ??
            result.export_summary?.cohort_reference ??
            "Workbench cohort preview",
        )}
      </div>
    </div>
  );
}

function SelectedCohortsView({
  cohorts,
}: {
  cohorts: Array<{ id: number; name: string; description?: string | null }>;
}) {
  return (
    <div className="space-y-2">
      {cohorts.map((cohort) => (
        <div
          key={cohort.id}
          className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3"
        >
          <div className="text-sm font-medium text-zinc-100">{cohort.name}</div>
          <div className="mt-1 text-xs text-zinc-500">
            Parthenon cohort #{cohort.id}
          </div>
          {cohort.description ? (
            <div className="mt-2 text-sm text-zinc-400">
              {cohort.description}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CohortPlausibilityView({
  result,
}: {
  result: FinnGenCohortOperationsResult;
}) {
  const sampleRows = Array.isArray(result.sample_rows) ? result.sample_rows : [];
  const compileSummary = result.compile_summary ?? {};
  const cohortCount = Number(compileSummary.cohort_count ?? 0);
  const conceptSetCount = Number(compileSummary.concept_set_count ?? 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <PlausibilityBadge
          label="Rows surfaced"
          value={
            sampleRows.length
              ? `${sampleRows.length} sample rows`
              : "No samples"
          }
          tone={sampleRows.length ? "good" : "warn"}
        />
        <PlausibilityBadge
          label="Cohort scale"
          value={
            cohortCount > 0 ? cohortCount.toLocaleString() : "Unavailable"
          }
          tone={cohortCount > 0 ? "good" : "warn"}
        />
        <PlausibilityBadge
          label="Concept framing"
          value={
            conceptSetCount > 0
              ? `${conceptSetCount} concept sets`
              : "No concept sets"
          }
          tone={conceptSetCount > 0 ? "good" : "warn"}
        />
      </div>
      {sampleRows.length ? (
        <RecordTable
          rows={sampleRows.slice(0, 3) as Array<Record<string, unknown>>}
        />
      ) : (
        <EmptyState label="Live cohort sample rows will appear here when the CDM preview returns them." />
      )}
    </div>
  );
}

// ── Operation Builder Modal ──────────────────────────────────────────

interface OperationBuilderModalProps {
  open: boolean;
  onClose: () => void;
  cohortDefinitions: CohortDefinition[];
  selectedCohortIds: number[];
  onToggleCohort: (cohortId: number) => void;
  onReorderCohorts: (reordered: number[]) => void;
  primaryCohortId: number | null;
  onPrimaryCohortChange: (cohortId: number | null) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  importMode: (typeof cohortImportModes)[number]["value"];
  onImportModeChange: (
    value: (typeof cohortImportModes)[number]["value"],
  ) => void;
  operationType: (typeof cohortOperationTypes)[number]["value"];
  onOperationTypeChange: (
    value: (typeof cohortOperationTypes)[number]["value"],
  ) => void;
  matchingEnabled: boolean;
  onMatchingEnabledChange: (value: boolean) => void;
  matchingStrategy: (typeof cohortMatchingStrategies)[number]["value"];
  onMatchingStrategyChange: (
    value: (typeof cohortMatchingStrategies)[number]["value"],
  ) => void;
  matchingTarget: (typeof cohortMatchingTargets)[number]["value"];
  onMatchingTargetChange: (
    value: (typeof cohortMatchingTargets)[number]["value"],
  ) => void;
  matchingCovariates: string;
  onMatchingCovariatesChange: (value: string) => void;
  matchingRatio: string;
  onMatchingRatioChange: (value: string) => void;
  matchingCaliper: string;
  onMatchingCaliperChange: (value: string) => void;
  atlasCohortIds: string;
  onAtlasCohortIdsChange: (value: string) => void;
  atlasImportBehavior: (typeof cohortAtlasImportBehaviorOptions)[number]["value"];
  onAtlasImportBehaviorChange: (
    value: (typeof cohortAtlasImportBehaviorOptions)[number]["value"],
  ) => void;
  cohortTableName: string;
  onCohortTableNameChange: (value: string) => void;
  fileName: string;
  onFileNameChange: (value: string) => void;
  fileFormat: string;
  onFileFormatChange: (value: string) => void;
  fileRowCount: string;
  onFileRowCountChange: (value: string) => void;
  fileColumns: string;
  onFileColumnsChange: (value: string) => void;
  fileContents: string;
  onFileContentsChange: (value: string) => void;
  exportTarget: string;
  onExportTargetChange: (value: string) => void;
}

function OperationBuilderModal({
  open,
  onClose,
  cohortDefinitions,
  selectedCohortIds,
  onToggleCohort,
  onReorderCohorts,
  primaryCohortId,
  onPrimaryCohortChange,
  searchValue,
  onSearchChange,
  importMode,
  onImportModeChange,
  operationType,
  onOperationTypeChange,
  matchingEnabled,
  onMatchingEnabledChange,
  matchingStrategy,
  onMatchingStrategyChange,
  matchingTarget,
  onMatchingTargetChange,
  matchingCovariates,
  onMatchingCovariatesChange,
  matchingRatio,
  onMatchingRatioChange,
  matchingCaliper,
  onMatchingCaliperChange,
  atlasCohortIds,
  onAtlasCohortIdsChange,
  atlasImportBehavior,
  onAtlasImportBehaviorChange,
  cohortTableName,
  onCohortTableNameChange,
  fileName,
  onFileNameChange,
  fileFormat,
  onFileFormatChange,
  fileRowCount,
  onFileRowCountChange,
  fileColumns,
  onFileColumnsChange,
  fileContents,
  onFileContentsChange,
  exportTarget,
  onExportTargetChange,
}: OperationBuilderModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Operation Builder"
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="text-xs text-zinc-500">
            Builder choices are stored with the FINNGEN run and reused on
            replay.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg bg-[#9B1B30] px-4 py-2 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#7F1526]"
          >
            Apply Builder
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Import path
            </span>
            <select
              value={importMode}
              onChange={(e) =>
                onImportModeChange(
                  e.target.value as (typeof cohortImportModes)[number]["value"],
                )
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            >
              {cohortImportModes.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Operation type
            </span>
            <select
              value={operationType}
              onChange={(e) =>
                onOperationTypeChange(
                  e.target
                    .value as (typeof cohortOperationTypes)[number]["value"],
                )
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            >
              {cohortOperationTypes.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Atlas import behavior
            </span>
            <select
              value={atlasImportBehavior}
              onChange={(e) =>
                onAtlasImportBehaviorChange(
                  e.target
                    .value as (typeof cohortAtlasImportBehaviorOptions)[number]["value"],
                )
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            >
              {cohortAtlasImportBehaviorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-zinc-100">
                File payload
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Upload a CSV or JSON cohort file, or paste its contents directly.
              </div>
            </div>
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                onFileNameChange(file.name);
                const extension = file.name.split(".").pop()?.toLowerCase();
                onFileFormatChange(extension || fileFormat || "csv");
                const text = await file.text();
                onFileContentsChange(text);
                const inferredRows = Math.max(text.split(/\r\n|\n|\r/).filter(Boolean).length - 1, 1);
                onFileRowCountChange(String(inferredRows));
              }}
              className="block text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-[#9B1B30]/15 file:px-3 file:py-2 file:text-xs file:font-medium file:text-[#F0EDE8] hover:file:bg-[#9B1B30]/25"
            />
          </div>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              File contents
            </span>
            <textarea
              value={fileContents}
              onChange={(e) => onFileContentsChange(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            />
          </label>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-100">
            Existing Parthenon Cohorts
          </div>
          <input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter cohorts by name or description..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[#9B1B30] focus:outline-none"
          />
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {cohortDefinitions.map((cohort) => {
              const selected = selectedCohortIds.includes(cohort.id);
              const primary = primaryCohortId === cohort.id;
              return (
                <label
                  key={cohort.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors ${
                    selected
                      ? "border-[#9B1B30]/40 bg-[#9B1B30]/10"
                      : "border-zinc-800 bg-zinc-950/70 hover:border-zinc-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleCohort(cohort.id)}
                    className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-950 text-[#9B1B30] focus:ring-[#9B1B30]"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                      <span>{cohort.name}</span>
                      {primary ? (
                        <span className="rounded-full border border-[#C9A227]/40 bg-[#C9A227]/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#F2DEA3]">
                          Primary
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                      <span>Cohort #{cohort.id}</span>
                      {selected ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            onPrimaryCohortChange(primary ? null : cohort.id);
                          }}
                          className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300 transition-colors hover:border-[#9B1B30]/40 hover:text-white"
                        >
                          {primary ? "Unset primary" : "Set primary"}
                        </button>
                      ) : null}
                    </div>
                    {cohort.description ? (
                      <div className="mt-2 text-sm text-zinc-400">
                        {cohort.description}
                      </div>
                    ) : null}
                  </div>
                </label>
              );
            })}
            {!cohortDefinitions.length ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-4 text-sm text-zinc-500">
                No visible Parthenon cohorts match this filter.
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Selected cohort order (drag to reorder) ─────────────── */}
        {selectedCohortIds.length > 1 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">
              Cohort Order (drag to reorder)
            </div>
            <div className="space-y-1.5">
              {selectedCohortIds.map((id, index) => {
                const cohort = cohortDefinitions.find((c) => c.id === id);
                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(index));
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromIndex = Number(e.dataTransfer.getData("text/plain"));
                      const toIndex = index;
                      if (fromIndex === toIndex) return;
                      const reordered = [...selectedCohortIds];
                      const [moved] = reordered.splice(fromIndex, 1);
                      reordered.splice(toIndex, 0, moved);
                      onReorderCohorts(reordered);
                    }}
                    className="flex cursor-grab items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-700 active:cursor-grabbing"
                  >
                    <GripVertical className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-400">
                      {index + 1}
                    </span>
                    <span className="min-w-0 truncate">
                      {cohort?.name ?? `Cohort #${id}`}
                    </span>
                    {primaryCohortId === id ? (
                      <span className="ml-auto rounded-full border border-[#C9A227]/40 bg-[#C9A227]/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#F2DEA3]">
                        Primary
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[11px] text-zinc-600">
              The first cohort becomes the anchor for subtract operations.
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Atlas cohort IDs
            </span>
            <input
              value={atlasCohortIds}
              onChange={(e) => onAtlasCohortIdsChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Cohort table name
            </span>
            <input
              value={cohortTableName}
              onChange={(e) => onCohortTableNameChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              File name
            </span>
            <input
              value={fileName}
              onChange={(e) => onFileNameChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              File format
            </span>
            <input
              value={fileFormat}
              onChange={(e) => onFileFormatChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Estimated row count
            </span>
            <input
              value={fileRowCount}
              onChange={(e) => onFileRowCountChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Columns
            </span>
            <input
              value={fileColumns}
              onChange={(e) => onFileColumnsChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
            />
          </label>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-zinc-100">Matching</div>
              <div className="mt-1 text-xs text-zinc-500">
                Use the same guided setup style as the rest of Parthenon for
                matching and balance inputs.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={matchingEnabled}
              onClick={() => onMatchingEnabledChange(!matchingEnabled)}
              className={`inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                matchingEnabled ? "bg-[#9B1B30]" : "bg-zinc-700"
              }`}
            >
              <span
                className={`ml-1 h-4 w-4 rounded-full bg-white transition-transform ${
                  matchingEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Matching strategy
              </span>
              <select
                value={matchingStrategy}
                onChange={(e) =>
                  onMatchingStrategyChange(
                    e.target
                      .value as (typeof cohortMatchingStrategies)[number]["value"],
                  )
                }
                disabled={!matchingEnabled}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none disabled:opacity-50"
              >
                {cohortMatchingStrategies.map((strategy) => (
                  <option key={strategy.value} value={strategy.value}>
                    {strategy.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Matching target
              </span>
              <select
                value={matchingTarget}
                onChange={(e) =>
                  onMatchingTargetChange(
                    e.target
                      .value as (typeof cohortMatchingTargets)[number]["value"],
                  )
                }
                disabled={!matchingEnabled}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none disabled:opacity-50"
              >
                {cohortMatchingTargets.map((target) => (
                  <option key={target.value} value={target.value}>
                    {target.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Matching covariates
              </span>
              <input
                value={matchingCovariates}
                onChange={(e) => onMatchingCovariatesChange(e.target.value)}
                disabled={!matchingEnabled}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none disabled:opacity-50"
              />
            </label>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Match ratio
              </span>
              <input
                value={matchingRatio}
                onChange={(e) => onMatchingRatioChange(e.target.value)}
                disabled={!matchingEnabled}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Caliper
              </span>
              <input
                value={matchingCaliper}
                onChange={(e) => onMatchingCaliperChange(e.target.value)}
                disabled={!matchingEnabled}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none disabled:opacity-50"
              />
            </label>
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Export target / handoff
          </span>
          <input
            value={exportTarget}
            onChange={(e) => onExportTargetChange(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
          />
        </label>
      </div>
    </Modal>
  );
}

// ── Main CohortOpsTab component ──────────────────────────────────────

export function CohortOpsTab({
  selectedSource,
  cohortOpsContext,
  onHandoffToCo2,
}: {
  selectedSource: FinnGenSource | null;
  cohortOpsContext?: Record<string, unknown> | null;
  onHandoffToCo2: (
    context: Record<string, unknown>,
    cohortLabel: string,
    outcomeName: string,
  ) => void;
}) {
  const queryClient = useQueryClient();

  // ── Local state ──────────────────────────────────────────────────
  const [cohortJson, setCohortJson] = useState<string>(
    JSON.stringify(
      {
        conceptSets: [],
        PrimaryCriteria: {
          CriteriaList: [
            {
              ConditionOccurrence: {
                CodesetId: null,
                ConditionTypeExclude: false,
              },
            },
          ],
          ObservationWindow: { PriorDays: 0, PostDays: 0 },
        },
        AdditionalCriteria: null,
        QualifiedLimit: { Type: "First" },
        ExpressionLimit: { Type: "First" },
      },
      null,
      2,
    ),
  );
  const [cohortLabel, setCohortLabel] = useState("Acumenus diabetes cohort");
  const [operationBuilderOpen, setOperationBuilderOpen] = useState(false);
  const [cohortSearch, setCohortSearch] = useState("");
  const [cohortImportMode, setCohortImportMode] =
    useState<(typeof cohortImportModes)[number]["value"]>("parthenon");
  const [operationType, setOperationType] =
    useState<(typeof cohortOperationTypes)[number]["value"]>("union");
  const [selectedCohortIds, setSelectedCohortIds] = useState<number[]>([]);
  const [primaryCohortId, setPrimaryCohortId] = useState<number | null>(null);
  const [atlasCohortIds, setAtlasCohortIds] = useState("101, 202");
  const [atlasImportBehavior, setAtlasImportBehavior] =
    useState<(typeof cohortAtlasImportBehaviorOptions)[number]["value"]>("auto");
  const [cohortTableName, setCohortTableName] = useState("results.cohort");
  const [fileName, setFileName] = useState("cohort-import.csv");
  const [fileFormat, setFileFormat] = useState("csv");
  const [fileRowCount, setFileRowCount] = useState("128");
  const [fileColumns, setFileColumns] = useState(
    "person_id, cohort_start_date, concept_id",
  );
  const [fileContents, setFileContents] = useState(
    "person_id,cohort_start_date,concept_id\n1001,2025-01-15,201826\n1044,2025-02-03,319835\n",
  );
  const [matchingEnabled, setMatchingEnabled] = useState(true);
  const [matchingStrategy, setMatchingStrategy] =
    useState<(typeof cohortMatchingStrategies)[number]["value"]>(
      "nearest-neighbor",
    );
  const [matchingTarget, setMatchingTarget] =
    useState<(typeof cohortMatchingTargets)[number]["value"]>(
      "primary_vs_comparators",
    );
  const [matchingCovariates, setMatchingCovariates] = useState<string>(
    defaultMatchingCovariates.join(", "),
  );
  const [matchingRatio, setMatchingRatio] = useState("1.0");
  const [matchingCaliper, setMatchingCaliper] = useState("0.20");
  const [exportTarget, setExportTarget] = useState(
    "results.finngen_cohort_preview",
  );
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [compareRunId, setCompareRunId] = useState<number | null>(null);

  // Apply HADES handoff context
  useEffect(() => {
    if (!cohortOpsContext) return;
    if (typeof cohortOpsContext.cohort_table === "string") {
      setCohortTableName(cohortOpsContext.cohort_table);
    }
    if (typeof cohortOpsContext.package_name === "string") {
      setExportTarget(`results.finngen_${String(cohortOpsContext.package_name).toLowerCase()}_preview`);
    }
  }, [cohortOpsContext]);

  // ── Queries ──────────────────────────────────────────────────────
  const cohortDefinitionsQuery = useCohortDefinitions({ limit: 50 });
  const selectedPrimaryCohortId = selectedCohortIds[0] ?? null;
  const selectedPrimaryCohortQuery = useCohortDefinition(
    selectedPrimaryCohortId,
  );

  const runsQuery = useQuery({
    queryKey: [
      "finngen-runs",
      "finngen_cohort_operations",
      selectedSource?.id,
    ],
    queryFn: () =>
      fetchFinnGenRuns({
        service_name: "finngen_cohort_operations",
        source_id: selectedSource?.id ?? undefined,
        limit: 8,
      }),
    enabled: Boolean(selectedSource?.id),
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
    queryKey: ["finngen-run-export", selectedRunId],
    queryFn: () => exportFinnGenRun(selectedRunId as number),
    enabled: Boolean(selectedRunId),
  });

  // ── Derived data ─────────────────────────────────────────────────
  const cohortDefinitions = cohortDefinitionsQuery.data?.items ?? [];
  const filteredCohorts = cohortDefinitions.filter((cohort) => {
    const search = cohortSearch.trim().toLowerCase();
    if (!search) return true;
    return (
      cohort.name.toLowerCase().includes(search) ||
      (cohort.description ?? "").toLowerCase().includes(search)
    );
  });

  const selectedCohortDefinitions = selectedCohortIds
    .map((id) => cohortDefinitions.find((cohort) => cohort.id === id))
    .filter((cohort): cohort is CohortDefinition => Boolean(cohort));
  const selectedCohortLabels = selectedCohortDefinitions.map(
    (cohort) => cohort.name,
  );

  const effectiveCohortDefinition = useMemo(() => {
    if (
      cohortImportMode === "parthenon" &&
      selectedPrimaryCohortQuery.data?.expression_json
    ) {
      return selectedPrimaryCohortQuery.data
        .expression_json as Record<string, unknown>;
    }
    return safeParseJson(cohortJson);
  }, [cohortImportMode, selectedPrimaryCohortQuery.data, cohortJson]);

  // ── Effects ──────────────────────────────────────────────────────
  useEffect(() => {
    setSelectedRunId(null);
    setCompareRunId(null);
  }, [selectedSource?.id]);

  useEffect(() => {
    const runs = runsQuery.data ?? [];
    if (!runs.length) return;
    setSelectedRunId((current) =>
      runs.some((run) => run.id === current) ? current : (runs[0]?.id ?? null),
    );
  }, [runsQuery.data]);

  useEffect(() => {
    if (!selectedCohortIds.length) {
      setPrimaryCohortId(null);
      return;
    }
    setPrimaryCohortId((current) =>
      current && selectedCohortIds.includes(current)
        ? current
        : selectedCohortIds[0],
    );
  }, [selectedCohortIds]);

  // ── Mutations ────────────────────────────────────────────────────
  const cohortMutation = useMutation({
    mutationFn: () =>
      previewFinnGenCohortOperations({
        source: requireSource(selectedSource),
        cohort_definition: effectiveCohortDefinition,
        import_mode: cohortImportMode,
        operation_type: operationType,
        atlas_cohort_ids: parseIntegerList(atlasCohortIds),
        atlas_import_behavior: atlasImportBehavior,
        cohort_table_name: cohortTableName,
        file_name: fileName,
        file_format: fileFormat,
        file_row_count: Number.parseInt(fileRowCount, 10) || 0,
        file_columns: parseStringList(fileColumns),
        file_contents: fileContents,
        selected_cohort_ids: selectedCohortIds,
        selected_cohort_labels: selectedCohortLabels,
        primary_cohort_id: primaryCohortId,
        matching_enabled: matchingEnabled,
        matching_strategy: matchingStrategy,
        matching_target: matchingTarget,
        matching_covariates: parseStringList(matchingCovariates),
        matching_ratio: Number.parseFloat(matchingRatio) || 1,
        matching_caliper: Number.parseFloat(matchingCaliper) || 0.2,
        export_target: exportTarget,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "finngen-runs",
          "finngen_cohort_operations",
          selectedSource?.id,
        ],
      });
    },
  });

  const replayRunMutation = useMutation({
    mutationFn: (runId: number) => replayFinnGenRun(runId),
    onSuccess: async (run) => {
      await queryClient.invalidateQueries({
        queryKey: [
          "finngen-runs",
          "finngen_cohort_operations",
          selectedSource?.id,
        ],
      });
      if (run?.id) {
        setSelectedRunId(run.id);
        setCompareRunId(null);
        queryClient.invalidateQueries({
          queryKey: ["finngen-run", run.id],
        });
      }
    },
  });

  // ── Handoff helper ───────────────────────────────────────────────
  const handleHandoff = () => {
    const exportSummary = cohortMutation.data?.export_summary ?? {};
    const operationSummary = cohortMutation.data?.operation_summary ?? {};
    const matchingSummary = cohortMutation.data?.matching_summary ?? {};
    const compileSummary = cohortMutation.data?.compile_summary ?? {};
    const selectedCohorts = cohortMutation.data?.selected_cohorts ?? [];

    const derivedCohortLabel = String(
      exportSummary?.cohort_reference ??
        exportSummary?.export_target ??
        exportTarget,
    );
    const derivedOutcomeName = `${String(exportSummary?.operation_type ?? operationType)} cohort outcome`;

    const cohortContext: Record<string, unknown> = {
      cohort_reference: exportSummary?.cohort_reference ?? null,
      export_target: exportSummary?.export_target ?? null,
      operation_type: exportSummary?.operation_type ?? operationType,
      result_rows:
        exportSummary?.result_rows ??
        operationSummary?.result_rows ??
        matchingSummary?.matched_rows ??
        compileSummary?.derived_result_rows ??
        null,
      retained_ratio:
        operationSummary?.retained_ratio ??
        (typeof matchingSummary?.matched_rows === "number" &&
        typeof matchingSummary?.eligible_rows === "number" &&
        (matchingSummary.eligible_rows as number) > 0
          ? Number(
              (
                (matchingSummary.matched_rows as number) /
                (matchingSummary.eligible_rows as number)
              ).toFixed(3),
            )
          : null),
      selected_cohorts: selectedCohorts.map((cohort) => cohort.name),
    };

    onHandoffToCo2(cohortContext, derivedCohortLabel, derivedOutcomeName);
  };

  // ── Render ───────────────────────────────────────────────────────
  const isLoading = cohortMutation.isPending;
  const result = cohortMutation.data;
  const handoffReady = Boolean(result?.export_summary?.handoff_ready);

  return (
    <div className="space-y-4">
      {/* ── Controls: Operation Builder card ────────────────────── */}
      <button
        type="button"
        onClick={() => setOperationBuilderOpen(true)}
        className="flex w-full items-start gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 text-left transition-colors hover:border-[#9B1B30]/40"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#9B1B30]/15">
          <Blocks className="h-5 w-5 text-[#9B1B30]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white">
            Operation Builder
          </div>
          <p className="mt-1 text-sm leading-6 text-zinc-400">
            Configure import path, operation type, cohort selection, matching
            strategy, and export target. Click to open the builder dialog.
          </p>
          <div className="mt-2 text-xs text-zinc-500">
            {cohortImportModes.find((mode) => mode.value === cohortImportMode)
              ?.label}{" "}
            ·{" "}
            {cohortOperationTypes.find((mode) => mode.value === operationType)
              ?.label}{" "}
            ·{" "}
            {matchingEnabled
              ? cohortMatchingStrategies.find(
                  (strategy) => strategy.value === matchingStrategy,
                )?.label
              : "Matching disabled"}
          </div>
        </div>
      </button>

      {/* ── Controls: Selected cohorts chips ─────────────────────── */}
      {selectedCohortLabels.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Selected:
          </span>
          {selectedCohortDefinitions.map((cohort) => (
            <span
              key={cohort.id}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                primaryCohortId === cohort.id
                  ? "border-[#C9A227]/40 bg-[#C9A227]/10 text-[#F2DEA3]"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300"
              }`}
            >
              {cohort.name}
              {primaryCohortId === cohort.id ? (
                <span className="text-[10px] uppercase tracking-wide">
                  primary
                </span>
              ) : null}
            </span>
          ))}
          {primaryCohortId ? (
            <span className="text-xs text-zinc-500">
              Target:{" "}
              {cohortMatchingTargets.find(
                (target) => target.value === matchingTarget,
              )?.label}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* ── Controls: Run button ─────────────────────────────────── */}
      <ActionButton
        label="Run Cohort Preview"
        onClick={() => cohortMutation.mutate()}
        loading={isLoading}
        disabled={
          !selectedSource ||
          (cohortImportMode === "parthenon" && selectedCohortIds.length === 0)
        }
      />

      {/* ── Loading hint for Parthenon cohort definition ────────── */}
      {cohortImportMode === "parthenon" &&
      selectedPrimaryCohortQuery.isLoading ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-400">
          Loading the primary Parthenon cohort definition for preview
          compilation.
        </div>
      ) : null}

      {/* ── Controls: Raw JSON Definition (collapsed) ────────────── */}
      <CollapsibleSection title="Raw JSON Definition">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {cohortPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setCohortJson(preset.value)}
                className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-[#9B1B30]/40 hover:text-white"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <textarea
            value={cohortJson}
            onChange={(e) => setCohortJson(e.target.value)}
            rows={16}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 font-mono text-sm text-zinc-100 focus:border-[#9B1B30] focus:outline-none"
          />
        </div>
      </CollapsibleSection>

      {/* ── Error banner ─────────────────────────────────────────── */}
      {cohortMutation.isError ? (
        <ErrorBanner message={getErrorMessage(cohortMutation.error)} />
      ) : null}

      {/* ── Pre-run empty state ──────────────────────────────────── */}
      {!result && !isLoading ? (
        <EmptyState label="Select cohorts and run a preview." />
      ) : null}

      {/* ── Handoff button (top of results, only when ready) ─────── */}
      {result?.export_summary && handoffReady ? (
        <button
          type="button"
          onClick={handleHandoff}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#9B1B30] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#9B1B30]/80"
        >
          <ArrowUpRight className="h-4 w-4" />
          Hand Off To CO2 Modules
        </button>
      ) : null}

      {/* ── Key Result 1: Compile Summary ────────────────────────── */}
      <ResultSection
        title="Compile Summary"
        data={result?.compile_summary}
        loading={isLoading}
      >
        <KeyValueGrid data={result?.compile_summary ?? {}} />
      </ResultSection>

      {/* ── Key Result 2: Attrition Funnel ───────────────────────── */}
      <ResultSection
        title="Attrition Funnel"
        data={result?.attrition}
        loading={isLoading}
      >
        {result ? <AttritionView result={result} /> : null}
      </ResultSection>

      {/* ── Key Result 3: Export & Handoff ───────────────────────── */}
      <ResultSection
        title="Export & Handoff"
        data={result?.export_summary}
        loading={isLoading}
      >
        {result?.export_summary ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleHandoff}
              disabled={!handoffReady}
              className="inline-flex items-center gap-2 rounded-lg border border-[#9B1B30]/30 bg-[#9B1B30]/10 px-3 py-2 text-sm font-medium text-[#F0EDE8] transition-colors hover:bg-[#9B1B30]/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowUpRight className="h-4 w-4" />
              Hand Off To CO2 Modules
            </button>
            <KeyValueGrid data={result.export_summary} />
            {result.export_manifest?.length ? (
              <RecordTable
                rows={result.export_manifest as Array<Record<string, unknown>>}
              />
            ) : null}
            {result.export_bundle && Object.keys(result.export_bundle).length ? (
              <div className="space-y-3">
                <KeyValueGrid data={result.export_bundle} />
                <ActionButton
                  label="Download bundle"
                  onClick={() =>
                    downloadJson(
                      result.export_bundle?.download_name ??
                        "cohort-ops-export-bundle.json",
                      result.export_bundle,
                    )
                  }
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </ResultSection>

      {/* ── Detailed Results (collapsed) ─────────────────────────── */}
      <CollapsibleSection title="Detailed Results">
        <div className="space-y-4">
          <ResultSection
            title="Criteria Timeline"
            data={result?.criteria_timeline?.length}
            loading={isLoading}
          >
            {result ? <TimelineView items={result.criteria_timeline} /> : null}
          </ResultSection>

          <ResultSection
            title="Import & Export"
            data={result}
            loading={isLoading}
          >
            {result ? (
              <ImportExportView
                importMode={cohortImportMode}
                onImportModeChange={setCohortImportMode}
                result={result}
              />
            ) : null}
          </ResultSection>

          <ResultSection
            title="Matching Review"
            data={result}
            loading={isLoading}
          >
            {result ? <MatchingReviewView result={result} /> : null}
          </ResultSection>

          <ResultSection
            title="Operation Summary"
            data={result?.operation_summary}
            loading={isLoading}
          >
            <KeyValueGrid data={result?.operation_summary ?? {}} />
          </ResultSection>

          <ResultSection
            title="Operation Evidence"
            data={result?.operation_evidence?.length}
            loading={isLoading}
          >
            {result ? <OperationEvidenceView result={result} /> : null}
          </ResultSection>

          <ResultSection
            title="Operation Comparison"
            data={result?.operation_comparison?.length}
            loading={isLoading}
          >
            <LabelValueList
              items={(result?.operation_comparison ?? []).map((item) => ({
                label: item.label,
                value: String(item.value),
              }))}
            />
          </ResultSection>

          <ResultSection
            title="Selected Cohorts"
            data={result?.selected_cohorts?.length}
            loading={isLoading}
          >
            <SelectedCohortsView cohorts={result?.selected_cohorts ?? []} />
          </ResultSection>

          <ResultSection
            title="Import Review"
            data={result?.import_review?.length}
            loading={isLoading}
          >
            <StatusListView items={result?.import_review ?? []} />
          </ResultSection>

          <ResultSection
            title="Cohort Table Summary"
            data={
              result?.cohort_table_summary &&
              Object.keys(result.cohort_table_summary).length
            }
            loading={isLoading}
          >
            <KeyValueGrid data={result?.cohort_table_summary ?? {}} />
          </ResultSection>

          <ResultSection
            title="Atlas Concept Set Remap"
            data={result?.atlas_concept_set_summary?.length}
            loading={isLoading}
          >
            <RecordTable
              rows={
                (result?.atlas_concept_set_summary ?? []) as Array<Record<string, unknown>>
              }
            />
          </ResultSection>

          <ResultSection
            title="Atlas Import Diagnostics"
            data={
              result?.atlas_import_diagnostics &&
              Object.keys(result.atlas_import_diagnostics).length
            }
            loading={isLoading}
          >
            <KeyValueGrid data={result?.atlas_import_diagnostics ?? {}} />
          </ResultSection>

          <ResultSection
            title="File Import Summary"
            data={
              result?.file_import_summary &&
              Object.keys(result.file_import_summary).length
            }
            loading={isLoading}
          >
            <KeyValueGrid data={result?.file_import_summary ?? {}} />
          </ResultSection>

          <ResultSection
            title="Compiled SQL"
            data={result?.sql_preview}
            loading={isLoading}
          >
            <CodeBlock
              title="Preview SQL"
              code={result?.sql_preview ?? ""}
            />
          </ResultSection>

          <ResultSection
            title="Sample Rows"
            data={result?.sample_rows?.length}
            loading={isLoading}
          >
            <RecordTable rows={result?.sample_rows ?? []} />
          </ResultSection>

          <ResultSection
            title="Plausibility Sample"
            data={result}
            loading={isLoading}
          >
            {result ? <CohortPlausibilityView result={result} /> : null}
          </ResultSection>
        </div>
      </CollapsibleSection>

      {/* ── Run History (collapsed at bottom) ────────────────────── */}
      <CollapsibleSection title="Run History">
        <div className="space-y-4">
          {runsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading runs...
            </div>
          ) : runsQuery.data?.length ? (
            <>
              <RecentRunsView
                runs={runsQuery.data}
                selectedRunId={selectedRunId}
                onSelect={setSelectedRunId}
              />
              {runDetailQuery.isLoading ? (
                <div className="flex items-center gap-2 py-4 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading run details...
                </div>
              ) : runDetailQuery.data ? (
                <>
                  <PersistedCohortRunArtifacts
                    resultPayload={
                      (runDetailQuery.data.result_payload ??
                        {}) as Record<string, unknown>
                    }
                    exportPayload={exportBundleQuery.data ?? null}
                  />
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
                </>
              ) : (
                <EmptyState label="Select a persisted run to inspect its request, runtime, artifacts, and stored result payload." />
              )}
              {runDetailQuery.data ? (
                <RunComparisonPanel
                  runs={runsQuery.data ?? []}
                  selectedRun={runDetailQuery.data}
                  compareRun={compareRunDetailQuery.data}
                  compareRunId={compareRunId}
                  onCompareRunChange={setCompareRunId}
                />
              ) : null}
            </>
          ) : (
            <EmptyState label="Run history will appear here once executions are persisted." />
          )}
        </div>
      </CollapsibleSection>

      {/* ── Diagnostics (collapsed at bottom) ────────────────────── */}
      <CollapsibleSection title="Diagnostics">
        <RuntimePanel runtime={result?.runtime} />
        {!result?.runtime ? (
          <EmptyState label="Runtime diagnostics will appear after a preview run." />
        ) : null}
      </CollapsibleSection>

      {/* ── Operation Builder Modal ──────────────────────────────── */}
      <OperationBuilderModal
        open={operationBuilderOpen}
        onClose={() => setOperationBuilderOpen(false)}
        cohortDefinitions={filteredCohorts}
        selectedCohortIds={selectedCohortIds}
        onToggleCohort={(cohortId) => {
          setSelectedCohortIds((current) =>
            current.includes(cohortId)
              ? current.filter((id) => id !== cohortId)
              : [...current, cohortId],
          );
          setCohortImportMode("parthenon");
        }}
        onReorderCohorts={setSelectedCohortIds}
        primaryCohortId={primaryCohortId}
        onPrimaryCohortChange={setPrimaryCohortId}
        searchValue={cohortSearch}
        onSearchChange={setCohortSearch}
        importMode={cohortImportMode}
        onImportModeChange={setCohortImportMode}
        operationType={operationType}
        onOperationTypeChange={setOperationType}
        matchingEnabled={matchingEnabled}
        onMatchingEnabledChange={setMatchingEnabled}
        matchingStrategy={matchingStrategy}
        onMatchingStrategyChange={setMatchingStrategy}
        matchingTarget={matchingTarget}
        onMatchingTargetChange={setMatchingTarget}
        matchingCovariates={matchingCovariates}
        onMatchingCovariatesChange={setMatchingCovariates}
        matchingRatio={matchingRatio}
        onMatchingRatioChange={setMatchingRatio}
        matchingCaliper={matchingCaliper}
        onMatchingCaliperChange={setMatchingCaliper}
        atlasCohortIds={atlasCohortIds}
        onAtlasCohortIdsChange={setAtlasCohortIds}
        atlasImportBehavior={atlasImportBehavior}
        onAtlasImportBehaviorChange={setAtlasImportBehavior}
        cohortTableName={cohortTableName}
        onCohortTableNameChange={setCohortTableName}
        fileName={fileName}
        onFileNameChange={setFileName}
        fileFormat={fileFormat}
        onFileFormatChange={setFileFormat}
        fileRowCount={fileRowCount}
        onFileRowCountChange={setFileRowCount}
        fileColumns={fileColumns}
        onFileColumnsChange={setFileColumns}
        fileContents={fileContents}
        onFileContentsChange={setFileContents}
        exportTarget={exportTarget}
        onExportTargetChange={setExportTarget}
      />
    </div>
  );
}
