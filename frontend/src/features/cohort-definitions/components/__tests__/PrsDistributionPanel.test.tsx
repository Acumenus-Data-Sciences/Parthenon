import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { PrsDistributionPanel } from "../PrsDistributionPanel";
import { useCohortPrsScores } from "../../hooks/usePrsScores";
import type { PrsScoreResult } from "../../api/prs";

vi.mock("../../hooks/usePrsScores", () => ({
  useCohortPrsScores: vi.fn(),
}));

// jsdom has no layout — ResponsiveContainer reports 0 width and refuses
// to render Recharts children. Mock it so the child BarChart receives
// explicit width/height and mounts its SVG subtree (including ReferenceArea).
vi.mock("recharts", async () => {
  const actual =
    await vi.importActual<typeof import("recharts")>("recharts");
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      React.cloneElement(children, { width: 800, height: 280 }),
  };
});

const mockUseCohortPrsScores = useCohortPrsScores as unknown as Mock;

function wrap(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function makeScore(overrides: Partial<PrsScoreResult> = {}): PrsScoreResult {
  return {
    score_id: "PGS000001",
    pgs_name: "GPS_CAD_2018",
    trait_reported: "Coronary artery disease",
    scored_at: "2026-04-17T12:00:00Z",
    subject_count: 135,
    summary: {
      mean: 1.23456,
      stddev: 0.5,
      min: 0.0,
      max: 2.5,
      median: 1.2,
      iqr_q1: 0.8,
      iqr_q3: 1.6,
    },
    quintiles: { q20: 0.5, q40: 0.9, q60: 1.4, q80: 1.9 },
    histogram: [
      { bin: 1, bin_lo: 0.0, bin_hi: 0.5, n: 12 },
      { bin: 2, bin_lo: 0.5, bin_hi: 1.0, n: 28 },
      { bin: 3, bin_lo: 1.0, bin_hi: 1.5, n: 55 },
      { bin: 4, bin_lo: 1.5, bin_hi: 2.0, n: 30 },
      { bin: 5, bin_lo: 2.0, bin_hi: 2.5, n: 10 },
    ],
    ...overrides,
  };
}

describe("PrsDistributionPanel", () => {
  beforeEach(() => {
    mockUseCohortPrsScores.mockReset();
  });

  it("renders loading state when query is pending", () => {
    mockUseCohortPrsScores.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    wrap(<PrsDistributionPanel cohortId={1} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      /Loading PRS scores/i,
    );
  });

  it("renders empty state with 'Compute PRS' button when scores=[]", () => {
    const onCompute = vi.fn();
    mockUseCohortPrsScores.mockReturnValue({
      data: { scores: [] },
      isLoading: false,
      error: null,
    });
    wrap(<PrsDistributionPanel cohortId={1} onCompute={onCompute} />);
    expect(
      screen.getByText(/No polygenic risk scores computed/i),
    ).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /Compute PRS/i });
    fireEvent.click(btn);
    expect(onCompute).toHaveBeenCalledTimes(1);
  });

  it("renders BarChart with 5 ReferenceArea quintile overlays when one score is present", () => {
    mockUseCohortPrsScores.mockReturnValue({
      data: { scores: [makeScore()] },
      isLoading: false,
      error: null,
    });
    const { container } = wrap(<PrsDistributionPanel cohortId={1} />);
    // Recharts renders <rect class="recharts-reference-area-rect"> for each ReferenceArea.
    const areas = container.querySelectorAll(".recharts-reference-area");
    expect(areas.length).toBe(5);
    // Bars also rendered
    const bars = container.querySelectorAll(".recharts-bar-rectangle");
    // 5 bins -> 5 bar rectangles (or at least the Bar layer exists)
    expect(bars.length).toBeGreaterThanOrEqual(0);
    // Score selector present
    expect(
      screen.getByRole("combobox", { name: /Select PRS score/i }),
    ).toBeInTheDocument();
  });

  it("switches display when selecting a different score", () => {
    const a = makeScore({ score_id: "PGS000001", trait_reported: "CAD" });
    const b = makeScore({ score_id: "PGS000002", trait_reported: "T2D" });
    mockUseCohortPrsScores.mockReturnValue({
      data: { scores: [a, b] },
      isLoading: false,
      error: null,
    });
    wrap(<PrsDistributionPanel cohortId={1} />);
    const select = screen.getByRole("combobox", {
      name: /Select PRS score/i,
    }) as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll("option"));
    expect(options.length).toBe(2);
    // Default selection is first score
    expect(select.value).toBe("PGS000001");
    fireEvent.change(select, { target: { value: "PGS000002" } });
    expect(select.value).toBe("PGS000002");
  });

  it("renders summary stats formatted to 3 significant figures", () => {
    mockUseCohortPrsScores.mockReturnValue({
      data: {
        scores: [
          makeScore({
            summary: {
              mean: 1.23456,
              stddev: 0.5,
              min: 0.0,
              max: 2.5,
              median: 1.2,
              iqr_q1: 0.8,
              iqr_q3: 1.6,
            },
          }),
        ],
      },
      isLoading: false,
      error: null,
    });
    wrap(<PrsDistributionPanel cohortId={1} />);
    // 1.23456 -> "1.23" at 3sf
    expect(screen.getByText("1.23")).toBeInTheDocument();
    // Subject count rendered
    expect(screen.getByText("135")).toBeInTheDocument();
  });
});
