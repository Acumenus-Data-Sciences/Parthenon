import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ValidationReport } from "@/features/ingestion/components/ValidationReport";
import type {
  ValidationResult,
  ValidationSummary,
} from "@/types/ingestion";

function makeResult(
  overrides: Partial<ValidationResult> & Pick<ValidationResult, "id">,
): ValidationResult {
  return {
    ingestion_job_id: 1,
    check_name: "Test Check",
    check_category: "completeness",
    cdm_table: "person",
    cdm_column: null,
    severity: "error",
    passed: true,
    violated_rows: 0,
    total_rows: 100,
    violation_percentage: 0,
    description: "A test check",
    details: null,
    ...overrides,
  };
}

const sampleResults: ValidationResult[] = [
  makeResult({
    id: 1,
    check_name: "Not Null person_id",
    check_category: "completeness",
    passed: true,
    severity: "error",
    violated_rows: 0,
    total_rows: 1000,
    violation_percentage: 0,
    description: "person_id must not be null",
    cdm_table: "person",
    cdm_column: "person_id",
  }),
  makeResult({
    id: 2,
    check_name: "Valid gender_concept_id",
    check_category: "conformance",
    passed: false,
    severity: "warning",
    violated_rows: 15,
    total_rows: 1000,
    violation_percentage: 1.5,
    description: "gender_concept_id must reference a valid concept",
    cdm_table: "person",
    cdm_column: "gender_concept_id",
  }),
  makeResult({
    id: 3,
    check_name: "Plausible birth year",
    check_category: "plausibility",
    passed: false,
    severity: "info",
    violated_rows: 3,
    total_rows: 1000,
    violation_percentage: 0.3,
    description: "Birth year should be plausible",
    cdm_table: "person",
    cdm_column: "year_of_birth",
  }),
  makeResult({
    id: 4,
    check_name: "Not Null observation_period_id",
    check_category: "completeness",
    passed: true,
    severity: "error",
    violated_rows: 0,
    total_rows: 500,
    violation_percentage: 0,
    description: "observation_period_id must not be null",
    cdm_table: "observation_period",
    cdm_column: "observation_period_id",
  }),
];

const sampleSummary: ValidationSummary = {
  total_checks: 4,
  passed: 2,
  failed: 2,
  by_category: {
    completeness: { passed: 2, failed: 0, total: 2 },
    conformance: { passed: 0, failed: 1, total: 1 },
    plausibility: { passed: 0, failed: 1, total: 1 },
  },
  by_severity: {
    error: { passed: 2, failed: 0, total: 2 },
    warning: { passed: 0, failed: 1, total: 1 },
    info: { passed: 0, failed: 1, total: 1 },
  },
};

describe("ValidationReport", () => {
  it("renders empty state when no results", () => {
    render(<ValidationReport results={[]} summary={null} />);
    expect(screen.getByText("No validation results yet")).toBeInTheDocument();
    expect(
      screen.getByText("Validation runs after CDM data writing completes"),
    ).toBeInTheDocument();
  });

  it("renders score rings for each category", () => {
    const { container } = render(
      <ValidationReport results={sampleResults} summary={sampleSummary} />,
    );

    // Category labels appear in both the scorecard and the results sections
    expect(screen.getAllByText("Completeness").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Conformance").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Plausibility").length).toBeGreaterThanOrEqual(2);

    // Should show overall score label
    expect(screen.getByText("Overall Score")).toBeInTheDocument();

    // Should render SVG score rings (4 total: 1 overall + 3 categories)
    const svgElements = container.querySelectorAll("svg.-rotate-90");
    expect(svgElements).toHaveLength(4);
  });

  it("shows passed checks with green/teal check icon", () => {
    const { container } = render(
      <ValidationReport results={sampleResults} summary={sampleSummary} />,
    );

    // Passed checks render CheckCircle2 with teal color
    const tealCheckIcons = container.querySelectorAll(
      "table .text-success",
    );
    // At least 2 passed results should have teal icons in the table rows
    expect(tealCheckIcons.length).toBeGreaterThanOrEqual(2);
  });

  it("shows failed checks with red icon", () => {
    const { container } = render(
      <ValidationReport results={sampleResults} summary={sampleSummary} />,
    );

    // Failed checks render XCircle with red color
    const redIcons = container.querySelectorAll(
      "table .text-critical",
    );
    // At least 2 failed results should have red icons in the table rows
    expect(redIcons.length).toBeGreaterThanOrEqual(2);
  });

  it("renders severity badges (error, warning, info)", () => {
    render(
      <ValidationReport results={sampleResults} summary={sampleSummary} />,
    );

    // Severity labels rendered as badge text
    expect(screen.getAllByText("Error").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Warning").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Info").length).toBeGreaterThanOrEqual(1);
  });

  it("groups results by category with section headers", () => {
    render(
      <ValidationReport results={sampleResults} summary={sampleSummary} />,
    );

    // Each category should appear as an h3 section header
    const completenessHeaders = screen.getAllByText("Completeness");
    const conformanceHeaders = screen.getAllByText("Conformance");
    const plausibilityHeaders = screen.getAllByText("Plausibility");

    // Each category appears in both scorecard and results section
    expect(completenessHeaders.length).toBeGreaterThanOrEqual(2);
    expect(conformanceHeaders.length).toBeGreaterThanOrEqual(2);
    expect(plausibilityHeaders.length).toBeGreaterThanOrEqual(2);

    // Check counts should appear (e.g., "2 checks", "1 checks")
    expect(screen.getByText("2 checks")).toBeInTheDocument();
    expect(screen.getAllByText("1 checks")).toHaveLength(2);
  });

  it("shows passed and failed counts in the summary bar", () => {
    render(
      <ValidationReport results={sampleResults} summary={sampleSummary} />,
    );

    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();

    // The actual count values (2 passed, 2 failed)
    const passedCount = screen.getByText("2", {
      selector: "span.text-success",
    });
    expect(passedCount).toBeInTheDocument();

    const failedCount = screen.getByText("2", {
      selector: "span.text-critical",
    });
    expect(failedCount).toBeInTheDocument();
  });

  it("renders check names and descriptions in the table", () => {
    render(
      <ValidationReport results={sampleResults} summary={sampleSummary} />,
    );

    expect(screen.getByText("Not Null person_id")).toBeInTheDocument();
    expect(
      screen.getByText("person_id must not be null"),
    ).toBeInTheDocument();

    expect(screen.getByText("Valid gender_concept_id")).toBeInTheDocument();
    expect(
      screen.getByText(
        "gender_concept_id must reference a valid concept",
      ),
    ).toBeInTheDocument();

    expect(screen.getByText("Plausible birth year")).toBeInTheDocument();
    expect(
      screen.getByText("Birth year should be plausible"),
    ).toBeInTheDocument();
  });

  it("renders category passed/total counts", () => {
    const { container } = render(
      <ValidationReport results={sampleResults} summary={sampleSummary} />,
    );

    // The scorecard section is a grid with cols-4 containing category cards
    const scorecard = container.querySelector(".grid.grid-cols-4");
    expect(scorecard).not.toBeNull();

    // Each category card shows "X/Y passed" text
    const scoreCardText = scorecard!.textContent;
    expect(scoreCardText).toContain("2/2 passed");
    expect(scoreCardText).toContain("0/1 passed");
  });

  it("renders without summary, computing values from results", () => {
    render(
      <ValidationReport results={sampleResults} summary={null} />,
    );

    // Should still render categories from the results (appear in both scorecard and results)
    expect(screen.getAllByText("Completeness").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Conformance").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Plausibility").length).toBeGreaterThanOrEqual(2);

    // Should still show passed/failed labels
    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
