// Phase 16 Plan 05 Task 1 — RegionalView tests (D-06, D-08, D-09).
//
// Covers: axis label formatting, window clamping to 1 Mb, loading state,
// Close button callback, and composition of LegendBand + GeneTrack.
//
// The Plan 04 hooks (useManhattanRegion, useGencodeGenes) are mocked so this
// suite is independent of Plan 04's progress.
import { createElement, type ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../hooks/useManhattanRegion", () => ({
  useManhattanRegion: vi.fn(),
}));
vi.mock("../../../hooks/useGencodeGenes", () => ({
  useGencodeGenes: vi.fn(),
}));

import { useManhattanRegion } from "../../../hooks/useManhattanRegion";
import { useGencodeGenes } from "../../../hooks/useGencodeGenes";
import { RegionalView } from "../RegionalView";

function wrap(children: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: qc }, children);
}

type UMRReturn = ReturnType<typeof useManhattanRegion>;
type UGGReturn = ReturnType<typeof useGencodeGenes>;

function stubManhattanRegion(overrides: Partial<UMRReturn>): UMRReturn {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  } as UMRReturn;
}

function stubGencodeGenes(overrides: Partial<UGGReturn>): UGGReturn {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  } as UGGReturn;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RegionalView", () => {
  it("requests a ±500 kb window around the clicked center position", () => {
    vi.mocked(useManhattanRegion).mockReturnValue(
      stubManhattanRegion({
        data: { variants: [], chrom: "17", start: 0, end: 0 },
      }),
    );
    vi.mocked(useGencodeGenes).mockReturnValue(
      stubGencodeGenes({
        data: { genes: [], chrom: "17", start: 0, end: 0 },
      }),
    );

    render(
      wrap(
        <RegionalView
          runId="01JABC"
          chrom="17"
          center={43_500_000}
          onClose={() => undefined}
        />,
      ),
    );

    // 43_500_000 - 500_000 = 43_000_000 → 44_000_000 = 1 Mb window
    expect(useManhattanRegion).toHaveBeenCalledWith(
      "01JABC",
      "17",
      43_000_000,
      44_000_000,
    );
    expect(useGencodeGenes).toHaveBeenCalledWith(
      "17",
      43_000_000,
      44_000_000,
    );
  });

  it("renders the axis label with locale-formatted start/end", () => {
    vi.mocked(useManhattanRegion).mockReturnValue(
      stubManhattanRegion({
        data: { variants: [], chrom: "1", start: 0, end: 0 },
      }),
    );
    vi.mocked(useGencodeGenes).mockReturnValue(
      stubGencodeGenes({
        data: { genes: [], chrom: "1", start: 0, end: 0 },
      }),
    );

    render(
      wrap(
        <RegionalView
          runId="01JABC"
          chrom="1"
          center={1_500_000}
          onClose={() => undefined}
        />,
      ),
    );

    expect(screen.getByTestId("regional-axis-label")).toHaveTextContent(
      /chr1:\s*1,000,000\u2013\s*2,000,000/,
    );
  });

  it("shows the loading state while either query is pending", () => {
    vi.mocked(useManhattanRegion).mockReturnValue(
      stubManhattanRegion({ isLoading: true }),
    );
    vi.mocked(useGencodeGenes).mockReturnValue(
      stubGencodeGenes({ isLoading: false }),
    );

    render(
      wrap(
        <RegionalView
          runId="01JABC"
          chrom="17"
          center={43_500_000}
          onClose={() => undefined}
        />,
      ),
    );

    expect(screen.getByTestId("regional-loading")).toBeInTheDocument();
  });

  it("composes the LegendBand + GeneTrack when data is ready", () => {
    vi.mocked(useManhattanRegion).mockReturnValue(
      stubManhattanRegion({
        data: {
          variants: [
            {
              chrom: "17",
              pos: 43_500_000,
              ref: "A",
              alt: "T",
              af: 0.12,
              beta: 0.05,
              se: 0.01,
              p_value: 1e-12,
              snp_id: "rs123",
            },
          ],
          chrom: "17",
          start: 43_000_000,
          end: 44_000_000,
        },
      }),
    );
    vi.mocked(useGencodeGenes).mockReturnValue(
      stubGencodeGenes({
        data: {
          genes: [
            {
              gene_name: "GENE1",
              chrom: "17",
              start: 43_200_000,
              end: 43_250_000,
              strand: "+",
              gene_type: "protein_coding",
            },
          ],
          chrom: "17",
          start: 43_000_000,
          end: 44_000_000,
        },
      }),
    );

    render(
      wrap(
        <RegionalView
          runId="01JABC"
          chrom="17"
          center={43_500_000}
          onClose={() => undefined}
        />,
      ),
    );

    expect(screen.getByTestId("regional-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("legend-band-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("gene-track-svg")).toBeInTheDocument();
    expect(screen.getByText(/GENE1/)).toBeInTheDocument();
  });

  it("fires onClose when the Close button is clicked", () => {
    vi.mocked(useManhattanRegion).mockReturnValue(
      stubManhattanRegion({
        data: { variants: [], chrom: "17", start: 0, end: 0 },
      }),
    );
    vi.mocked(useGencodeGenes).mockReturnValue(
      stubGencodeGenes({
        data: { genes: [], chrom: "17", start: 0, end: 0 },
      }),
    );
    const onClose = vi.fn();

    render(
      wrap(
        <RegionalView
          runId="01JABC"
          chrom="17"
          center={43_500_000}
          onClose={onClose}
        />,
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("clamps window when center is very small (never goes below 1)", () => {
    vi.mocked(useManhattanRegion).mockReturnValue(
      stubManhattanRegion({
        data: { variants: [], chrom: "1", start: 0, end: 0 },
      }),
    );
    vi.mocked(useGencodeGenes).mockReturnValue(
      stubGencodeGenes({
        data: { genes: [], chrom: "1", start: 0, end: 0 },
      }),
    );

    render(
      wrap(
        <RegionalView
          runId="01JABC"
          chrom="1"
          center={100_000}
          onClose={() => undefined}
        />,
      ),
    );

    const [, , start] = vi.mocked(useManhattanRegion).mock.calls[0];
    expect(start).toBe(1);
  });
});
