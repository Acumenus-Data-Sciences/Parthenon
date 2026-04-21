import { useState } from "react";
import {
  Loader2,
  Users,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { TIER_COLORS } from "../types/riskScore";
import { useExecutionPatients } from "../hooks/useRiskScores";
import { getRiskScoreTierLabel } from "../lib/i18n";

const TIER_PILLS = ["low", "intermediate", "high", "very_high"] as const;

interface PatientsTabProps {
  analysisId: number;
  executionId: number | null;
  scoreIds: string[];
  onCreateCohort: (
    scoreId: string,
    tier: string | undefined,
    personIds: number[],
  ) => void;
}

export function PatientsTab({
  analysisId,
  executionId,
  scoreIds,
  onCreateCohort,
}: PatientsTabProps) {
  const { t } = useTranslation("app");
  const [page, setPage] = useState(1);
  const [filterScoreId, setFilterScoreId] = useState<string | undefined>();
  const [filterTier, setFilterTier] = useState<string | undefined>();

  const { data, isLoading } = useExecutionPatients(analysisId, executionId, {
    page,
    per_page: 50,
    score_id: filterScoreId,
    risk_tier: filterTier,
  });

  const isFilterActive = filterScoreId != null || filterTier != null;
  const totalPages = data?.last_page ?? 1;
  const perPage = data?.per_page ?? 50;
  const total = data?.total ?? 0;
  const patients = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (executionId == null) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-overlay">
          <Users size={24} className="text-text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">
          {t("riskScores.patients.noExecutionSelected")}
        </h3>
        <p className="mt-2 text-sm text-text-muted">
          {t("riskScores.patients.runExecutionToViewPatientLevel")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center gap-3">
        <select
          value={filterScoreId ?? ""}
          onChange={(event) => {
            setFilterScoreId(event.target.value || undefined);
            setPage(1);
          }}
          className="rounded-lg border border-border-default bg-surface-raised px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-success"
        >
          <option value="">{t("riskScores.results.allScores")}</option>
          {scoreIds.map((scoreId) => (
            <option key={scoreId} value={scoreId}>
              {scoreId}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setFilterTier(undefined);
              setPage(1);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filterTier == null
                ? "bg-success/15 text-success"
                : "bg-surface-overlay text-text-muted hover:text-text-secondary",
            )}
          >
            {t("riskScores.patients.all")}
          </button>
          {TIER_PILLS.map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => {
                setFilterTier(filterTier === tier ? undefined : tier);
                setPage(1);
              }}
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
              {getRiskScoreTierLabel(t, tier)}
            </button>
          ))}
        </div>

        <span className="ml-auto text-sm text-text-ghost">
          {t("riskScores.patients.showingPatients", { count: total })}
        </span>
      </div>

      {isFilterActive && patients.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-overlay px-4 py-2">
          <button
            type="button"
            onClick={() =>
              onCreateCohort(
                filterScoreId ?? "",
                filterTier,
                patients.map((result) => result.person_id),
              )
            }
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-1.5 text-sm font-medium text-surface-base transition-colors hover:bg-success/80"
          >
            <Users size={14} />
            {t("riskScores.common.actions.createCohortFromFilter")}
          </button>
          <span className="text-xs text-text-muted">
            {t("riskScores.patients.patientsOnPage", { count: patients.length })}
          </span>
        </div>
      )}

      {patients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-overlay">
            <Users size={24} className="text-text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary">
            {t("riskScores.patients.noPatientResultsAvailable")}
          </h3>
          <p className="mt-2 text-sm text-text-muted">
            {isFilterActive
              ? t("riskScores.patients.adjustFilters")
              : t("riskScores.patients.executeToGenerate")}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-default bg-surface-raised">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-overlay">
                {[
                  t("riskScores.patients.personId"),
                  t("riskScores.common.headers.score"),
                  t("riskScores.common.headers.value"),
                  t("riskScores.common.headers.riskTier"),
                  t("riskScores.common.headers.confidence"),
                  t("riskScores.common.headers.completeness"),
                  t("riskScores.common.headers.missing"),
                ].map((header) => (
                  <th
                    key={header}
                    className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-text-ghost"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map((result, index) => {
                const tierColor =
                  TIER_COLORS[result.risk_tier] ?? "var(--text-muted)";
                const missingKeys = result.missing_components
                  ? Object.keys(result.missing_components)
                  : [];

                return (
                  <tr
                    key={result.id}
                    className={cn(
                      "border-t border-border-subtle transition-colors hover:bg-surface-overlay",
                      index % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          window.open(`/profiles?person=${result.person_id}`, "_blank")
                        }
                        className="inline-flex items-center gap-1 font-mono text-sm text-success hover:underline"
                      >
                        {result.person_id}
                        <ExternalLink size={12} className="opacity-50" />
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">
                      {result.score_id}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-text-primary">
                      {result.score_value != null ? result.score_value.toFixed(1) : "\u2014"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: `${tierColor}15`,
                          color: tierColor,
                        }}
                      >
                        {getRiskScoreTierLabel(t, result.risk_tier)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">
                      {(result.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-2.5 text-sm text-text-secondary">
                      {(result.completeness * 100).toFixed(0)}%
                    </td>
                    <td className="max-w-[200px] px-4 py-2.5 text-xs text-text-muted">
                      {missingKeys.length > 0 ? missingKeys.join(", ") : "\u2014"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-text-muted">
            {t("riskScores.common.pagination.showingRange", {
              from: (page - 1) * perPage + 1,
              to: Math.min(page * perPage, total),
              total,
            })}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 text-xs text-text-secondary">
              {t("riskScores.common.pagination.pageXOfY", {
                current: page,
                total: totalPages,
              })}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
