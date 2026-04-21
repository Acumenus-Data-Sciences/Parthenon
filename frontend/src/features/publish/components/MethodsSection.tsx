// ---------------------------------------------------------------------------
// MethodsSection — Auto-generates methods text from execution parameters
// ---------------------------------------------------------------------------

import { useTranslation } from "react-i18next";
import type { ReportSection } from "../types/publish";

interface MethodsSectionProps {
  section: ReportSection;
}

/**
 * Renders auto-generated methods text from study analysis execution parameters.
 * Includes study design type, cohort definitions, outcome definitions,
 * time-at-risk, matching strategy, and model settings when available.
 */
export function MethodsSection({ section }: MethodsSectionProps) {
  const { t } = useTranslation("app");
  const content = section.content as Record<string, unknown> | null;

  const designType =
    (content?.study_design as string) ?? t("publish.methods.defaults.observational");
  const hypothesis = (content?.hypothesis as string) ?? null;
  const objective = (content?.primary_objective as string) ?? null;
  const rationale = (content?.scientific_rationale as string) ?? null;

  // Extract analysis-level details when available
  const analysisParams = content?.analysis_params as Record<string, unknown> | null;
  const targetCohort = (analysisParams?.target_cohort as string) ?? null;
  const comparatorCohort = (analysisParams?.comparator_cohort as string) ?? null;
  const outcomeCohort = (analysisParams?.outcome_cohort as string) ?? null;
  const timeAtRisk = analysisParams?.time_at_risk as Record<string, unknown> | null;
  const matchingStrategy = (analysisParams?.matching_strategy as string) ?? null;
  const modelType = (analysisParams?.model_type as string) ?? null;

  return (
    <div data-testid="methods-section" className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-text-primary mb-1">
          {t("publish.methods.studyDesign")}
        </h4>
        <p className="text-sm text-text-primary/70">{designType}</p>
      </div>

      {objective && (
        <div>
          <h4 className="text-sm font-semibold text-text-primary mb-1">
            {t("publish.methods.primaryObjective")}
          </h4>
          <p className="text-sm text-text-primary/70">{objective}</p>
        </div>
      )}

      {hypothesis && (
        <div>
          <h4 className="text-sm font-semibold text-text-primary mb-1">
            {t("publish.methods.hypothesis")}
          </h4>
          <p className="text-sm text-text-primary/70">{hypothesis}</p>
        </div>
      )}

      {rationale && (
        <div>
          <h4 className="text-sm font-semibold text-text-primary mb-1">
            {t("publish.methods.scientificRationale")}
          </h4>
          <p className="text-sm text-text-primary/70">{rationale}</p>
        </div>
      )}

      {(targetCohort || comparatorCohort || outcomeCohort) && (
        <div>
          <h4 className="text-sm font-semibold text-text-primary mb-1">
            {t("publish.methods.cohortDefinitions")}
          </h4>
          <ul className="text-sm text-text-primary/70 list-disc list-inside space-y-1">
            {targetCohort && (
              <li>
                {t("publish.methods.target")}: {targetCohort}
              </li>
            )}
            {comparatorCohort && (
              <li>
                {t("publish.methods.comparator")}: {comparatorCohort}
              </li>
            )}
            {outcomeCohort && (
              <li>
                {t("publish.methods.outcome")}: {outcomeCohort}
              </li>
            )}
          </ul>
        </div>
      )}

      {timeAtRisk && (
        <div>
          <h4 className="text-sm font-semibold text-text-primary mb-1">
            {t("publish.methods.timeAtRisk")}
          </h4>
          <p className="text-sm text-text-primary/70">
            {t("publish.methods.start")}:{" "}
            {String(timeAtRisk.start ?? t("publish.methods.defaults.cohortStart"))},{" "}
            {t("publish.methods.end")}:{" "}
            {String(timeAtRisk.end ?? t("publish.methods.defaults.cohortEnd"))}
          </p>
        </div>
      )}

      {matchingStrategy && (
        <div>
          <h4 className="text-sm font-semibold text-text-primary mb-1">
            {t("publish.methods.matchingStrategy")}
          </h4>
          <p className="text-sm text-text-primary/70">{matchingStrategy}</p>
        </div>
      )}

      {modelType && (
        <div>
          <h4 className="text-sm font-semibold text-text-primary mb-1">
            {t("publish.methods.modelSettings")}
          </h4>
          <p className="text-sm text-text-primary/70">{modelType}</p>
        </div>
      )}

      {!content && (
        <p className="text-sm text-text-primary/50 italic">
          {t("publish.methods.empty")}
        </p>
      )}
    </div>
  );
}
