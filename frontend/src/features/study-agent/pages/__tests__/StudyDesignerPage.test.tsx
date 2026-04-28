import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    StudyDesignWorkbench: ({
      study,
      headingRef,
    }: {
      study: Study;
      headingRef?: React.Ref<HTMLHeadingElement>;
    }) =>
      React.createElement(
        "section",
        { "data-testid": "study-design-workbench" },
        React.createElement(
          "h2",
          { ref: headingRef, tabIndex: -1, "data-testid": "workbench-heading" },
          study.title,
        ),
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

    fireEvent.click(screen.getByRole("tab", { name: "Cohort Lint" }));
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

    fireEvent.click(screen.getByRole("tab", { name: "Recommendations" }));

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

    fireEvent.click(screen.getByRole("tab", { name: "Cohort Lint" }));
    fireEvent.change(screen.getByPlaceholderText(/ConceptSets/), {
      target: { value: '{"ConceptSets": []}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Lint" }));

    expect(await screen.findByText("Server boom")).toBeInTheDocument();
  });

  describe("a11y — tablist", () => {
    it("exposes WAI-ARIA tablist with aria-selected matching active tab", () => {
      renderWithProviders(<StudyDesignerPage />, {
        initialRoute: "/study-designer",
      });

      const tablist = screen.getByRole("tablist");
      expect(tablist).toBeInTheDocument();

      const intentTab = screen.getByRole("tab", { name: "Study Intent" });
      const searchTab = screen.getByRole("tab", { name: "Phenotype Search" });
      expect(intentTab).toHaveAttribute("aria-selected", "true");
      expect(searchTab).toHaveAttribute("aria-selected", "false");

      // The selected tab is in the tab order; the rest are roving with tabIndex=-1.
      expect(intentTab).toHaveAttribute("tabindex", "0");
      expect(searchTab).toHaveAttribute("tabindex", "-1");
    });

    it("ArrowRight / ArrowLeft / Home / End cycle and select tabs", async () => {
      const user = userEvent.setup();
      renderWithProviders(<StudyDesignerPage />, {
        initialRoute: "/study-designer",
      });

      const intentTab = screen.getByRole("tab", { name: "Study Intent" });
      const searchTab = screen.getByRole("tab", { name: "Phenotype Search" });
      const recommendTab = screen.getByRole("tab", { name: "Recommendations" });
      const lintTab = screen.getByRole("tab", { name: "Cohort Lint" });

      // Focus the active tab; selection-follows-focus on arrow keys.
      intentTab.focus();
      expect(document.activeElement).toBe(intentTab);

      await user.keyboard("{ArrowRight}");
      expect(searchTab).toHaveAttribute("aria-selected", "true");
      expect(document.activeElement).toBe(searchTab);

      await user.keyboard("{End}");
      expect(lintTab).toHaveAttribute("aria-selected", "true");
      expect(document.activeElement).toBe(lintTab);

      // ArrowRight from last wraps to first
      await user.keyboard("{ArrowRight}");
      expect(intentTab).toHaveAttribute("aria-selected", "true");

      // ArrowLeft from first wraps to last
      await user.keyboard("{ArrowLeft}");
      expect(lintTab).toHaveAttribute("aria-selected", "true");

      await user.keyboard("{Home}");
      expect(intentTab).toHaveAttribute("aria-selected", "true");
      expect(document.activeElement).toBe(intentTab);

      // Recommend tab kept untouched is in DOM and reachable via single ArrowRight twice
      await user.keyboard("{ArrowRight}{ArrowRight}");
      expect(recommendTab).toHaveAttribute("aria-selected", "true");
    });

    it("focuses the workbench heading after a successful protocol import", async () => {
      const { container } = renderWithProviders(<StudyDesignerPage />, {
        initialRoute: "/study-designer",
      });

      const file = new File(["# Protocol"], "p.md", { type: "text/markdown" });
      const input = container.querySelector('input[type="file"]');
      expect(input).toBeInstanceOf(HTMLInputElement);
      fireEvent.change(input!, { target: { files: [file] } });

      const heading = await screen.findByTestId("workbench-heading");
      await waitFor(() => {
        expect(document.activeElement).toBe(heading);
      });
    });
  });
});
