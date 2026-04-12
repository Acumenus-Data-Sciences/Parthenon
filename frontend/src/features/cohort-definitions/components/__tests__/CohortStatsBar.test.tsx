import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CohortStatsBar } from "../CohortStatsBar";
import { useCohortStats } from "../../hooks/useCohortDefinitions";

vi.mock("../../hooks/useCohortDefinitions", () => ({
  useCohortStats: vi.fn(),
}));

const mockUseCohortStats = useCohortStats as unknown as Mock;

describe("CohortStatsBar", () => {
  beforeEach(() => {
    mockUseCohortStats.mockReset();
  });

  it("returns null when stats are not loaded", () => {
    mockUseCohortStats.mockReturnValue({ data: undefined });
    const { container } = render(<CohortStatsBar />);
    expect(container.innerHTML).toBe("");
  });

  it("renders total, generated, and public metrics when data is present", () => {
    mockUseCohortStats.mockReturnValue({
      data: { total: 42, with_generations: 18, public: 7 },
    });
    render(<CohortStatsBar />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Generated")).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
  });

  it("invokes onStatClick with the metric key when a tile is clicked", () => {
    mockUseCohortStats.mockReturnValue({
      data: { total: 3, with_generations: 2, public: 1 },
    });
    const onStatClick = vi.fn();
    render(<CohortStatsBar onStatClick={onStatClick} />);
    fireEvent.click(screen.getByText("Total").closest("[role='button']")!);
    expect(onStatClick).toHaveBeenCalledWith("total");
  });

  it("highlights the active metric via the activeKey prop", () => {
    mockUseCohortStats.mockReturnValue({
      data: { total: 3, with_generations: 2, public: 1 },
    });
    render(<CohortStatsBar activeKey="public" />);
    const publicTile = screen.getByText("Public").closest("[role='button']")!;
    expect(publicTile.className).toContain("#C9A227");
  });
});
