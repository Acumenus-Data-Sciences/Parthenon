import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConceptSetEditor } from "../ConceptSetEditor";
import {
  useResolveConceptSet,
  useUpdateConceptSetItem,
  useRemoveConceptSetItem,
  useBulkUpdateConceptSetItems,
} from "../../hooks/useConceptSets";
import type { ConceptSet, ConceptSetItem } from "../../types/conceptSet";

vi.mock("../../hooks/useConceptSets", () => ({
  useResolveConceptSet: vi.fn(),
  useUpdateConceptSetItem: vi.fn(),
  useRemoveConceptSetItem: vi.fn(),
  useBulkUpdateConceptSetItems: vi.fn(),
}));

// Mock the detail expander to avoid cascading vocabulary hook dependencies
vi.mock("../ConceptSetItemDetailExpander", () => ({
  ConceptSetItemDetailExpander: () => (
    <div data-testid="detail-expander" />
  ),
}));

const mockUseResolveConceptSet = useResolveConceptSet as unknown as Mock;
const mockUseUpdateConceptSetItem = useUpdateConceptSetItem as unknown as Mock;
const mockUseRemoveConceptSetItem = useRemoveConceptSetItem as unknown as Mock;
const mockUseBulkUpdateConceptSetItems =
  useBulkUpdateConceptSetItems as unknown as Mock;

function makeItem(overrides: Partial<ConceptSetItem> = {}): ConceptSetItem {
  return {
    id: 1,
    concept_set_id: 1,
    concept_id: 201820,
    is_excluded: false,
    include_descendants: true,
    include_mapped: false,
    concept: {
      concept_id: 201820,
      concept_name: "Diabetes mellitus",
      domain_id: "Condition",
      vocabulary_id: "SNOMED",
      concept_class_id: "Clinical Finding",
      standard_concept: "S",
      concept_code: "73211009",
    },
    ...overrides,
  };
}

function makeConceptSet(items: ConceptSetItem[]): ConceptSet {
  return {
    id: 10,
    name: "Diabetes",
    description: null,
    expression_json: null,
    author_id: 1,
    is_public: true,
    tags: [],
    items,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("ConceptSetEditor", () => {
  beforeEach(() => {
    mockUseResolveConceptSet.mockReset();
    mockUseUpdateConceptSetItem.mockReset();
    mockUseRemoveConceptSetItem.mockReset();
    mockUseBulkUpdateConceptSetItems.mockReset();

    mockUseResolveConceptSet.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: vi.fn(),
    });
    mockUseUpdateConceptSetItem.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mockUseRemoveConceptSetItem.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mockUseBulkUpdateConceptSetItems.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it("renders the empty state when the concept set has no items", () => {
    render(<ConceptSetEditor conceptSet={makeConceptSet([])} />);
    expect(screen.getByText("No concepts added yet")).toBeInTheDocument();
    expect(screen.getByText("0 items")).toBeInTheDocument();
  });

  it("renders a row for each concept item", () => {
    const items = [makeItem({ id: 1 }), makeItem({ id: 2, concept_id: 12345 })];
    render(<ConceptSetEditor conceptSet={makeConceptSet(items)} />);
    expect(screen.getByText("2 items")).toBeInTheDocument();
    expect(screen.getAllByText("Diabetes mellitus").length).toBe(2);
  });

  it("calls resolveConceptSet refetch when the Resolve button is clicked", () => {
    const refetch = vi.fn();
    mockUseResolveConceptSet.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch,
    });
    render(<ConceptSetEditor conceptSet={makeConceptSet([makeItem()])} />);
    fireEvent.click(screen.getByText("Resolve"));
    expect(refetch).toHaveBeenCalled();
  });

  it("displays the resolved concept count after resolution", () => {
    mockUseResolveConceptSet.mockReturnValue({
      data: { concept_ids: [1, 2, 3], count: 3 },
      isLoading: false,
      refetch: vi.fn(),
    });
    render(<ConceptSetEditor conceptSet={makeConceptSet([makeItem()])} />);
    fireEvent.click(screen.getByText("Resolve"));
    expect(screen.getByText(/Resolved to/i)).toBeInTheDocument();
  });

  it("shows the bulk action toolbar when items are selected", () => {
    const items = [makeItem({ id: 1 }), makeItem({ id: 2 })];
    render(<ConceptSetEditor conceptSet={makeConceptSet(items)} />);
    // Click the row checkbox for item 1 (second checkbox — first is select-all)
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByText(/Descendants On/)).toBeInTheDocument();
  });
});
