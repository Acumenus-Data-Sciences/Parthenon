import { CLINICAL_ANALYSIS_REGISTRY } from "../../clinicalRegistry";
import { useTranslation } from "react-i18next";
import type {
  ClinicalAnalysisGroup,
  ClinicalAnalysisType,
  Investigation,
} from "../../types";
import { AnalysisCard } from "./AnalysisCard";
import {
  getClinicalAnalysisGroupDescription,
  getClinicalAnalysisGroupLabel,
  getClinicalAnalysisPrerequisites,
} from "../../lib/i18n";

const GROUP_META: Array<{ group: ClinicalAnalysisGroup; color: string }> = [
  {
    group: "characterize",
    color: "var(--success)",
  },
  {
    group: "compare",
    color: "var(--primary)",
  },
  {
    group: "predict",
    color: "var(--accent)",
  },
];

interface AnalysisGalleryProps {
  investigation: Investigation;
  onSelectAnalysis: (type: ClinicalAnalysisType) => void;
}

function isPrerequisiteMet(
  prerequisiteLabel: string,
  selectedCohortIds: number[],
): boolean {
  const hasCohort = selectedCohortIds.length > 0;
  const hasMultipleCohorts = selectedCohortIds.length >= 2;

  const lower = prerequisiteLabel.toLowerCase();

  if (lower.includes("2+") || lower.includes("two")) {
    return hasMultipleCohorts;
  }
  if (
    lower.includes("cohort") ||
    lower.includes("target") ||
    lower.includes("comparator") ||
    lower.includes("outcome") ||
    lower.includes("exposure")
  ) {
    return hasCohort;
  }

  // Unrecognised prerequisite — assume satisfied
  return true;
}

function areAllPrerequisitesMet(
  prerequisites: string[],
  selectedCohortIds: number[],
): boolean {
  return prerequisites.every((prereq) =>
    isPrerequisiteMet(prereq, selectedCohortIds),
  );
}

export function AnalysisGallery({
  investigation,
  onSelectAnalysis,
}: AnalysisGalleryProps) {
  const { t } = useTranslation("app");
  const { selected_cohort_ids } = investigation.phenotype_state;

  return (
    <div className="flex flex-col gap-10">
      {GROUP_META.map(({ group, color }) => {
        const descriptors = CLINICAL_ANALYSIS_REGISTRY.filter(
          (d) => d.group === group,
        );

        return (
          <section key={group}>
            {/* Section header */}
            <div className="mb-4 flex items-center gap-3">
              <div
                className="h-5 w-1 rounded-full"
                style={{ backgroundColor: color }}
              />
              <div>
                <h2
                  className="text-base font-semibold"
                  style={{ color }}
                >
                  {getClinicalAnalysisGroupLabel(t, group)}
                </h2>
                <p className="text-xs text-text-ghost">
                  {getClinicalAnalysisGroupDescription(t, group)}
                </p>
              </div>
            </div>

            {/* Cards grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {descriptors.map((descriptor) => {
                const met = areAllPrerequisitesMet(
                  getClinicalAnalysisPrerequisites(t, descriptor.type),
                  selected_cohort_ids,
                );
                const disabledReason = met
                  ? undefined
                  : t("investigation.clinical.requires", {
                      requirements: getClinicalAnalysisPrerequisites(
                        t,
                        descriptor.type,
                      ).join(", "),
                    });

                return (
                  <AnalysisCard
                    key={descriptor.type}
                    descriptor={descriptor}
                    onSelect={onSelectAnalysis}
                    disabled={!met}
                    disabledReason={disabledReason}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
