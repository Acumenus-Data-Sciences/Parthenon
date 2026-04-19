// Phase 16 Plan 05 Task 1 — RegionalView (D-06, D-08).
//
// Renders a ±500 kb (1 Mb) regional drill-down around a click on the full
// Manhattan plot. Layout top-to-bottom:
//
//   1. Header with axis label "chrN: start–end" + Close button
//   2. Canvas variants scatter (inline, ~60 LOC) keyed on the same d3 linear
//      scale as the gene track so SNP x-positions line up with gene rects
//   3. <LegendBand/> placeholder for Phase 16.1 LD gradient (D-09)
//   4. <GeneTrack/> SVG rects with strand arrows
//
// Window is clamped to ≤ 1 Mb on the client (matches backend 2 Mb guard in
// ManhattanRegionQueryRequest per RESEARCH §Example 3). Data comes from
// Plan 04's useManhattanRegion + useGencodeGenes hooks.
import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { useManhattanRegion } from "../../hooks/useManhattanRegion";
import { useGencodeGenes } from "../../hooks/useGencodeGenes";
import type { RegionVariant } from "../../api/gwas-results";
import { GeneTrack } from "./GeneTrack";
import { LegendBand } from "./LegendBand";

export interface RegionalViewProps {
  runId: string;
  chrom: string;
  center: number;
  onClose: () => void;
  width?: number;
}

const WINDOW_HALF_BP = 500_000;
const MAX_WINDOW_BP = 2_000_000;
const CANVAS_HEIGHT = 160;

export function RegionalView({
  runId,
  chrom,
  center,
  onClose,
  width = 960,
}: RegionalViewProps): JSX.Element {
  const { start, end } = useMemo(() => {
    const rawStart = Math.max(1, center - WINDOW_HALF_BP);
    const rawEnd = center + WINDOW_HALF_BP;
    // Defensive clamp — the UI flow should never produce >1 Mb, but any
    // upstream caller passing a bad center gets clipped here so the backend
    // DoS guard (T-16-S4) never has to reject our request.
    const window = Math.min(rawEnd - rawStart, MAX_WINDOW_BP);
    return { start: rawStart, end: rawStart + window };
  }, [center]);

  const regionQuery = useManhattanRegion(runId, chrom, start, end);
  const genesQuery = useGencodeGenes(chrom, start, end);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const variants: RegionVariant[] = regionQuery.data?.variants ?? [];
  const genes = genesQuery.data?.genes ?? [];

  // Shared x-scale — passed to GeneTrack below so gene rects align with the
  // Canvas SNP dots drawn here.
  const xScale = useMemo(
    () => d3.scaleLinear().domain([start, end]).range([0, width]),
    [start, end, width],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;

    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, CANVAS_HEIGHT);

    if (variants.length === 0) return;

    const negLogPs = variants.map((v) =>
      v.p_value > 0 ? -Math.log10(v.p_value) : 0,
    );
    const yMax = Math.max(10, ...negLogPs);
    const yScale = d3
      .scaleLinear()
      .domain([0, yMax])
      .range([CANVAS_HEIGHT - 10, 10]);

    // Genome-wide significance reference line (monochrome teal per D-09).
    ctx.strokeStyle = "#9B1B30";
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    const gwsY = yScale(-Math.log10(5e-8));
    ctx.moveTo(0, gwsY);
    ctx.lineTo(width, gwsY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#2DD4BF";
    for (let i = 0; i < variants.length; i += 1) {
      const v = variants[i];
      const x = xScale(v.pos);
      const y = yScale(negLogPs[i]);
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, [variants, width, xScale]);

  const isLoading = regionQuery.isLoading || genesQuery.isLoading;
  const axisLabel = `chr${chrom}: ${start.toLocaleString()}\u2013${end.toLocaleString()}`;

  return (
    <section
      className="rounded-lg border border-border bg-surface p-4"
      aria-label="Regional view"
      data-testid="regional-view"
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Regional view</h2>
          <p
            className="font-mono text-xs text-text-muted"
            data-testid="regional-axis-label"
          >
            {axisLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-border px-2 py-1 text-xs text-text-muted hover:text-text-primary"
          aria-label="Close regional view"
        >
          Close
        </button>
      </header>

      {isLoading ? (
        <p
          className="py-6 text-center text-sm text-text-muted"
          data-testid="regional-loading"
        >
          Loading region…
        </p>
      ) : (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Regional variants scatter: ${variants.length} variants in window ${axisLabel}`}
            data-testid="regional-canvas"
          />
          <LegendBand />
          <GeneTrack
            genes={genes}
            chromStart={start}
            chromEnd={end}
            width={width}
          />
        </div>
      )}
    </section>
  );
}
