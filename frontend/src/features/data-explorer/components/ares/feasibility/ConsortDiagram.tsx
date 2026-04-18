import { useTranslation } from "react-i18next";
import { formatNumber } from "@/i18n/format";
import type { FeasibilityResult } from "../../../types/ares";

interface ConsortDiagramProps {
  results: FeasibilityResult[];
  criteriaLabels: string[];
}

interface ConsortStep {
  label: string;
  remaining: number;
  excluded: number;
}

function buildConsortSteps(results: FeasibilityResult[], labels: string[], allSourcesLabel: string): ConsortStep[] {
  const total = results.length;
  const criterionKeys: Array<keyof Pick<FeasibilityResult, "domain_pass" | "concept_pass" | "visit_pass" | "date_pass" | "patient_pass">> = [
    "domain_pass",
    "concept_pass",
    "visit_pass",
    "date_pass",
    "patient_pass",
  ];

  const steps: ConsortStep[] = [{ label: allSourcesLabel, remaining: total, excluded: 0 }];

  let currentSources = [...results];

  for (let i = 0; i < criterionKeys.length; i++) {
    const key = criterionKeys[i];
    const label = labels[i] ?? key;
    const failing = currentSources.filter((r) => !r[key]);
    const passing = currentSources.filter((r) => r[key]);

    steps.push({
      label,
      remaining: passing.length,
      excluded: failing.length,
    });

    currentSources = passing;
  }

  return steps;
}

export default function ConsortDiagram({ results, criteriaLabels }: ConsortDiagramProps) {
  const { t } = useTranslation("app");

  if (results.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-text-ghost">
        {t("dataExplorer.ares.feasibility.consort.noResults")}
      </p>
    );
  }

  const defaultLabels = [
    t("dataExplorer.ares.feasibility.criteria.domains"),
    t("dataExplorer.ares.feasibility.criteria.concepts"),
    t("dataExplorer.ares.feasibility.criteria.visitTypes"),
    t("dataExplorer.ares.feasibility.criteria.dateRange"),
    t("dataExplorer.ares.feasibility.criteria.patientCount"),
  ];
  const labels = criteriaLabels.length > 0 ? criteriaLabels : defaultLabels;
  const steps = buildConsortSteps(results, labels, t("dataExplorer.ares.feasibility.consort.allSources"));

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
      <h4 className="mb-1 text-sm font-medium text-text-primary">
        {t("dataExplorer.ares.feasibility.consort.title")}
      </h4>
      <p className="mb-4 text-[11px] text-text-ghost">
        {t("dataExplorer.ares.feasibility.consort.description")}
      </p>

      <div className="flex flex-col items-center gap-0">
        {steps.map((step, idx) => (
          <div key={step.label} className="flex flex-col items-center">
            {/* Box */}
            <div
              className={`flex w-56 flex-col items-center rounded-lg border px-4 py-2 ${
                idx === 0
                  ? "border-accent/40 bg-accent/10"
                  : step.remaining === 0
                    ? "border-primary/40 bg-primary/10"
                    : "border-border-subtle bg-surface-overlay"
              }`}
            >
              <span className="text-[10px] text-text-muted">{step.label}</span>
              <span className="text-sm font-bold text-text-primary">
                {t("dataExplorer.ares.feasibility.consort.sources", {
                  count: formatNumber(step.remaining),
                })}
              </span>
            </div>

            {/* Arrow + exclusion label */}
            {idx < steps.length - 1 && (
              <div className="flex items-center gap-2 py-1">
                <div className="h-6 w-px bg-surface-highlight" />
                {steps[idx + 1].excluded > 0 && (
                  <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] text-critical">
                    {t("dataExplorer.ares.feasibility.consort.excluded", {
                      count: formatNumber(steps[idx + 1].excluded),
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
