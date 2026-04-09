import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConceptSetItemDetailExpander } from "../ConceptSetItemDetailExpander";
import {
  useConcept,
  useConceptAncestors,
  useConceptRelationships,
  useConceptMapsFrom,
} from "@/features/vocabulary/hooks/useVocabularySearch";

vi.mock("@/features/vocabulary/hooks/useVocabularySearch", () => ({
  useConcept: vi.fn(),
  useConceptAncestors: vi.fn(),
  useConceptRelationships: vi.fn(),
  useConceptMapsFrom: vi.fn(),
}));

const mockUseConcept = useConcept as unknown as Mock;
const mockUseConceptAncestors = useConceptAncestors as unknown as Mock;
const mockUseConceptRelationships = useConceptRelationships as unknown as Mock;
const mockUseConceptMapsFrom = useConceptMapsFrom as unknown as Mock;

describe("ConceptSetItemDetailExpander", () => {
  beforeEach(() => {
    mockUseConcept.mockReset();
    mockUseConceptAncestors.mockReset();
    mockUseConceptRelationships.mockReset();
    mockUseConceptMapsFrom.mockReset();

    mockUseConcept.mockReturnValue({ data: undefined, isLoading: true });
    mockUseConceptAncestors.mockReturnValue({ data: undefined, isLoading: false });
    mockUseConceptRelationships.mockReturnValue({ data: undefined, isLoading: false });
    mockUseConceptMapsFrom.mockReturnValue({ data: undefined, isLoading: false });
  });

  it("renders the four tab labels", () => {
    render(<ConceptSetItemDetailExpander conceptId={201820} />);
    expect(screen.getByText("Info")).toBeInTheDocument();
    expect(screen.getByText("Hierarchy")).toBeInTheDocument();
    expect(screen.getByText("Relationships")).toBeInTheDocument();
    expect(screen.getByText("Maps From")).toBeInTheDocument();
  });

  it("starts on the Info tab and shows a loading spinner while the concept loads", () => {
    const { container } = render(
      <ConceptSetItemDetailExpander conceptId={201820} />,
    );
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders concept fields once the concept is loaded", () => {
    mockUseConcept.mockReturnValue({
      data: {
        concept_id: 201820,
        concept_name: "Diabetes mellitus",
        concept_code: "73211009",
        vocabulary_id: "SNOMED",
        concept_class_id: "Clinical Finding",
        domain_id: "Condition",
        standard_concept: "S",
      },
      isLoading: false,
    });
    render(<ConceptSetItemDetailExpander conceptId={201820} />);
    expect(screen.getByText("Diabetes mellitus")).toBeInTheDocument();
    expect(screen.getByText("SNOMED")).toBeInTheDocument();
    expect(screen.getByText("73211009")).toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeInTheDocument();
  });

  it("switches to the Hierarchy tab and shows its empty state", () => {
    mockUseConcept.mockReturnValue({ data: undefined, isLoading: false });
    mockUseConceptAncestors.mockReturnValue({ data: [], isLoading: false });
    render(<ConceptSetItemDetailExpander conceptId={201820} />);
    fireEvent.click(screen.getByText("Hierarchy"));
    expect(screen.getByText("No ancestors found")).toBeInTheDocument();
  });

  it("switches to Relationships tab and shows its empty state", () => {
    mockUseConcept.mockReturnValue({ data: undefined, isLoading: false });
    mockUseConceptRelationships.mockReturnValue({
      data: { items: [], total: 0, limit: 10 },
      isLoading: false,
    });
    render(<ConceptSetItemDetailExpander conceptId={201820} />);
    fireEvent.click(screen.getByText("Relationships"));
    expect(screen.getByText("No relationships found")).toBeInTheDocument();
  });
});
