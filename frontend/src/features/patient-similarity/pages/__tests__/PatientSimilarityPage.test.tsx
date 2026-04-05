import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { useSourceStore } from "@/stores/sourceStore";
import PatientSimilarityPage from "../PatientSimilarityPage";

vi.mock("../../hooks/usePatientSimilarity", () => ({
  useSimilaritySearch: () => ({
    data: undefined,
    isPending: false,
    isError: false,
    mutate: vi.fn(),
  }),
  useCohortSimilaritySearch: () => ({
    data: undefined,
    isPending: false,
    isError: false,
    mutate: vi.fn(),
  }),
  useCompareCohorts: () => ({
    data: {
      source_cohort: { name: "Alpha", dimensions: {} },
      target_cohort: { name: "Beta", dimensions: {} },
      divergence: {},
      overall_divergence: 0.2,
    },
    isPending: false,
    isError: false,
    mutate: vi.fn(),
  }),
  useCrossCohortSearch: () => ({
    data: undefined,
    isPending: false,
    isError: false,
    mutate: vi.fn(),
  }),
  useComputeStatus: () => ({ data: undefined }),
}));

vi.mock("../../components/SimilaritySearchForm", () => ({
  SimilaritySearchForm: () => <div>single-form</div>,
}));

vi.mock("../../components/CohortSeedForm", () => ({
  CohortSeedForm: () => <div>cohort-form</div>,
}));

vi.mock("../../components/CohortCompareForm", () => ({
  CohortCompareForm: () => <div>compare-form</div>,
}));

vi.mock("../../components/SimilarityModeToggle", () => ({
  SimilarityModeToggle: () => <div>mode-toggle</div>,
}));

vi.mock("../../components/StalenessIndicator", () => ({
  StalenessIndicator: () => <div>staleness-indicator</div>,
}));

vi.mock("../../components/CohortComparisonRadar", () => ({
  CohortComparisonRadar: () => <div>comparison-radar</div>,
}));

vi.mock("../../components/DivergenceScores", () => ({
  DivergenceScores: () => <div>divergence-scores</div>,
}));

vi.mock("../../components/SearchDiagnosticsPanel", () => ({
  SearchDiagnosticsPanel: () => <div>search-diagnostics</div>,
}));

vi.mock("../../components/ResultCohortDiagnosticsPanel", () => ({
  ResultCohortDiagnosticsPanel: () => <div>result-cohort-diagnostics</div>,
}));

vi.mock("../../components/SimilarPatientTable", () => ({
  SimilarPatientTable: () => <div>similar-patient-table</div>,
}));

vi.mock("../../components/CohortExportDialog", () => ({
  CohortExportDialog: () => null,
}));

vi.mock("../../components/CohortExpandDialog", () => ({
  CohortExpandDialog: () => null,
}));

describe("PatientSimilarityPage", () => {
  beforeEach(() => {
    useSourceStore.setState({
      activeSourceId: 1,
      defaultSourceId: 1,
      sources: [{ id: 1, source_name: "Synthetic OMOP" }],
    });
  });

  it("shows compare guidance instead of the generic empty state after a cohort comparison", () => {
    renderWithProviders(<PatientSimilarityPage />);

    fireEvent.click(screen.getByRole("button", { name: "Compare Cohorts" }));

    expect(screen.getByText("comparison-radar")).toBeInTheDocument();
    expect(screen.getByText("divergence-scores")).toBeInTheDocument();
    expect(screen.getByText("Cohort Profiles Compared")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Find Similar Patients" }),
    ).not.toBeInTheDocument();
  });
});
