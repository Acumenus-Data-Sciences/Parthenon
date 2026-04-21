import type { TFunction } from "i18next";
import type { DimensionScores } from "../types/patientSimilarity";
import type { PipelineStepCopyKey } from "../types/pipeline";

export type SimilarityDimensionKey = keyof DimensionScores;

type SimilarityDimensionCopyKey =
  | "demographics"
  | "conditions"
  | "labs"
  | "medications"
  | "procedures"
  | "genomics";

// i18n-exempt: patient-similarity dimension identifiers are internal constants.
const DIMENSION_COPY_KEY_BY_NAME: Record<
  SimilarityDimensionKey,
  SimilarityDimensionCopyKey
> = {
  demographics: "demographics",
  conditions: "conditions",
  measurements: "labs",
  drugs: "medications",
  procedures: "procedures",
  genomics: "genomics",
};

export function getSimilarityDimensionLabel(
  t: TFunction<"app">,
  key: SimilarityDimensionKey,
): string {
  return t(
    `patientSimilarity.common.dimensions.${DIMENSION_COPY_KEY_BY_NAME[key]}`,
  );
}

export function getSimilarityGenderLabel(
  t: TFunction<"app">,
  genderConceptId: number | null | undefined,
  variant: "full" | "short" = "full",
): string {
  if (genderConceptId === 8507) {
    return t(
      variant === "short"
        ? "patientSimilarity.common.genders.shortMale"
        : "patientSimilarity.common.genders.male",
    );
  }
  if (genderConceptId === 8532) {
    return t(
      variant === "short"
        ? "patientSimilarity.common.genders.shortFemale"
        : "patientSimilarity.common.genders.female",
    );
  }

  return t(
    variant === "short"
      ? "patientSimilarity.common.genders.shortUnknown"
      : "patientSimilarity.common.genders.unknown",
  );
}

export function getSimilarityScoreLabel(
  t: TFunction<"app">,
  score: number,
): string {
  if (score >= 0.9) return t("patientSimilarity.comparison.score.veryHigh");
  if (score >= 0.7) return t("patientSimilarity.comparison.score.high");
  if (score >= 0.5) return t("patientSimilarity.comparison.score.moderate");
  if (score >= 0.3) return t("patientSimilarity.comparison.score.low");
  return t("patientSimilarity.comparison.score.veryLow");
}

export function getPipelineStepName(
  t: TFunction<"app">,
  copyKey: PipelineStepCopyKey,
): string {
  return t(`patientSimilarity.pipeline.steps.${copyKey}.name`);
}

export function getPipelineStepDescription(
  t: TFunction<"app">,
  copyKey: PipelineStepCopyKey,
): string {
  return t(`patientSimilarity.pipeline.steps.${copyKey}.description`);
}

export function getSimilarityModeLabel(
  t: TFunction<"app">,
  mode: "auto" | "interpretable" | "embedding",
): string {
  return t(`patientSimilarity.common.modes.${mode}`);
}

export function getBalanceVerdictLabel(
  t: TFunction<"app">,
  verdict: string,
): string {
  switch (verdict) {
    case "well_balanced":
      return t("patientSimilarity.resultDiagnostics.verdict.wellBalanced");
    case "marginal_imbalance":
      return t("patientSimilarity.resultDiagnostics.verdict.marginalImbalance");
    case "significant_imbalance":
      return t(
        "patientSimilarity.resultDiagnostics.verdict.significantImbalance",
      );
    case "not_applicable":
      return t("patientSimilarity.resultDiagnostics.verdict.notApplicable");
    default:
      return t("patientSimilarity.resultDiagnostics.verdict.insufficientData");
  }
}
