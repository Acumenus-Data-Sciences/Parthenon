import { CLINICAL_ANALYSIS_REGISTRY } from "../../clinicalRegistry";
import type {
  ClinicalAnalysisGroup,
  ClinicalAnalysisType,
  Investigation,
} from "../../types";
import { AnalysisCard } from "./AnalysisCard";

interface GroupMeta {
  group: ClinicalAnalysisGroup;
  label: string;
  description: string;
  color: string;
}

const GROUP_META: GroupMeta[] = [
  {
    group: "characterize",
    label: "Characterize",
    description: "Describe your populations — demographics, comorbidities, and treatment patterns.",
    color: "#2DD4BF",
  },
  {
    group: "compare",
    label: "Compare",
    description: "Estimate causal effects and compare outcomes across exposures or time windows.",
    color: "#9B1B30",
  },
  {
    group: "predict",
    label: "Predict",
    description: "Train patient-level machine learning models to forecast future outcomes.",
    color: "#C9A227",
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
  const { selected_cohort_ids } = investigation.phenotype_state;

  return (
    <div className="flex flex-col gap-10">
      {GROUP_META.map(({ group, label, description, color }) => {
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
                  {label}
                </h2>
                <p className="text-xs text-text-ghost">{description}</p>
              </div>
            </div>

            {/* Cards grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {descriptors.map((descriptor) => {
                const met = areAllPrerequisitesMet(
                  descriptor.prerequisites,
                  selected_cohort_ids,
                );
                const disabledReason = met
                  ? undefined
                  : `Requires: ${descriptor.prerequisites.join(", ")}`;

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
