// Phase 16 (Plan 16-04) — Vitest coverage for FinnGenManhattanPanel.
//
// Strategy: mock the TanStack Query hook `useManhattanData` at the module
// boundary so each test drives one of the 6 visible states (loading, success,
// in-flight, failed/410, not-found/404, generic error). This isolates the
// panel's branching logic from network + Query internals.
//
// Canvas draw is jsdom-stubbed: we inject a minimal `getContext` shim so the
// useManhattanCanvas draw effect doesn't throw. We do NOT assert on the
// rendered pixels — only on visible DOM (EmptyState titles, banner text, peak
// callback firing).
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import { FinnGenManhattanPanel } from "../FinnGenManhattanPanel";
import type {
  ManhattanPayload,
  ManhattanResponse,
} from "../../../api/gwas-results";

vi.mock("../../../hooks/useManhattanData", async () => {
  const actual = await vi.importActual<
    typeof import("../../../hooks/useManhattanData")
  >("../../../hooks/useManhattanData");
  return {
    ...actual,
    useManhattanData: vi.fn(),
  };
});

// Import the mocked hook AFTER the mock is registered.
import {
  useManhattanData,
  isManhattanInFlight,
  isManhattanReady,
} from "../../../hooks/useManhattanData";

// Minimal canvas shim — jsdom doesn't implement 2d context. The draw effect
// only reads fillStyle/strokeStyle/etc. so we stub every method as a no-op
// to prevent "getContext(2d) returned null" from breaking the success test.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => {
    const noop = () => {};
    const ctx = {
      scale: noop,
      fillRect: noop,
      save: noop,
      restore: noop,
      translate: noop,
      rotate: noop,
      beginPath: noop,
      moveTo: noop,
      lineTo: noop,
      stroke: noop,
      fill: noop,
      arc: noop,
      fillText: noop,
      setLineDash: noop,
      // Properties mutated by the draw loop (no-op setters via the object)
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      globalAlpha: 1,
      font: "",
      textAlign: "start",
    };
    return ctx as unknown as CanvasRenderingContext2D;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

beforeEach(() => {
  vi.clearAllMocks();
});

function queryResult<T>(
  overrides: Partial<UseQueryResult<T, Error>>,
): UseQueryResult<T, Error> {
  const base = {
    data: undefined,
    isLoading: false,
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    status: "success",
    fetchStatus: "idle",
    refetch: vi.fn(),
  };
  return { ...base, ...overrides } as unknown as UseQueryResult<T, Error>;
}

function makeManhattanPayload(): ManhattanPayload {
  return {
    variants: [
      { chrom: "1", pos: 123456, neg_log_p: 9.5, snp_id: "rs1" },
      { chrom: "1", pos: 234567, neg_log_p: 3.2, snp_id: "rs2" },
      { chrom: "2", pos: 345678, neg_log_p: 2.1, snp_id: null },
      { chrom: "2", pos: 456789, neg_log_p: 7.8, snp_id: "rs4" },
      { chrom: "X", pos: 1000000, neg_log_p: 1.5, snp_id: null },
    ],
    genome: { chrom_offsets: { "1": 0, "2": 250000000, X: 2700000000 } },
    thinning: {
      bins: 100,
      threshold: 5e-8,
      variant_count_before: 10_000_000,
      variant_count_after: 97_432,
    },
  };
}

describe("FinnGenManhattanPanel", () => {
  it("renders loading EmptyState while query is pending", () => {
    vi.mocked(useManhattanData).mockReturnValue(
      queryResult<ManhattanResponse>({ isLoading: true, isPending: true }),
    );

    render(<FinnGenManhattanPanel runId="r1" />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders 202 in-flight EmptyState when the run is queued/running", () => {
    vi.mocked(useManhattanData).mockReturnValue(
      queryResult<ManhattanResponse>({
        isSuccess: true,
        data: {
          status: "running",
          run_id: "r1",
          message: "run in progress",
        },
      }),
    );

    render(<FinnGenManhattanPanel runId="r1" />);

    expect(screen.getByText(/still processing/i)).toBeInTheDocument();
    expect(screen.getByText(/polling every 30s/i)).toBeInTheDocument();
  });

  it("renders the thinning banner with before/after counts on success", () => {
    vi.mocked(useManhattanData).mockReturnValue(
      queryResult<ManhattanResponse>({
        isSuccess: true,
        data: makeManhattanPayload(),
      }),
    );

    render(<FinnGenManhattanPanel runId="r1" />);

    // W-4 data-thinning-banner attribute for Plan 07 Playwright assertions
    const banner = document.querySelector("[data-thinning-banner]");
    expect(banner).not.toBeNull();
    expect(banner?.textContent ?? "").toMatch(/97,432/);
    expect(banner?.textContent ?? "").toMatch(/10,000,000/);
  });

  it("forwards peak clicks to onPeakClick with chrom + pos", () => {
    const onPeakClick = vi.fn();
    vi.mocked(useManhattanData).mockReturnValue(
      queryResult<ManhattanResponse>({
        isSuccess: true,
        data: makeManhattanPayload(),
      }),
    );

    render(
      <FinnGenManhattanPanel runId="r1" onPeakClick={onPeakClick} />,
    );

    // The panel exposes the mapping to the underlying canvas onPointClick via
    // a test-hook button (data-testid="__test-invoke-peak") so we can simulate
    // a peak click deterministically without computing canvas coordinates.
    const trigger = screen.getByTestId("__test-invoke-peak");
    fireEvent.click(trigger);

    expect(onPeakClick).toHaveBeenCalledWith("1", 123456);
  });

  it("renders 410 failed-run EmptyState with run-failed copy", () => {
    const err = new Error("gone");
    (err as unknown as { response: { status: number } }).response = {
      status: 410,
    };
    vi.mocked(useManhattanData).mockReturnValue(
      queryResult<ManhattanResponse>({ isError: true, error: err }),
    );

    render(<FinnGenManhattanPanel runId="r1" />);

    expect(screen.getByText(/run failed/i)).toBeInTheDocument();
  });

  it("renders 404 not-found EmptyState for missing run", () => {
    const err = new Error("not found");
    (err as unknown as { response: { status: number } }).response = {
      status: 404,
    };
    vi.mocked(useManhattanData).mockReturnValue(
      queryResult<ManhattanResponse>({ isError: true, error: err }),
    );

    render(<FinnGenManhattanPanel runId="missing" />);

    expect(screen.getByText(/run not found/i)).toBeInTheDocument();
  });

  it("renders generic error fallback for non-classified errors", () => {
    const err = new Error("network down");
    vi.mocked(useManhattanData).mockReturnValue(
      queryResult<ManhattanResponse>({ isError: true, error: err }),
    );

    render(<FinnGenManhattanPanel runId="r1" />);

    expect(
      screen.getByText(/unable to load manhattan plot/i),
    ).toBeInTheDocument();
  });
});

// Minor sanity assertions on the type guards shipped from the hook module.
// These prevent regressions if the union shape changes.
describe("ManhattanResponse type guards", () => {
  it("isManhattanInFlight narrows the in-flight envelope", () => {
    expect(
      isManhattanInFlight({ status: "queued", run_id: "r", message: "m" }),
    ).toBe(true);
    expect(isManhattanInFlight(makeManhattanPayload())).toBe(false);
  });

  it("isManhattanReady narrows the payload shape", () => {
    expect(isManhattanReady(makeManhattanPayload())).toBe(true);
    expect(
      isManhattanReady({ status: "running", run_id: "r", message: "m" }),
    ).toBe(false);
  });
});
