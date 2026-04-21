import { useState } from "react";
import { Activity, ChevronDown, ChevronRight, Database, Filter, GitBranch, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getSimilarityGenderLabel, getSimilarityModeLabel } from "../lib/i18n";
import type {
  ComputeStatus,
  SimilarityFilters,
  SimilaritySearchMetadata,
  SeedPatient,
} from "../types/patientSimilarity";

interface SearchDiagnosticsPanelProps {
  metadata: SimilaritySearchMetadata;
  seed: SeedPatient;
  computeStatus?: ComputeStatus;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "\u2014";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFilters(
  t: ReturnType<typeof useTranslation<"app">>["t"],
  filters: SimilarityFilters | undefined,
): string {
  if (!filters) return t("patientSimilarity.diagnostics.noFilters");

  const parts: string[] = [];

  if (filters.age_range) {
    parts.push(
      t("patientSimilarity.diagnostics.ageFilter", {
        min: filters.age_range[0],
        max: filters.age_range[1],
      }),
    );
  }

  if (filters.gender_concept_id === 8507) {
    parts.push(getSimilarityGenderLabel(t, 8507));
  } else if (filters.gender_concept_id === 8532) {
    parts.push(getSimilarityGenderLabel(t, 8532));
  }

  return parts.join(" · ") || t("patientSimilarity.diagnostics.noFilters");
}

export function SearchDiagnosticsPanel({
  metadata,
  seed,
  computeStatus,
}: SearchDiagnosticsPanelProps) {
  const { t } = useTranslation("app");
  const [isOpen, setIsOpen] = useState(false);
  const filters = metadata.filters_applied as SimilarityFilters | undefined;

  return (
    <div className="rounded-xl border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] px-5 py-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.5px]">
          {t("patientSimilarity.diagnostics.title")}
        </span>
        {isOpen ? (
          <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
        ) : (
          <ChevronRight size={14} className="text-[var(--color-text-muted)]" />
        )}
      </button>

      {isOpen && (
        <div className="mt-4 grid grid-cols-1 xl:grid-cols-4 gap-3">
          <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.5px] text-[var(--color-text-muted)]">
              <Database size={12} className="text-[var(--color-primary)]" />
              {t("patientSimilarity.diagnostics.candidatePool")}
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-[var(--color-text-primary)]">
              <div>{t("patientSimilarity.diagnostics.totalCandidates", { value: metadata.total_candidates ?? metadata.candidates_evaluated ?? "\u2014" })}</div>
              <div>{t("patientSimilarity.diagnostics.loaded", { value: metadata.candidates_loaded ?? metadata.candidates_evaluated ?? "\u2014" })}</div>
              <div>{t("patientSimilarity.diagnostics.returned", { value: metadata.returned_count ?? "\u2014" })}</div>
              <div className="text-[var(--color-text-secondary)]">
                {metadata.sql_prescored
                  ? t("patientSimilarity.diagnostics.sqlPrescored")
                  : t("patientSimilarity.diagnostics.fullScoring")}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.5px] text-[var(--color-text-muted)]">
              <Filter size={12} className="text-[var(--color-primary)]" />
              {t("patientSimilarity.diagnostics.queryContract")}
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-[var(--color-text-primary)]">
              <div>{t("patientSimilarity.diagnostics.filters", { value: formatFilters(t, filters) })}</div>
              <div>{t("patientSimilarity.diagnostics.minScore", { value: metadata.min_score ?? "\u2014" })}</div>
              <div>{t("patientSimilarity.diagnostics.limit", { value: metadata.limit ?? "\u2014" })}</div>
              <div>{t("patientSimilarity.diagnostics.temporalWindow", {
                value: metadata.temporal_window_days
                  ? t("patientSimilarity.diagnostics.temporalDays", {
                      count: metadata.temporal_window_days,
                    })
                  : "\u2014",
              })}</div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.5px] text-[var(--color-text-muted)]">
              <GitBranch size={12} className="text-[var(--color-critical)]" />
              {t("patientSimilarity.diagnostics.provenance")}
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-[var(--color-text-primary)]">
              <div>{t("patientSimilarity.diagnostics.vectorVersion", { value: seed.feature_vector_version ?? metadata.feature_vector_version ?? "\u2014" })}</div>
              <div>{t("patientSimilarity.diagnostics.seedAnchor", { value: formatDate(seed.anchor_date ?? metadata.seed_anchor_date) })}</div>
              <div>{t("patientSimilarity.diagnostics.computed", { value: formatDate(metadata.computed_at) })}</div>
              <div className="text-[var(--color-text-secondary)]">{t("patientSimilarity.diagnostics.queryHash", { value: typeof metadata.query_hash === "string" ? metadata.query_hash.slice(0, 12) : "\u2014" })}</div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.5px] text-[var(--color-text-muted)]">
              <Timer size={12} className="text-[var(--color-primary)]" />
              {t("patientSimilarity.diagnostics.sourceReadiness")}
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-[var(--color-text-primary)]">
              <div>{t("patientSimilarity.diagnostics.latestVectors", { value: formatDate(computeStatus?.latest_computed_at) })}</div>
              <div>{t("patientSimilarity.diagnostics.embeddingsReady", {
                value: computeStatus
                  ? computeStatus.embeddings_ready
                    ? t("patientSimilarity.common.yes")
                    : t("patientSimilarity.common.no")
                  : "\u2014",
              })}</div>
              <div>{t("patientSimilarity.diagnostics.recommendedMode", {
                value: computeStatus?.recommended_mode
                  ? getSimilarityModeLabel(
                      t,
                      computeStatus.recommended_mode as "auto" | "interpretable" | "embedding",
                    )
                  : "\u2014",
              })}</div>
              <div className={computeStatus?.staleness_warning ? "text-[var(--color-critical)]" : "text-[var(--color-text-secondary)]"}>
                {computeStatus?.staleness_warning
                  ? t("patientSimilarity.diagnostics.stale")
                  : t("patientSimilarity.diagnostics.notStale")}
              </div>
            </div>
          </div>

          {metadata.weights && (
            <div className="xl:col-span-4 rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.5px] text-[var(--color-text-muted)]">
                <Activity size={12} className="text-[var(--color-primary)]" />
                {t("patientSimilarity.diagnostics.dimensionWeights")}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(metadata.weights).map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex items-center rounded-full border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] px-2 py-0.5 text-xs text-[var(--color-text-primary)]"
                  >
                    {key}: {value.toFixed(1)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
