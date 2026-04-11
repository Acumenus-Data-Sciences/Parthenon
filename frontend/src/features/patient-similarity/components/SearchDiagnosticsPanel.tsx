import { useState } from "react";
import { Activity, ChevronDown, ChevronRight, Database, Filter, GitBranch, Timer } from "lucide-react";
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

function formatFilters(filters: SimilarityFilters | undefined): string {
  if (!filters) return "None";

  const parts: string[] = [];

  if (filters.age_range) {
    parts.push(`Age ${filters.age_range[0]}-${filters.age_range[1]}`);
  }

  if (filters.gender_concept_id === 8507) {
    parts.push("Male");
  } else if (filters.gender_concept_id === 8532) {
    parts.push("Female");
  }

  return parts.join(" · ") || "None";
}

export function SearchDiagnosticsPanel({
  metadata,
  seed,
  computeStatus,
}: SearchDiagnosticsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const filters = metadata.filters_applied as SimilarityFilters | undefined;

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised px-5 py-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[11px] font-semibold text-text-ghost uppercase tracking-[0.5px]">
          Search Diagnostics
        </span>
        {isOpen ? (
          <ChevronDown size={14} className="text-text-ghost" />
        ) : (
          <ChevronRight size={14} className="text-text-ghost" />
        )}
      </button>

      {isOpen && (
        <div className="mt-4 grid grid-cols-1 xl:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border-default bg-surface-base p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.5px] text-text-ghost">
              <Database size={12} className="text-success" />
              Candidate Pool
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-text-secondary">
              <div>Total candidates: {metadata.total_candidates ?? metadata.candidates_evaluated ?? "\u2014"}</div>
              <div>Loaded: {metadata.candidates_loaded ?? metadata.candidates_evaluated ?? "\u2014"}</div>
              <div>Returned: {metadata.returned_count ?? "\u2014"}</div>
              <div className="text-text-muted">
                {metadata.sql_prescored ? "SQL pre-screened before full scoring" : "Full scoring over candidate set"}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border-default bg-surface-base p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.5px] text-text-ghost">
              <Filter size={12} className="text-accent" />
              Query Contract
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-text-secondary">
              <div>Filters: {formatFilters(filters)}</div>
              <div>Min score: {metadata.min_score ?? "\u2014"}</div>
              <div>Limit: {metadata.limit ?? "\u2014"}</div>
              <div>Temporal window: {metadata.temporal_window_days ? `${metadata.temporal_window_days} days` : "\u2014"}</div>
            </div>
          </div>

          <div className="rounded-lg border border-border-default bg-surface-base p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.5px] text-text-ghost">
              <GitBranch size={12} className="text-primary" />
              Provenance
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-text-secondary">
              <div>Vector version: {seed.feature_vector_version ?? metadata.feature_vector_version ?? "\u2014"}</div>
              <div>Seed anchor: {formatDate(seed.anchor_date ?? metadata.seed_anchor_date)}</div>
              <div>Computed: {formatDate(metadata.computed_at)}</div>
              <div className="text-text-muted">Query hash: {typeof metadata.query_hash === "string" ? metadata.query_hash.slice(0, 12) : "\u2014"}</div>
            </div>
          </div>

          <div className="rounded-lg border border-border-default bg-surface-base p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.5px] text-text-ghost">
              <Timer size={12} className="text-success" />
              Source Readiness
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-text-secondary">
              <div>Latest vectors: {formatDate(computeStatus?.latest_computed_at)}</div>
              <div>Embeddings ready: {computeStatus ? (computeStatus.embeddings_ready ? "Yes" : "No") : "\u2014"}</div>
              <div>Recommended mode: {computeStatus?.recommended_mode ?? "\u2014"}</div>
              <div className={computeStatus?.staleness_warning ? "text-critical" : "text-text-muted"}>
                {computeStatus?.staleness_warning ? "Vectors may be stale" : "No staleness warning"}
              </div>
            </div>
          </div>

          {metadata.weights && (
            <div className="xl:col-span-4 rounded-lg border border-border-default bg-surface-base p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.5px] text-text-ghost">
                <Activity size={12} className="text-success" />
                Dimension Weights
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(metadata.weights).map(([key, value]) => (
                  <span
                    key={key}
                    className="inline-flex items-center rounded-full border border-border-default bg-surface-raised px-2 py-0.5 text-xs text-text-secondary"
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
