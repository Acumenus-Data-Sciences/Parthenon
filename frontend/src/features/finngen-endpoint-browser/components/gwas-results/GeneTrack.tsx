// Phase 16 Plan 05 Task 1 — GeneTrack (D-07, D-08 gene track in regional view).
//
// Renders one SVG <rect> per gene clipped to the visible window, with a strand
// arrow label and gene name. 3-lane stacking keeps overlapping genes readable
// without a full collision solver (sufficient for v1 density of ~5–30 genes
// per ±500 kb window). Gene/pseudogene filtering is done server-side
// (RESEARCH §Pitfall 7) so every gene received is rendered.
//
// SVG (not Canvas) chosen per D-08 — gene_name labels benefit from DOM text
// for click/hover interactions added later; v1 ships read-only rects.
import { useMemo } from "react";
import * as d3 from "d3";
import type { Gene } from "../../api/gwas-results";

export interface GeneTrackProps {
  genes: Gene[];
  chromStart: number;
  chromEnd: number;
  width: number;
  height?: number;
}

export function GeneTrack({
  genes,
  chromStart,
  chromEnd,
  width,
  height = 80,
}: GeneTrackProps): JSX.Element {
  const scale = useMemo(
    () => d3.scaleLinear().domain([chromStart, chromEnd]).range([0, width]),
    [chromStart, chromEnd, width],
  );

  if (genes.length === 0) {
    return (
      <div
        className="py-2 text-xs text-text-muted"
        data-testid="gene-track-empty"
      >
        No genes in range
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={`Gene track: ${genes.length} genes`}
      data-testid="gene-track-svg"
    >
      {genes.map((g, i) => {
        const x0 = scale(Math.max(g.start, chromStart));
        const x1 = scale(Math.min(g.end, chromEnd));
        const y = 30 + (i % 3) * 18;
        return (
          <g key={`${g.gene_name}-${g.start}`}>
            <rect
              x={x0}
              y={y}
              width={Math.max(2, x1 - x0)}
              height={6}
              fill="#2DD4BF"
              rx={1}
            />
            <text
              x={x0}
              y={y - 2}
              fontSize={9}
              fill="#A1A1AA"
            >
              {g.gene_name} {g.strand === "+" ? "\u25B6" : "\u25C0"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
