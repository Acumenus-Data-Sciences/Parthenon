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
  { key: "import-cohorts", label: "Import cohorts" },
  { key: "operate", label: "Operate" },
  { key: "match", label: "Match" },
  { key: "materialize", label: "Materialize" },
  { key: "handoff", label: "Handoff" },
];
