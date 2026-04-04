import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { HierarchyBrowserPanel } from "../components/HierarchyBrowserPanel";
import { useConceptTree } from "../hooks/useConceptTree";

vi.mock("../hooks/useConceptTree", () => ({
  useConceptTree: vi.fn(),
}));

const mockedUseConceptTree = vi.mocked(useConceptTree);

describe("HierarchyBrowserPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects branch concepts without drilling into them", async () => {
    const user = userEvent.setup();
    const onSelectConcept = vi.fn();

    mockedUseConceptTree.mockImplementation((parentId: number) => ({
      data: parentId === 0
        ? [
            {
              concept_id: 10,
              concept_name: "Conditions",
              domain_id: "Condition",
              vocabulary_id: "OMOP",
              concept_class_id: "Domain",
              child_count: 2,
              depth: 0,
            },
          ]
        : [],
      isLoading: false,
    }) as ReturnType<typeof useConceptTree>);

    renderWithProviders(
      <HierarchyBrowserPanel mode="browse" onSelectConcept={onSelectConcept} />,
    );

    await user.click(screen.getByText("Conditions"));

    expect(onSelectConcept).toHaveBeenCalledWith(10);
    expect(
      screen.queryByRole("button", { name: /All Domains.*Conditions/i }),
    ).not.toBeInTheDocument();
  });

  it("drills into branch concepts when the browse control is clicked", async () => {
    const user = userEvent.setup();

    mockedUseConceptTree.mockImplementation((parentId: number) => ({
      data: parentId === 0
        ? [
            {
              concept_id: 10,
              concept_name: "Conditions",
              domain_id: "Condition",
              vocabulary_id: "OMOP",
              concept_class_id: "Domain",
              child_count: 2,
              depth: 0,
            },
          ]
        : [
            {
              concept_id: 11,
              concept_name: "Diabetes",
              domain_id: "Condition",
              vocabulary_id: "SNOMED",
              concept_class_id: "Clinical Finding",
              child_count: 0,
              depth: 1,
            },
          ],
      isLoading: false,
    }) as ReturnType<typeof useConceptTree>);

    renderWithProviders(
      <HierarchyBrowserPanel mode="browse" onSelectConcept={vi.fn()} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Browse children of Conditions" }),
    );

    expect(screen.getByText("Diabetes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conditions" })).toBeInTheDocument();
  });
});
