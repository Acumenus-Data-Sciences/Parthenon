import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConceptSetStatsBar } from "../ConceptSetStatsBar";
import { useConceptSetStats } from "../../hooks/useConceptSets";

vi.mock("../../hooks/useConceptSets", () => ({
  useConceptSetStats: vi.fn(),
}));

const mockUseConceptSetStats = useConceptSetStats as unknown as Mock;

describe("ConceptSetStatsBar", () => {
  beforeEach(() => {
    mockUseConceptSetStats.mockReset();
  });

  it("returns null when stats have not loaded", () => {
    mockUseConceptSetStats.mockReturnValue({ data: undefined });
    const { container } = render(<ConceptSetStatsBar />);
    expect(container.innerHTML).toBe("");
  });

  it("renders Total, With Items, and Public metrics", () => {
    mockUseConceptSetStats.mockReturnValue({
      data: { total: 128, with_items: 96, public: 24 },
    });
    render(<ConceptSetStatsBar />);
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("With Items")).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.getByText("128")).toBeInTheDocument();
    expect(screen.getByText("96")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
  });

  it("invokes onStatClick with the metric key when a tile is clicked", () => {
    mockUseConceptSetStats.mockReturnValue({
      data: { total: 10, with_items: 5, public: 2 },
    });
    const onStatClick = vi.fn();
    render(<ConceptSetStatsBar onStatClick={onStatClick} />);
    fireEvent.click(screen.getByText("With Items").closest("[role='button']")!);
    expect(onStatClick).toHaveBeenCalledWith("with_items");
  });

  it("highlights the active metric via activeKey", () => {
    mockUseConceptSetStats.mockReturnValue({
      data: { total: 3, with_items: 2, public: 1 },
    });
    render(<ConceptSetStatsBar activeKey="public" />);
    const publicTile = screen.getByText("Public").closest("[role='button']")!;
    expect(publicTile.className).toContain("#C9A227");
  });
});
