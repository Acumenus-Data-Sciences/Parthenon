// Phase 16 (Plan 16-04) — refactored to delegate Canvas+d3 draw loop to
// `useManhattanCanvas` hook. Catalog-upload consumers (legacy) still pass
// `data: Array<{chr, pos, p}>` — `prepareData()` converts to PreparedPoint[].
// Live GWAS-run consumers (FinnGenManhattanPanel) may pass `negLogP` directly
// to skip re-computation, and set `preThinned` to bypass the 500k filter.
//
// Backward-compat contract: default export preserved for existing catalog
// consumers (GenomicPanel.tsx). Named export added for new callers per
// global named-exports convention.
import { useMemo, useRef, type MouseEvent } from "react";
import type { ScaleLinear } from "d3";
import { useThemeStore } from "@/stores/themeStore";
import {
  MANHATTAN_MARGIN,
  useManhattanCanvas,
  type ChromosomeBoundary,
  type PreparedPoint,
} from "./useManhattanCanvas";

export interface ManhattanPlotDataItem {
  chr: string;
  pos: number;
  p: number;
  /**
   * Optional pre-computed `-log10(p)`. When provided, `prepareData` skips the
   * Math.log10 step for this item. Phase 16 live GWAS-run consumers pass
   * `neg_log_p` from the server to avoid redundant CPU work at 100k+ points.
   */
  negLogP?: number;
}

export interface ManhattanPlotProps {
  data: ManhattanPlotDataItem[];
  significanceThreshold?: number;
  suggestiveThreshold?: number;
  width?: number;
  height?: number;
  /**
   * Legacy catalog-upload callback. Signature preserved for backward compat
   * with `GenomicPanel.tsx`. New consumers should prefer `onPointClick`, which
   * exposes the full PreparedPoint (including negLogP) for drawer wiring.
   */
  onLocusClick?: (chr: string, pos: number) => void;
  /** Receives the nearest PreparedPoint (≤5px canvas hit). Phase 16 peak-drawer entry. */
  onPointClick?: (point: PreparedPoint) => void;
  /**
   * Bypass the client-side `negLogP < 1` thinning filter. Set to `true` when
   * the payload has already been thinned server-side (Phase 16 /manhattan
   * endpoint). Default `false` preserves legacy catalog-upload behavior.
   */
  preThinned?: boolean;
}

// Chromosome order: 1–22, X=23, Y=24
function chrToNum(chr: string): number {
  const s = chr.replace(/^chr/i, "");
  if (s === "X") return 23;
  if (s === "Y") return 24;
  const n = parseInt(s, 10);
  return isNaN(n) ? 25 : n;
}

/**
 * Transform consumer-provided data into PreparedPoint[] with cumulative
 * positions. Uses the item's `negLogP` when provided (Phase 16 fast path)
 * or computes it from `p` (legacy catalog-upload path).
 */
function prepareData(raw: ManhattanPlotDataItem[]): {
  points: PreparedPoint[];
  chrBoundaries: Map<number, ChromosomeBoundary>;
} {
  const sorted = [...raw].sort((a, b) => {
    const ca = chrToNum(a.chr);
    const cb = chrToNum(b.chr);
    if (ca !== cb) return ca - cb;
    return a.pos - b.pos;
  });

  const chrMaxPos = new Map<number, number>();
  for (const d of sorted) {
    const cn = chrToNum(d.chr);
    const cur = chrMaxPos.get(cn) ?? 0;
    if (d.pos > cur) chrMaxPos.set(cn, d.pos);
  }

  const chrNums = Array.from(chrMaxPos.keys()).sort((a, b) => a - b);

  const chrOffset = new Map<number, number>();
  const chrBoundaries = new Map<number, ChromosomeBoundary>();
  let cumulative = 0;
  const GAP = 2_000_000;
  for (const cn of chrNums) {
    const len = (chrMaxPos.get(cn) ?? 1) + GAP;
    chrOffset.set(cn, cumulative);
    chrBoundaries.set(cn, {
      start: cumulative,
      end: cumulative + len,
      mid: cumulative + len / 2,
    });
    cumulative += len;
  }

  const points: PreparedPoint[] = sorted.map((d) => {
    const cn = chrToNum(d.chr);
    const offset = chrOffset.get(cn) ?? 0;
    const p = Math.max(d.p, 1e-300);
    const negLogP =
      typeof d.negLogP === "number" && isFinite(d.negLogP)
        ? d.negLogP
        : -Math.log10(p);
    return {
      chr: d.chr,
      chrNum: cn,
      pos: d.pos,
      p,
      negLogP,
      cumPos: offset + d.pos,
    };
  });

  return { points, chrBoundaries };
}

function formatPForAria(p: number): string {
  if (!isFinite(p)) return "n/a";
  if (p === 0) return "<1e-300";
  return p.toExponential(2);
}

export function ManhattanPlot({
  data,
  significanceThreshold = 5e-8,
  suggestiveThreshold = 1e-5,
  width = 800,
  height = 400,
  onLocusClick,
  onPointClick,
  preThinned = false,
}: ManhattanPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useThemeStore((state) => state.theme);
  const pointsRef = useRef<PreparedPoint[]>([]);
  const xScaleRef = useRef<ScaleLinear<number, number> | null>(null);
  const yScaleRef = useRef<ScaleLinear<number, number> | null>(null);

  const { points, chrBoundaries } = useMemo(() => prepareData(data), [data]);

  // A11y floor (Q9 RESOLVED): describe the plot contents for screen readers.
  // Computed once per data change; Canvas itself is non-interactive for AT.
  const ariaLabel = useMemo(() => {
    if (points.length === 0) return "Manhattan plot: no variants";
    const sigLine = -Math.log10(significanceThreshold);
    let gwsCount = 0;
    let top: PreparedPoint | null = null;
    for (const pt of points) {
      if (pt.negLogP >= sigLine) gwsCount += 1;
      if (!top || pt.negLogP > top.negLogP) top = pt;
    }
    const topStr = top
      ? `top peak at chr${top.chr}:${top.pos.toLocaleString()}, p=${formatPForAria(top.p)}`
      : "no peaks";
    return `Manhattan plot: ${points.length.toLocaleString()} variants, ${gwsCount.toLocaleString()} genome-wide significant, ${topStr}`;
  }, [points, significanceThreshold]);

  useManhattanCanvas(
    {
      canvasRef,
      points,
      chrBoundaries,
      width,
      height,
      significanceThreshold,
      suggestiveThreshold,
      preThinned,
      themeKey: theme,
    },
    { pointsRef, xScaleRef, yScaleRef },
  );

  function handleCanvasClick(e: MouseEvent<HTMLCanvasElement>) {
    if (!onLocusClick && !onPointClick) return;
    if (pointsRef.current.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left - MANHATTAN_MARGIN.left;
    const py = e.clientY - rect.top - MANHATTAN_MARGIN.top;

    const xScale = xScaleRef.current;
    const yScale = yScaleRef.current;
    if (!xScale || !yScale) return;

    let closest: PreparedPoint | null = null;
    let minDist = Infinity;

    for (const pt of pointsRef.current) {
      const cx = xScale(pt.cumPos);
      const cy = yScale(pt.negLogP);
      const dist = Math.hypot(cx - px, cy - py);
      if (dist < minDist) {
        minDist = dist;
        closest = pt;
      }
    }

    if (closest && minDist <= 5) {
      onPointClick?.(closest);
      onLocusClick?.(closest.chr, closest.pos);
    }
  }

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-ghost text-sm rounded border border-border-default"
        style={{ width, height }}
        role="img"
        aria-label="Manhattan plot: no GWAS data available"
      >
        No GWAS data available
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      role="img"
      aria-label={ariaLabel}
      style={{
        cursor: onLocusClick || onPointClick ? "crosshair" : "default",
        display: "block",
      }}
    />
  );
}

export default ManhattanPlot;
