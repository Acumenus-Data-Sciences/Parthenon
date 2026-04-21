import type { TFunction } from "i18next";

export type StrategusModuleCopyKey =
  | "cohortGenerator"
  | "cohortMethod"
  | "patientLevelPrediction"
  | "selfControlledCaseSeries"
  | "cohortDiagnostics"
  | "characterization"
  | "cohortIncidence"
  | "evidenceSynthesis";

// i18n-exempt: Strategus module identifiers and copy keys are internal constants.
const MODULE_COPY_KEY_BY_NAME: Record<string, StrategusModuleCopyKey> = {
  CohortGeneratorModule: "cohortGenerator",
  CohortMethodModule: "cohortMethod",
  PatientLevelPredictionModule: "patientLevelPrediction",
  SelfControlledCaseSeriesModule: "selfControlledCaseSeries",
  CohortDiagnosticsModule: "cohortDiagnostics",
  CharacterizationModule: "characterization",
  CohortIncidenceModule: "cohortIncidence",
  EvidenceSynthesisModule: "evidenceSynthesis",
};

export function getStrategusModuleCopyKey(
  moduleName: string,
): StrategusModuleCopyKey | null {
  return MODULE_COPY_KEY_BY_NAME[moduleName] ?? null;
}

export function getStrategusModuleLabel(
  t: TFunction<"app">,
  moduleName: string,
): string {
  const key = getStrategusModuleCopyKey(moduleName);
  return key ? t(`strategus.moduleMeta.${key}.label`) : moduleName;
}

export function getStrategusModuleDescription(
  t: TFunction<"app">,
  moduleName: string,
): string {
  const key = getStrategusModuleCopyKey(moduleName);
  return key ? t(`strategus.moduleMeta.${key}.description`) : moduleName;
}
