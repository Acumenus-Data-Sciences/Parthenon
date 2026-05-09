import { tAuto } from "@/i18n/autoUserFacing";
// frontend/src/features/finngen-workbench/lib/workbenchSteps.ts
//
// Step definitions for the FinnGen Cohort Workbench stepper, extracted into
// their own module so WorkbenchStepper.tsx can stay a pure component module
// (clears the react-refresh/only-export-components Fast Refresh warning).
//
// v1.0 UX pass — the "Select source" placeholder step was dropped. A session
// is bound to a single source at creation time (see SessionsListPage), so
// the step never did anything useful. Source is now surfaced in the
// WorkbenchPage header instead.

export type WorkbenchStepKey =
  | "import-cohorts"
  | "operate"
  | "match"
  | "materialize"
  | "handoff";

export const WORKBENCH_STEPS: { key: WorkbenchStepKey; label: string }[] = [
  { key: "import-cohorts", label: tAuto("importCohorts_338b6729") },
  { key: "operate", label: tAuto("operate_3c1a1d23") },
  { key: "match", label: tAuto("match_0335207f") },
  { key: "materialize", label: tAuto("materialize_8e5c1300") },
  { key: "handoff", label: tAuto("handoff_09496b01") },
];
