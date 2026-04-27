import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import type { Study } from "@/features/studies/types/study";
import { useImportProtocolAsNewStudy } from "@/features/studies/hooks/useStudies";
import { lintCohort, recommendPhenotypes, splitIntent } from "../../api";
import StudyDesignerPage from "../StudyDesignerPage";

vi.mock("@/features/help", () => ({
  HelpButton: () => <button type="button">Help</button>,
}));

vi.mock("@/features/studies/hooks/useStudies", () => ({
  useImportProtocolAsNewStudy: vi.fn(),
}));

vi.mock("../../api", () => ({
  lintCohort: vi.fn(),
  recommendPhenotypes: vi.fn(),
  searchPhenotypes: vi.fn(),
  splitIntent: vi.fn(),
}));

vi.mock("@/features/studies/components/StudyDesignWorkbench", async () => {
  const React = await import("react");

  return {
    StudyDesignWorkbench: ({ study }: { study: Study }) =>
      React.createElement(
        "section",
        { "data-testid": "study-design-workbench" },
        study.title,
      ),
  };
});

const importedStudy = {
  id: 42,
  slug: "hypertension-study-v3-2",
  title: "Hypertension Study v3.2",
  description: "Imported from protocol upload.",
  primary_objective: "Estimate hypertension outcomes.",
  status: "draft",
  study_type: "characterization",
} as Study;

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("StudyDesignerPage", () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue({
      study: importedStudy,
      session: { id: 7 },
      version: { id: 11 },
    });
    vi.mocked(useImportProtocolAsNewStudy).mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    } as ReturnType<typeof useImportProtocolAsNewStudy>);
    vi.mocked(lintCohort).mockResolvedValue([]);
  });

  it("renders protocol import output in place instead of navigating to the study detail route", async () => {
    const { container } = renderWithProviders(
      <>
        <StudyDesignerPage />
        <LocationProbe />
      </>,
      { initialRoute: "/study-designer" },
    );
    const file = new File(["# Protocol"], "hypertension-protocol.md", {
      type: "text/markdown",
    });
    const input = container.querySelector('input[type="file"]');

    expect(input).toBeInstanceOf(HTMLInputElement);
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId("study-design-workbench")).toHaveTextContent(
        "Hypertension Study v3.2",
      );
    });

    expect(mutateAsync).toHaveBeenCalledWith({ file });
    expect(screen.getByTestId("location")).toHaveTextContent("/study-designer");
    expect(screen.getByRole("link", { name: "Open full study" })).toHaveAttribute(
      "href",
      "/studies/hypertension-study-v3-2?tab=design",
    );
  });

  it("shows invalid JSON lint errors before calling the lint endpoint", async () => {
    renderWithProviders(<StudyDesignerPage />, {
      initialRoute: "/study-designer",
    });

    fireEvent.click(screen.getByRole("button", { name: "Cohort Lint" }));
    fireEvent.change(screen.getByPlaceholderText(/ConceptSets/), {
      target: { value: '{"ConceptSets": [' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Lint" }));

    expect(await screen.findByText(/Invalid JSON:/)).toBeInTheDocument();
    expect(lintCohort).not.toHaveBeenCalled();
  });

  it("renders recommendations on the Recommend tab when intent flow has produced data", async () => {
    vi.mocked(recommendPhenotypes).mockResolvedValue([
      {
        cohortId: 101,
        name: "Type 2 Diabetes Phenotype",
        rationale: "Standard OHDSI phenotype for adults with T2D.",
        score: 0.92,
      },
    ]);
    vi.mocked(splitIntent).mockResolvedValue({
      target: "Adults with type 2 diabetes",
      outcome: "Heart failure incidence",
    });

    renderWithProviders(<StudyDesignerPage />, {
      initialRoute: "/study-designer",
    });

    fireEvent.change(screen.getByPlaceholderText(/Compare the risk/), {
      target: { value: "Compare T2D treatment risks" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze Study Intent" }));

    await waitFor(() => {
      expect(recommendPhenotypes).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Recommendations" }));

    expect(
      await screen.findByText("Type 2 Diabetes Phenotype"),
    ).toBeInTheDocument();
  });

  it("renders 'N/A' for non-finite recommendation score", async () => {
    vi.mocked(recommendPhenotypes).mockResolvedValue([
      {
        cohortId: 1,
        name: "Mystery Phenotype",
        rationale: "Score is NaN.",
        score: Number.NaN,
      },
    ]);
    vi.mocked(splitIntent).mockResolvedValue({
      target: "x",
      outcome: "y",
    });

    renderWithProviders(<StudyDesignerPage />, {
      initialRoute: "/study-designer",
    });

    fireEvent.change(screen.getByPlaceholderText(/Compare the risk/), {
      target: { value: "Test intent" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze Study Intent" }));

    expect(await screen.findByText("Score: N/A")).toBeInTheDocument();
    expect(screen.queryByText(/Score:\s*NaN/)).not.toBeInTheDocument();
  });

  it("shows mutation error message on Lint server error", async () => {
    vi.mocked(lintCohort).mockRejectedValue(new Error("Server boom"));

    renderWithProviders(<StudyDesignerPage />, {
      initialRoute: "/study-designer",
    });

    fireEvent.click(screen.getByRole("button", { name: "Cohort Lint" }));
    fireEvent.change(screen.getByPlaceholderText(/ConceptSets/), {
      target: { value: '{"ConceptSets": []}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Lint" }));

    expect(await screen.findByText("Server boom")).toBeInTheDocument();
  });
});
