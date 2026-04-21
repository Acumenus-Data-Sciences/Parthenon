import { CheckCircle2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Investigation } from "../../types";

interface ValidationChecklistProps {
  investigation: Investigation;
}

export function ValidationChecklist({ investigation }: ValidationChecklistProps) {
  const { t } = useTranslation("app");
  const state = investigation.phenotype_state;

  const checks = [
    {
      label: t("investigation.phenotype.validation.atLeastOneConceptSetDefined"),
      pass: state.concept_sets.length > 0,
      detail:
        state.concept_sets.length === 0
          ? t("investigation.phenotype.validation.addConceptsExploreTab")
          : t("investigation.common.counts.conceptSet", {
              count: state.concept_sets.length,
            }),
    },
    {
      label: t("investigation.phenotype.validation.atLeastOneCohortSelected"),
      pass: state.selected_cohort_ids.length > 0,
      detail:
        state.selected_cohort_ids.length === 0
          ? t("investigation.phenotype.validation.selectCohortsBuildTab")
          : t("investigation.common.counts.cohort", {
              count: state.selected_cohort_ids.length,
            }),
    },
    {
      label: t("investigation.phenotype.validation.primaryCohortDesignated"),
      pass: state.primary_cohort_id !== null,
      detail:
        state.primary_cohort_id === null
          ? t("investigation.phenotype.validation.setPrimaryCohort")
          : `Cohort #${state.primary_cohort_id}`,
    },
    {
      label: t("investigation.phenotype.validation.noEmptyConceptSets"),
      pass: state.concept_sets.every((cs) => cs.concepts.length > 0),
      detail: (() => {
        const empty = state.concept_sets.filter((cs) => cs.concepts.length === 0);
        return empty.length > 0
          ? `${empty.map((cs) => cs.name).join(", ")} have no concepts`
          : t("investigation.phenotype.validation.allSetsPopulated");
      })(),
    },
    {
      label: t("investigation.phenotype.validation.codewasValidationRun"),
      pass: state.last_codewas_run_id !== null,
      detail:
        state.last_codewas_run_id === null
          ? t("investigation.phenotype.validation.runCodewas")
          : `Run #${state.last_codewas_run_id}`,
    },
  ];

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  const progressPct = Math.round((passed / total) * 100);

  return (
    <div className="rounded-lg border border-border-default/50 bg-surface-base/60 p-3">
      {/* Summary header */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium text-text-secondary">
          {t("investigation.common.sections.qcChecklist")}
        </h4>
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
            passed === total
              ? "text-success bg-success/10 border-success/30"
              : passed === 0
                ? "text-primary bg-red-900/10 border-red-700/30"
                : "text-amber-400 bg-amber-900/20 border-amber-600/30"
          }`}
        >
          {t("investigation.phenotype.validation.passed", {
            passed,
            total,
          })}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-surface-raised mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            passed === total
              ? "bg-success"
              : passed === 0
                ? "bg-primary"
                : "bg-amber-500"
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Check items */}
      <ul className="flex flex-col gap-1.5">
        {checks.map((check) => (
          <li key={check.label} className="flex items-start gap-2">
            {check.pass ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <span
                className={`text-xs ${check.pass ? "text-text-secondary" : "text-text-muted"}`}
              >
                {check.label}
              </span>
              <p className="text-[10px] text-text-ghost leading-tight mt-0.5">
                {check.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
