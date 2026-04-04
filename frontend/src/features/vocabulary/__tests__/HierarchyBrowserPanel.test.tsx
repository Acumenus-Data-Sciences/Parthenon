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

  it("drills into domain roots when clicked at root level", async () => {
    const user = userEvent.setup();

    mockedUseConceptTree.mockImplementation((parentId: number) => ({
      data: parentId === 0
        ? [
            {
              concept_id: -1,
              concept_name: "Conditions",
              domain_id: "Condition",
              vocabulary_id: "OMOP",
              concept_class_id: "Domain",
              child_count: 174,
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

    await user.click(screen.getByText("Conditions"));

    // Should have drilled down — breadcrumb and child visible
    expect(screen.getByText("Diabetes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conditions" })).toBeInTheDocument();
  });

  it("selects leaf concepts for detail panel", async () => {
    const user = userEvent.setup();
    const onSelectConcept = vi.fn();

    mockedUseConceptTree.mockImplementation((parentId: number) => ({
      data: parentId === 0
        ? [
            {
              concept_id: -1,
              concept_name: "Conditions",
              domain_id: "Condition",
              vocabulary_id: "OMOP",
              concept_class_id: "Domain",
              child_count: 1,
              depth: 0,
            },
          ]
        : [
            {
              concept_id: 201826,
              concept_name: "Type 2 diabetes mellitus",
              domain_id: "Condition",
              vocabulary_id: "SNOMED",
              concept_class_id: "Clinical Finding",
              child_count: 0,
              depth: 2,
            },
          ],
      isLoading: false,
    }) as ReturnType<typeof useConceptTree>);

    renderWithProviders(
      <HierarchyBrowserPanel mode="browse" onSelectConcept={onSelectConcept} />,
    );

    // First drill into Conditions domain
    await user.click(screen.getByText("Conditions"));

    // Now click the leaf concept
    await user.click(screen.getByText("Type 2 diabetes mellitus"));

    expect(onSelectConcept).toHaveBeenCalledWith(201826);
  });

  it("drills into branch concepts when clicked at child level", async () => {
    const user = userEvent.setup();
    const onSelectConcept = vi.fn();

    mockedUseConceptTree.mockImplementation((parentId: number) => ({
      data: parentId === 0
        ? [
            {
              concept_id: 10,
              concept_name: "Branch Category",
              domain_id: "Condition",
              vocabulary_id: "SNOMED",
              concept_class_id: "Clinical Finding",
              child_count: 5,
              depth: 1,
            },
          ]
        : [
            {
              concept_id: 20,
              concept_name: "Leaf Concept",
              domain_id: "Condition",
              vocabulary_id: "SNOMED",
              concept_class_id: "Clinical Finding",
              child_count: 0,
              depth: 2,
            },
          ],
      isLoading: false,
    }) as ReturnType<typeof useConceptTree>);

    renderWithProviders(
      <HierarchyBrowserPanel mode="browse" onSelectConcept={onSelectConcept} />,
    );

    // At root (parentId=0), but these are NOT domain cards (concept_id > 0)
    // Wait — parentId=0 means root, which renders domain cards.
    // But concept_id=10 > 0 so it's not a virtual root.
    // The root level renders as cards, clicking drills down.
    await user.click(screen.getByText("Branch Category"));

    // Should drill down
    expect(screen.getByText("Leaf Concept")).toBeInTheDocument();
    expect(onSelectConcept).not.toHaveBeenCalled();
  });
});
