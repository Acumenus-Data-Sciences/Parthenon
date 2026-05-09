import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StudyResultsTab } from "../StudyResultsTab";
import type { ManagedShinyApp, StudyResult } from "../../types/study";

const launchMutation = {
  mutate: vi.fn(),
  isPending: false,
};

const plpApp: ManagedShinyApp = {
  key: "plp-results",
  label: "PatientLevelPrediction Results",
  package: "OhdsiShinyModules",
  module_family: "Prediction module",
  result_types: ["PatientLevelPrediction"],
  launch_modes: ["embedded", "full_page"],
  runtime_preference: "shinyproxy",
  runtime_app: "plp-results",
  status: "registry_ready",
  permission_scope: "study_result_read",
  entrypoint: "OhdsiShinyAppBuilder::createDefaultPredictionConfig",
};

const resultBase: StudyResult = {
  id: 10,
  study_id: 1,
  study_analysis_id: 2,
  execution_id: 3,
  site_id: null,
  result_type: "prediction_performance",
  summary_data: { auc: 0.74 },
  diagnostics: null,
  is_primary: false,
  is_publishable: false,
  reviewed_by: null,
  reviewed_at: null,
  created_at: "2026-05-09T18:00:00Z",
  updated_at: "2026-05-09T18:00:00Z",
};

let studyResults: StudyResult[] = [];

vi.mock("../../hooks/useStudies", () => ({
  useStudyResults: () => ({
    data: {
      items: studyResults,
      total: studyResults.length,
    },
    isLoading: false,
  }),
  useUpdateStudyResult: () => ({ mutate: vi.fn(), isPending: false }),
  useStudySyntheses: () => ({ data: [], isLoading: false }),
  useCreateStudySynthesis: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteStudySynthesis: () => ({ mutate: vi.fn(), isPending: false }),
  useLaunchStudyResultShinyApp: () => launchMutation,
}));

describe("StudyResultsTab managed Shiny actions", () => {
  it("shows a managed viewer action when the API exposes a supported result app", () => {
    studyResults = [{ ...resultBase, managed_shiny_apps: [plpApp] }];

    render(<StudyResultsTab slug="plp-study" />);

    expect(screen.getByRole("button", { name: /PatientLevelPrediction Results/i })).toBeInTheDocument();
  });

  it("hides the managed viewer action when runtime/schema support is absent", () => {
    studyResults = [{ ...resultBase, managed_shiny_apps: [] }];

    render(<StudyResultsTab slug="summary-only-study" />);

    expect(screen.queryByRole("button", { name: /PatientLevelPrediction Results/i })).not.toBeInTheDocument();
  });
});
