import { useState } from "react";
import { Loader2, Users, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIER_COLORS } from "../types/riskScore";
import { useExecutionPatients } from "../hooks/useRiskScores";

const TIER_PILLS = ["low", "intermediate", "high", "very_high"] as const;

function tierLabel(tier: string): string {
  return tier.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface PatientsTabProps {
  analysisId: number;
  executionId: number | null;
  scoreIds: string[];
  onCreateCohort: (scoreId: string, tier: string | undefined, personIds: number[]) => void;
}

export function PatientsTab({
  analysisId,
  executionId,
  scoreIds,
  onCreateCohort,
}: PatientsTabProps) {
  const [page, setPage] = useState(1);
  const [filterScoreId, setFilterScoreId] = useState<string | undefined>();
  const [filterTier, setFilterTier] = useState<string | undefined>();

  const { data, isLoading } = useExecutionPatients(
    analysisId,
    executionId,
    { page, per_page: 50, score_id: filterScoreId, risk_tier: filterTier },
  );

  const isFilterActive = filterScoreId != null || filterTier != null;
  const totalPages = data?.last_page ?? 1;
  const perPage = data?.per_page ?? 50;
  const total = data?.total ?? 0;
  const patients = data?.data ?? [];

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  // Empty state (no execution selected)
  if (executionId == null) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-surface-overlay mb-4">
          <Users size={24} className="text-text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">No execution selected</h3>
        <p className="mt-2 text-sm text-text-muted">
          Run an execution to view patient-level results.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={filterScoreId ?? ""}
          onChange={(e) => {
            setFilterScoreId(e.target.value || undefined);
            setPage(1);
          }}
          className="rounded-lg border border-[#2A2A2F] bg-[#141418] px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-success"
        >
          <option value="">All Scores</option>
          {scoreIds.map((sid) => (
            <option key={sid} value={sid}>
              {sid}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { setFilterTier(undefined); setPage(1); }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filterTier == null
                ? "bg-success/15 text-success"
                : "bg-surface-overlay text-text-muted hover:text-text-secondary",
            )}
          >
            All
          </button>
          {TIER_PILLS.map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => { setFilterTier(filterTier === tier ? undefined : tier); setPage(1); }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filterTier === tier
                  ? "text-surface-base"
                  : "bg-surface-overlay text-text-muted hover:text-text-secondary",
              )}
              style={
                filterTier === tier
                  ? { backgroundColor: TIER_COLORS[tier] ?? "var(--text-muted)" }
                  : undefined
              }
            >
              {tierLabel(tier)}
            </button>
          ))}
        </div>

        <span className="ml-auto text-sm text-text-ghost">
          Showing {total} patients
        </span>
      </div>

      {/* Bulk action bar */}
      {isFilterActive && patients.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-[#2A2A2F] bg-surface-overlay px-4 py-2">
          <button
            type="button"
            onClick={() =>
              onCreateCohort(
                filterScoreId ?? "",
                filterTier,
                patients.map((r) => r.person_id),
              )
            }
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-1.5 text-sm font-medium text-surface-base transition-colors hover:bg-success/80"
          >
            <Users size={14} />
            Create Cohort from Filter
          </button>
          <span className="text-xs text-text-muted">
            {patients.length} patients on this page
          </span>
        </div>
      )}

      {/* Table */}
      {patients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-surface-overlay mb-4">
            <Users size={24} className="text-text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary">
            No patient results available
          </h3>
          <p className="mt-2 text-sm text-text-muted">
            {isFilterActive
              ? "Try adjusting your filters to see results."
              : "Execute the analysis to generate patient-level scores."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-overlay">
                {["Person ID", "Score", "Value", "Risk Tier", "Confidence", "Completeness", "Missing"].map(
                  (header) => (
                    <th
                      key={header}
                      className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost"
                    >
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {patients.map((r, i) => {
                const tierColor = TIER_COLORS[r.risk_tier] ?? "var(--text-muted)";
                const missingKeys = r.missing_components
                  ? Object.keys(r.missing_components)
                  : [];

                return (
                  <tr
                    key={r.id}
                    className={cn(
                      "border-t border-surface-overlay transition-colors hover:bg-surface-overlay",
                      i % 2 === 0 ? "bg-[#141418]" : "bg-surface-overlay",
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          window.open(`/profiles?person=${r.person_id}`, "_blank")
                        }
                        className="inline-flex items-center gap-1 font-mono text-sm text-success hover:underline"
                      >
                        {r.person_id}
                        <ExternalLink size={12} className="opacity-50" />
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">
                      {r.score_id}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-mono text-text-primary">
                      {r.score_value != null ? r.score_value.toFixed(1) : "\u2014"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: `${tierColor}15`,
                          color: tierColor,
                        }}
                      >
                        {tierLabel(r.risk_tier)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">
                      {(r.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">
                      {(r.completeness * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-muted max-w-[200px] truncate">
                      {missingKeys.length > 0 ? missingKeys.join(", ") : "\u2014"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-text-muted">
            Showing {(page - 1) * perPage + 1} &ndash;{" "}
            {Math.min(page * perPage, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-text-secondary px-2">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
