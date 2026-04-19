// Phase 16 Plan 05 Task 1 — GeneTrack unit tests (D-07, D-08).
//
// Covers: one <rect> per gene, strand arrow glyph per ±, gene_name label,
// and the "No genes in range" empty state.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GeneTrack } from "../GeneTrack";
import type { Gene } from "../../../api/gwas-results";

function gene(partial: Partial<Gene>): Gene {
  return {
    gene_name: "ACME1",
    chrom: "17",
    start: 43_000_000,
    end: 43_050_000,
    strand: "+",
    gene_type: "protein_coding",
    ...partial,
  };
}

describe("GeneTrack", () => {
  it("renders exactly one <rect> per gene", () => {
    const genes: Gene[] = [
      gene({ gene_name: "A", start: 43_000_000, end: 43_020_000 }),
      gene({ gene_name: "B", start: 43_030_000, end: 43_060_000 }),
      gene({ gene_name: "C", start: 43_100_000, end: 43_150_000 }),
    ];
    const { container } = render(
      <GeneTrack
        genes={genes}
        chromStart={43_000_000}
        chromEnd={43_200_000}
        width={800}
      />,
    );
    const rects = container.querySelectorAll("rect");
    expect(rects).toHaveLength(3);
  });

  it("renders a right arrow for + strand and a left arrow for - strand", () => {
    const genes: Gene[] = [
      gene({ gene_name: "FWD", strand: "+" }),
      gene({
        gene_name: "REV",
        strand: "-",
        start: 43_100_000,
        end: 43_120_000,
      }),
    ];
    render(
      <GeneTrack
        genes={genes}
        chromStart={43_000_000}
        chromEnd={43_200_000}
        width={800}
      />,
    );
    expect(screen.getByText(/FWD\s+\u25B6/)).toBeInTheDocument();
    expect(screen.getByText(/REV\s+\u25C0/)).toBeInTheDocument();
  });

  it("renders gene_name text labels above each rect", () => {
    const genes: Gene[] = [
      gene({ gene_name: "NF1", start: 29_000_000, end: 29_300_000 }),
    ];
    render(
      <GeneTrack
        genes={genes}
        chromStart={28_000_000}
        chromEnd={30_000_000}
        width={600}
      />,
    );
    // Partial match tolerates the trailing strand glyph.
    expect(screen.getByText(/NF1/)).toBeInTheDocument();
  });

  it("renders the empty-state when genes is empty", () => {
    render(
      <GeneTrack
        genes={[]}
        chromStart={1}
        chromEnd={1_000_000}
        width={800}
      />,
    );
    expect(screen.getByTestId("gene-track-empty")).toHaveTextContent(
      "No genes in range",
    );
  });

  it("exposes an aria-label summarizing the gene count", () => {
    const genes: Gene[] = [
      gene({ gene_name: "A" }),
      gene({ gene_name: "B" }),
    ];
    render(
      <GeneTrack
        genes={genes}
        chromStart={43_000_000}
        chromEnd={43_200_000}
        width={800}
      />,
    );
    expect(
      screen.getByRole("img", { name: /2 genes/ }),
    ).toBeInTheDocument();
  });
});
