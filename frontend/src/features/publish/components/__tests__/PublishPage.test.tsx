// ---------------------------------------------------------------------------
// Publish & Export — Tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PublishPage from "../../pages/PublishPage";
import { StudySelector } from "../StudySelector";
import { ReportPreview } from "../ReportPreview";
import { ReportSectionCard } from "../ReportSection";
import { ExportControls } from "../ExportControls";
import { MethodsSection } from "../MethodsSection";
import { ResultsSummarySection } from "../ResultsSummarySection";
import type { ReportSection } from "../../types/publish";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../api/publishApi", () => ({
  useStudiesForPublish: vi.fn(() => ({
    data: [
      {
        id: 1,
        title: "GiBleed Study",
        name: "GiBleed Study",
        study_type: "comparative",
        status: "active",
        description: "Study of GI bleeds",
        short_title: null,
        slug: "gibleed",
        phase: "design",
        priority: "high",
        created_by: 1,
        principal_investigator_id: null,
        lead_data_scientist_id: null,
        lead_statistician_id: null,
        scientific_rationale: null,
        hypothesis: null,
        primary_objective: null,
        secondary_objectives: null,
        study_start_date: null,
        study_end_date: null,
        target_enrollment_sites: null,
        actual_enrollment_sites: 0,
        protocol_version: null,
        protocol_finalized_at: null,
        funding_source: null,
        clinicaltrials_gov_id: null,
        tags: null,
        settings: null,
        metadata: null,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
      {
        id: 2,
        title: "Hypertension RWE",
        name: "Hypertension RWE",
        study_type: "descriptive",
        status: "completed",
        description: null,
        short_title: null,
        slug: "htn",
        phase: "analysis",
        priority: "medium",
        created_by: 1,
        principal_investigator_id: null,
        lead_data_scientist_id: null,
        lead_statistician_id: null,
        scientific_rationale: null,
        hypothesis: null,
        primary_objective: null,
        secondary_objectives: null,
        study_start_date: null,
        study_end_date: null,
        target_enrollment_sites: null,
        actual_enrollment_sites: 0,
        protocol_version: null,
        protocol_finalized_at: null,
        funding_source: null,
        clinicaltrials_gov_id: null,
        tags: null,
        settings: null,
        metadata: null,
        created_at: "2026-01-02",
        updated_at: "2026-01-02",
      },
    ],
    isLoading: false,
    error: null,
  })),
  useStudyWithAnalyses: vi.fn(() => ({
    data: {
      id: 1,
      title: "GiBleed Study",
      name: "GiBleed Study",
      study_type: "comparative",
      study_design: "cohort",
      status: "active",
      hypothesis: "GI bleeds are associated with NSAID use",
      primary_objective: "Estimate the risk of GI bleeding",
      scientific_rationale: "NSAIDs inhibit COX enzymes",
      analyses: [
        {
          id: 10,
          study_id: 1,
          analysis_type: "estimation",
          analysis_id: 100,
          analysis: {
            id: 100,
            name: "NSAID vs Acetaminophen",
            latest_execution: {
              id: 1001,
              analysis_type: "estimation",
              analysis_id: 100,
              source_id: 1,
              status: "completed",
              started_at: "2026-01-01T00:00:00Z",
              completed_at: "2026-01-01T01:00:00Z",
              result_json: { hazard_ratio: 1.45, ci_lower: 1.1, ci_upper: 1.9 },
              fail_message: null,
              created_at: "2026-01-01T00:00:00Z",
            },
          },
        },
        {
          id: 11,
          study_id: 1,
          analysis_type: "prediction",
          analysis_id: 101,
          analysis: {
            id: 101,
            name: "GI Bleed Prediction",
            latest_execution: {
              id: 1002,
              analysis_type: "prediction",
              analysis_id: 101,
              source_id: 1,
              status: "completed",
              started_at: "2026-01-02T00:00:00Z",
              completed_at: "2026-01-02T01:00:00Z",
              result_json: { auc: 0.82, brier_score: 0.15 },
              fail_message: null,
              created_at: "2026-01-02T00:00:00Z",
            },
          },
        },
        {
          id: 12,
          study_id: 1,
          analysis_type: "estimation",
          analysis_id: 102,
          analysis: {
            id: 102,
            name: "Failed Analysis",
            latest_execution: {
              id: 1003,
              analysis_type: "estimation",
              analysis_id: 102,
              source_id: 1,
              status: "failed",
              started_at: "2026-01-03T00:00:00Z",
              completed_at: null,
              result_json: null,
              fail_message: "Out of memory",
              created_at: "2026-01-03T00:00:00Z",
            },
          },
        },
      ],
    },
    isLoading: false,
  })),
  fetchAllAnalyses: vi.fn(async () => []),
  generateNarrative: vi.fn(async () => ({ narrative: "" })),
  exportDocument: vi.fn(async () => new Blob()),
  exportAsPdf: vi.fn(),
  exportAsImageBundle: vi.fn(),
  exportPlaceholder: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const qc = createQueryClient();
  return render(
    <QueryClientProvider client={qc}>{ui}</QueryClientProvider>,
  );
}

function makeSections(): ReportSection[] {
  return [
    {
      id: "methods",
      title: "Methods",
      type: "methods",
      included: true,
      content: { study_design: "cohort", hypothesis: "Test hypothesis" },
      narrativeState: "idle",
    },
    {
      id: "results-1001",
      title: "estimation — NSAID vs Acetaminophen",
      type: "results",
      analysisType: "estimation",
      executionId: 1001,
      included: true,
      content: { hazard_ratio: 1.45, ci_lower: 1.1, ci_upper: 1.9 },
      narrativeState: "idle",
    },
    {
      id: "diagnostics",
      title: "Diagnostics",
      type: "diagnostics",
      included: false,
      content: null,
      narrativeState: "idle",
    },
  ];
}

// ---------------------------------------------------------------------------
// PublishPage — 4-step flow
// ---------------------------------------------------------------------------

describe("PublishPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page header", () => {
    renderWithProviders(<PublishPage />);
    expect(screen.getByText("Publish")).toBeInTheDocument();
  });

  it("renders step indicator with 4 steps", () => {
    renderWithProviders(<PublishPage />);
    expect(screen.getByText("Select Analyses")).toBeInTheDocument();
    expect(screen.getByText("Configure")).toBeInTheDocument();
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();
  });

  it("starts on step 1 with step indicator visible", () => {
    renderWithProviders(<PublishPage />);
    expect(screen.getByTestId("step-indicator")).toBeInTheDocument();
  });

  it("shows the analysis picker on step 1", () => {
    renderWithProviders(<PublishPage />);
    expect(screen.getByText("Select Analyses")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// StudySelector
// ---------------------------------------------------------------------------

describe("StudySelector", () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders study cards", () => {
    renderWithProviders(<StudySelector onSelect={onSelect} />);
    expect(screen.getByText("GiBleed Study")).toBeInTheDocument();
    expect(screen.getByText("Hypertension RWE")).toBeInTheDocument();
  });

  it("shows executions when a study card is clicked", async () => {
    renderWithProviders(<StudySelector onSelect={onSelect} />);
    fireEvent.click(screen.getByText("GiBleed Study"));

    await waitFor(() => {
      expect(screen.getByText("Completed Executions")).toBeInTheDocument();
    });
  });

  it("only shows completed executions (not failed)", async () => {
    renderWithProviders(<StudySelector onSelect={onSelect} />);
    fireEvent.click(screen.getByText("GiBleed Study"));

    await waitFor(() => {
      expect(screen.getByText("Completed Executions")).toBeInTheDocument();
    });

    // Execution IDs 1001 and 1002 are completed; 1003 is failed
    expect(screen.getByText(/Execution #1001/)).toBeInTheDocument();
    expect(screen.getByText(/Execution #1002/)).toBeInTheDocument();
    expect(screen.queryByText(/Execution #1003/)).not.toBeInTheDocument();
  });

  it("toggles execution checkbox on click", async () => {
    renderWithProviders(<StudySelector onSelect={onSelect} />);
    fireEvent.click(screen.getByText("GiBleed Study"));

    await waitFor(() => {
      expect(screen.getByText(/Execution #1001/)).toBeInTheDocument();
    });

    // Click to select execution
    fireEvent.click(screen.getByText(/Execution #1001/).closest("button")!);

    // Next button should be enabled
    const nextButton = screen.getByRole("button", { name: /Next/i });
    expect(nextButton).not.toBeDisabled();
  });

  it("disables Next button when no executions selected", async () => {
    renderWithProviders(<StudySelector onSelect={onSelect} />);
    fireEvent.click(screen.getByText("GiBleed Study"));

    await waitFor(() => {
      expect(screen.getByText("Completed Executions")).toBeInTheDocument();
    });

    const nextButton = screen.getByRole("button", { name: /Next/i });
    expect(nextButton).toBeDisabled();
  });

  it("Select All / Deselect All toggles all executions", async () => {
    renderWithProviders(<StudySelector onSelect={onSelect} />);
    fireEvent.click(screen.getByText("GiBleed Study"));

    await waitFor(() => {
      expect(screen.getByText("Select All")).toBeInTheDocument();
    });

    // Select All
    fireEvent.click(screen.getByText("Select All"));

    // After selecting all, text changes to "Deselect All"
    expect(screen.getByText("Deselect All")).toBeInTheDocument();

    // Deselect All
    fireEvent.click(screen.getByText("Deselect All"));
    expect(screen.getByText("Select All")).toBeInTheDocument();
  });

  it("calls onSelect with studyId and executionIds when Next is clicked", async () => {
    renderWithProviders(<StudySelector onSelect={onSelect} />);
    fireEvent.click(screen.getByText("GiBleed Study"));

    await waitFor(() => {
      expect(screen.getByText("Select All")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Select All"));

    const nextButton = screen.getByRole("button", { name: /Next/i });
    fireEvent.click(nextButton);

    expect(onSelect).toHaveBeenCalledWith(1, expect.arrayContaining([1001, 1002]));
  });
});

// ---------------------------------------------------------------------------
// ReportPreview
// ---------------------------------------------------------------------------

describe("ReportPreview", () => {
  const onToggle = vi.fn();
  const onReorder = vi.fn();

  it("renders the preview container", () => {
    render(
      <ReportPreview
        sections={makeSections()}
        onToggle={onToggle}
        onReorder={onReorder}
      />,
    );
    expect(screen.getByTestId("report-preview")).toBeInTheDocument();
  });

  it("renders all section cards", () => {
    render(
      <ReportPreview
        sections={makeSections()}
        onToggle={onToggle}
        onReorder={onReorder}
      />,
    );
    expect(screen.getByTestId("report-section-methods")).toBeInTheDocument();
    expect(screen.getByTestId("report-section-results-1001")).toBeInTheDocument();
    expect(screen.getByTestId("report-section-diagnostics")).toBeInTheDocument();
  });

  it("shows empty state when no sections", () => {
    render(
      <ReportPreview
        sections={[]}
        onToggle={onToggle}
        onReorder={onReorder}
      />,
    );
    expect(screen.getByText(/No sections to preview/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ReportSectionCard — toggle and reorder
// ---------------------------------------------------------------------------

describe("ReportSectionCard", () => {
  const section: ReportSection = {
    id: "methods",
    title: "Methods",
    type: "methods",
    included: true,
    content: { study_design: "cohort" },
    narrativeState: "idle",
  };

  it("renders section title", () => {
    render(
      <ReportSectionCard
        section={section}
        included={true}
        isFirst={true}
        isLast={false}
        onToggle={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
      />,
    );
    expect(screen.getByText("Methods")).toBeInTheDocument();
  });

  it("calls onToggle when toggle button is clicked", () => {
    const onToggle = vi.fn();
    render(
      <ReportSectionCard
        section={section}
        included={true}
        isFirst={true}
        isLast={false}
        onToggle={onToggle}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("Exclude section"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows Included badge when included", () => {
    render(
      <ReportSectionCard
        section={section}
        included={true}
        isFirst={true}
        isLast={false}
        onToggle={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
      />,
    );
    expect(screen.getByText("Included")).toBeInTheDocument();
  });

  it("shows Excluded badge when not included", () => {
    render(
      <ReportSectionCard
        section={{ ...section, included: false }}
        included={false}
        isFirst={true}
        isLast={false}
        onToggle={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
      />,
    );
    expect(screen.getByText("Excluded")).toBeInTheDocument();
  });

  it("disables move up when isFirst", () => {
    render(
      <ReportSectionCard
        section={section}
        included={true}
        isFirst={true}
        isLast={false}
        onToggle={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Move up")).toBeDisabled();
  });

  it("disables move down when isLast", () => {
    render(
      <ReportSectionCard
        section={section}
        included={true}
        isFirst={false}
        isLast={true}
        onToggle={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Move down")).toBeDisabled();
  });

  it("calls onMoveUp when up button is clicked", () => {
    const onMoveUp = vi.fn();
    render(
      <ReportSectionCard
        section={section}
        included={true}
        isFirst={false}
        isLast={false}
        onToggle={vi.fn()}
        onMoveUp={onMoveUp}
        onMoveDown={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("Move up"));
    expect(onMoveUp).toHaveBeenCalledTimes(1);
  });

  it("calls onMoveDown when down button is clicked", () => {
    const onMoveDown = vi.fn();
    render(
      <ReportSectionCard
        section={section}
        included={true}
        isFirst={false}
        isLast={false}
        onToggle={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={onMoveDown}
      />,
    );
    fireEvent.click(screen.getByLabelText("Move down"));
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// ExportControls — format selection
// ---------------------------------------------------------------------------

describe("ExportControls", () => {
  it("renders format options", () => {
    render(<ExportControls onExport={vi.fn()} isExporting={false} />);
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("DOCX")).toBeInTheDocument();
    expect(screen.getByText("XLSX")).toBeInTheDocument();
    expect(screen.getByText("PNG")).toBeInTheDocument();
    expect(screen.getByText("SVG")).toBeInTheDocument();
  });

  it("shows Coming soon badges on DOCX and XLSX", () => {
    render(<ExportControls onExport={vi.fn()} isExporting={false} />);
    const badges = screen.getAllByText("Coming soon");
    expect(badges.length).toBe(2);
  });

  it("defaults to PDF format", () => {
    render(<ExportControls onExport={vi.fn()} isExporting={false} />);
    expect(screen.getByText("Export as PDF")).toBeInTheDocument();
  });

  it("changes export button label when format changes", () => {
    render(<ExportControls onExport={vi.fn()} isExporting={false} />);
    fireEvent.click(screen.getByText("PNG"));
    expect(screen.getByText("Export as PNG")).toBeInTheDocument();
  });

  it("calls onExport with selected format", () => {
    const onExport = vi.fn();
    render(<ExportControls onExport={onExport} isExporting={false} />);
    fireEvent.click(screen.getByText("SVG"));
    fireEvent.click(screen.getByText("Export as SVG"));
    expect(onExport).toHaveBeenCalledWith("svg");
  });

  it("disables export button while exporting", () => {
    render(<ExportControls onExport={vi.fn()} isExporting={true} />);
    expect(screen.getByText("Exporting...")).toBeInTheDocument();
    expect(screen.getByText("Exporting...").closest("button")).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// MethodsSection
// ---------------------------------------------------------------------------

describe("MethodsSection", () => {
  it("renders study design from content", () => {
    render(
      <MethodsSection
        section={{
          id: "methods",
          title: "Methods",
          type: "methods",
          included: true,
          content: {
            study_design: "case-control",
            hypothesis: "Drug A increases risk",
            primary_objective: "Estimate OR",
          },
          narrativeState: "idle",
        }}
      />,
    );
    expect(screen.getByText("case-control")).toBeInTheDocument();
    expect(screen.getByText("Drug A increases risk")).toBeInTheDocument();
    expect(screen.getByText("Estimate OR")).toBeInTheDocument();
  });

  it("shows fallback when no content", () => {
    render(
      <MethodsSection
        section={{
          id: "methods",
          title: "Methods",
          type: "methods",
          included: true,
          content: null,
          narrativeState: "idle",
        }}
      />,
    );
    expect(screen.getByText(/No methods data available/)).toBeInTheDocument();
  });

  it("defaults study design to Observational", () => {
    render(
      <MethodsSection
        section={{
          id: "methods",
          title: "Methods",
          type: "methods",
          included: true,
          content: {},
          narrativeState: "idle",
        }}
      />,
    );
    expect(screen.getByText("Observational")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ResultsSummarySection
// ---------------------------------------------------------------------------

describe("ResultsSummarySection", () => {
  it("renders analysis type badge", () => {
    render(
      <ResultsSummarySection
        section={{
          id: "results-1",
          title: "Estimation Result",
          type: "results",
          analysisType: "estimation",
          executionId: 1,
          included: true,
          content: { hazard_ratio: 0.85, ci_lower: 0.7, ci_upper: 1.0 },
          narrativeState: "idle",
        }}
      />,
    );
    expect(screen.getByText("Estimation")).toBeInTheDocument();
  });

  it("shows no-data message when content is null", () => {
    render(
      <ResultsSummarySection
        section={{
          id: "results-1",
          title: "No Data",
          type: "results",
          analysisType: "estimation",
          executionId: 1,
          included: true,
          content: null,
          narrativeState: "idle",
        }}
      />,
    );
    expect(screen.getByText(/No results data available/)).toBeInTheDocument();
  });

  it("renders estimation metrics", () => {
    render(
      <ResultsSummarySection
        section={{
          id: "results-1",
          title: "Est",
          type: "results",
          analysisType: "estimation",
          executionId: 1,
          included: true,
          content: {
            hazard_ratio: 1.45,
            ci_lower: 1.1,
            ci_upper: 1.9,
            target_count: 500,
            comparator_count: 500,
          },
          narrativeState: "idle",
        }}
      />,
    );
    expect(screen.getByText("Hazard Ratio")).toBeInTheDocument();
    expect(screen.getByText("95% CI")).toBeInTheDocument();
    expect(screen.getByText("Target N")).toBeInTheDocument();
    expect(screen.getByText("Comparator N")).toBeInTheDocument();
  });

  it("renders prediction metrics", () => {
    render(
      <ResultsSummarySection
        section={{
          id: "results-2",
          title: "Pred",
          type: "results",
          analysisType: "prediction",
          executionId: 2,
          included: true,
          content: { auc: 0.82, brier_score: 0.15 },
          narrativeState: "idle",
        }}
      />,
    );
    expect(screen.getByText("AUC")).toBeInTheDocument();
    expect(screen.getByText("Brier Score")).toBeInTheDocument();
  });

  it("renders generic summary for unknown analysis types", () => {
    render(
      <ResultsSummarySection
        section={{
          id: "results-3",
          title: "Custom",
          type: "results",
          analysisType: "custom_analysis",
          executionId: 3,
          included: true,
          content: { metric_a: 42, metric_b: "high" },
          narrativeState: "idle",
        }}
      />,
    );
    expect(screen.getByText("metric a")).toBeInTheDocument();
    expect(screen.getByText("metric b")).toBeInTheDocument();
  });
});
