import { CheckCircle2, AlertCircle } from "lucide-react";
import type { Investigation } from "../../types";

interface ValidationChecklistProps {
  investigation: Investigation;
}

export function ValidationChecklist({ investigation }: ValidationChecklistProps) {
  const state = investigation.phenotype_state;

  const checks = [
    {
      label: "At least one concept set defined",
      pass: state.concept_sets.length > 0,
      detail:
        state.concept_sets.length === 0
          ? "Add concepts in the Explore tab"
          : `${state.concept_sets.length} concept set${state.concept_sets.length === 1 ? "" : "s"}`,
    },
    {
      label: "At least one cohort selected",
      pass: state.selected_cohort_ids.length > 0,
      detail:
        state.selected_cohort_ids.length === 0
          ? "Select cohorts in the Build tab"
          : `${state.selected_cohort_ids.length} cohort${state.selected_cohort_ids.length === 1 ? "" : "s"}`,
    },
    {
      label: "Primary cohort designated",
      pass: state.primary_cohort_id !== null,
      detail:
        state.primary_cohort_id === null
          ? "Set a primary cohort for analyses"
          : `Cohort #${state.primary_cohort_id}`,
    },
    {
      label: "No empty concept sets",
      pass: state.concept_sets.every((cs) => cs.concepts.length > 0),
      detail: (() => {
        const empty = state.concept_sets.filter((cs) => cs.concepts.length === 0);
        return empty.length > 0
          ? `${empty.map((cs) => cs.name).join(", ")} have no concepts`
          : "All sets populated";
      })(),
    },
    {
      label: "CodeWAS validation run",
      pass: state.last_codewas_run_id !== null,
      detail:
        state.last_codewas_run_id === null
          ? "Run CodeWAS to validate phenotype"
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
        <h4 className="text-xs font-medium text-zinc-300">QC Checklist</h4>
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
            passed === total
              ? "text-[#2DD4BF] bg-teal-900/20 border-teal-600/30"
              : passed === 0
                ? "text-[#9B1B30] bg-red-900/10 border-red-700/30"
                : "text-amber-400 bg-amber-900/20 border-amber-600/30"
          }`}
        >
          {passed}/{total} passed
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-surface-raised mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            passed === total
              ? "bg-[#2DD4BF]"
              : passed === 0
                ? "bg-[#9B1B30]"
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
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2DD4BF] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <span
                className={`text-xs ${check.pass ? "text-zinc-300" : "text-zinc-400"}`}
              >
                {check.label}
              </span>
              <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                {check.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
