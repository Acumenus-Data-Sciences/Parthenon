// Phase 16 (Plan 16-04) — Reusable Canvas + d3 draw hook extracted from
// ManhattanPlot.tsx's useEffect (L114-311). Consumed by:
//   1. `ManhattanPlot.tsx` (catalog-upload path; prop-driven from uploaded GWAS files)
//   2. `FinnGenManhattanPanel.tsx` (live GWAS-run path via /finngen/runs/{id}/manhattan)
//
// Both consumers reshape their input into `PreparedPoint[]` and pass via `points`.
// `preThinned` bypasses the client-side `negLogP >= 1` filter for server-thinned
// payloads (Pitfall 4 from RESEARCH §Common Pitfalls).
//
// Q9 RESOLVED (a11y floor): consumers set role=img + aria-label on the <canvas>
// element; this hook only handles drawing + scale-ref hydration for click-hit.
import { useEffect, type RefObject } from "react";
import * as d3 from "d3";

export interface PreparedPoint {
  chr: string;
  chrNum: number;
  pos: number;
  p: number;
  negLogP: number;
  cumPos: number;
}

export interface ChromosomeBoundary {
  start: number;
  end: number;
  mid: number;
}

export interface ManhattanCanvasOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Prepared points with cumulative-position layout already applied. */
  points: PreparedPoint[];
  /** Per-chromosome cumulative boundaries for axis + band rendering. */
  chrBoundaries: Map<number, ChromosomeBoundary>;
  /** Plot width in CSS px (DPR scaling handled internally). */
  width: number;
  /** Plot height in CSS px. */
  height: number;
  /** Genome-wide significance threshold (p-value). Default 5e-8. */
  significanceThreshold?: number;
  /** Suggestive threshold (p-value). Default 1e-5. */
  suggestiveThreshold?: number;
  /**
   * When true, bypass the client-side `negLogP >= 1` filter. Set to `true` for
   * server-thinned payloads (Phase 16 /finngen/runs/{id}/manhattan). Default false
   * preserves legacy catalog-upload behavior where raw 10M-SNP inputs are allowed.
   */
  preThinned?: boolean;
  /** Theme key ("dark" | "light") — forces re-paint on theme change. */
  themeKey: string;
}

/**
 * Stable refs exposed to the consumer so click-hit detection can translate
 * mouse coordinates → nearest PreparedPoint WITHOUT re-running the draw loop.
 * Consumer calls `storeHitTestRefs` inside the draw effect so refs stay in sync
 * with the most recent layout.
 */
export interface ManhattanHitTestRefs {
  pointsRef: RefObject<PreparedPoint[]>;
  xScaleRef: RefObject<d3.ScaleLinear<number, number> | null>;
  yScaleRef: RefObject<d3.ScaleLinear<number, number> | null>;
}

export const MANHATTAN_MARGIN = {
  top: 30,
  right: 30,
  bottom: 50,
  left: 60,
} as const;

function themeColor(
  styles: CSSStyleDeclaration,
  name: string,
  fallback: string,
): string {
  return styles.getPropertyValue(name).trim() || fallback;
}

function chrLabel(num: number): string {
  if (num === 23) return "X";
  if (num === 24) return "Y";
  return String(num);
}

/**
 * Run the Canvas + d3 draw loop whenever inputs change.
 *
 * Side-effects:
 *  - Writes to `canvasRef.current` (width/height/scale + draw calls).
 *  - Hydrates `hitTestRefs` with the most recent points + x/y scales so that
 *    consumer click handlers can hit-test without recomputing layout.
 */
export function useManhattanCanvas(
  opts: ManhattanCanvasOptions,
  hitTestRefs?: ManhattanHitTestRefs,
): void {
  const {
    canvasRef,
    points: inputPoints,
    chrBoundaries,
    width,
    height,
    significanceThreshold = 5e-8,
    suggestiveThreshold = 1e-5,
    preThinned = false,
    themeKey,
  } = opts;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || inputPoints.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const plotWidth = width - MANHATTAN_MARGIN.left - MANHATTAN_MARGIN.right;
    const plotHeight = height - MANHATTAN_MARGIN.top - MANHATTAN_MARGIN.bottom;
    const styles = getComputedStyle(document.documentElement);
    const colorBg = themeColor(styles, "--surface-base", "#0E0E11");
    const colorPrimary = themeColor(styles, "--primary", "#9B1B30");
    const colorAccent = themeColor(styles, "--accent", "#C9A227");
    const colorSuccess = themeColor(styles, "--success", "#2DD4BF");
    const colorText = themeColor(styles, "--text-primary", "#d4d4d8");
    const colorMuted = themeColor(styles, "--text-muted", "#71717a");
    const colorAxis = themeColor(styles, "--border-default", "#52525b");
    const colorSubtle = themeColor(styles, "--border-subtle", "#27272a");
    const colorBand = themeColor(styles, "--surface-overlay", "#1A1A1F");

    // Pitfall 4 (RESEARCH §Common Pitfalls): skip client-side thinning when
    // `preThinned=true` — server already emitted a representative set that
    // INCLUDES low-negLogP bin leaders. Filtering them here distorts the
    // visual density.
    let points = inputPoints;
    if (!preThinned && inputPoints.length > 500_000) {
      points = inputPoints.filter((d) => d.negLogP >= 1);
    }

    if (hitTestRefs) {
      hitTestRefs.pointsRef.current = points;
    }

    const sigLine = -Math.log10(significanceThreshold);
    const sugLine = -Math.log10(suggestiveThreshold);
    const maxNegLogP = Math.max(
      d3.max(points, (d) => d.negLogP) ?? sigLine + 2,
      sigLine + 2,
    );

    const chrNums = Array.from(chrBoundaries.keys()).sort((a, b) => a - b);
    if (chrNums.length === 0) return;
    const totalCumLen = chrBoundaries.get(chrNums[chrNums.length - 1])?.end ?? 1;

    const xScale = d3
      .scaleLinear()
      .domain([0, totalCumLen])
      .range([0, plotWidth]);
    const yScale = d3
      .scaleLinear()
      .domain([0, maxNegLogP * 1.05])
      .range([plotHeight, 0]);

    if (hitTestRefs) {
      hitTestRefs.xScaleRef.current = xScale;
      hitTestRefs.yScaleRef.current = yScale;
    }

    // --- Clear & background ---
    ctx.fillStyle = colorBg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(MANHATTAN_MARGIN.left, MANHATTAN_MARGIN.top);

    // --- Chromosome separators and labels ---
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = colorMuted;

    for (const cn of chrNums) {
      const bnd = chrBoundaries.get(cn);
      if (!bnd) continue;
      const xStart = xScale(bnd.start);
      const xEnd = xScale(bnd.end);
      const xMid = xScale(bnd.mid);

      // Alternate band shading (D-05 visual spec)
      if (cn % 2 === 0) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = colorBand;
        ctx.fillRect(xStart, 0, xEnd - xStart, plotHeight);
        ctx.restore();
        ctx.fillStyle = colorMuted;
      }

      // Chromosome separator line (right edge of each chr)
      if (cn !== chrNums[chrNums.length - 1]) {
        ctx.beginPath();
        ctx.strokeStyle = colorSubtle;
        ctx.lineWidth = 0.5;
        ctx.moveTo(xEnd, 0);
        ctx.lineTo(xEnd, plotHeight);
        ctx.stroke();
      }

      ctx.fillStyle = colorMuted;
      ctx.fillText(chrLabel(cn), xMid, plotHeight + 18);
    }

    // --- Suggestive threshold line (gold, dashed) ---
    const ySug = yScale(sugLine);
    ctx.beginPath();
    ctx.strokeStyle = colorAccent;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.moveTo(0, ySug);
    ctx.lineTo(plotWidth, ySug);
    ctx.stroke();

    // --- Significance threshold line (crimson, dashed) — D-05 GWS at -log10(5e-8) ≈ 7.30 ---
    const ySig = yScale(sigLine);
    ctx.beginPath();
    ctx.strokeStyle = colorPrimary;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.moveTo(0, ySig);
    ctx.lineTo(plotWidth, ySig);
    ctx.stroke();

    ctx.setLineDash([]);

    // --- Data points ---
    for (const pt of points) {
      const x = xScale(pt.cumPos);
      const y = yScale(pt.negLogP);

      const aboveSig = pt.negLogP >= sigLine;
      const aboveSug = pt.negLogP >= sugLine;

      let color: string;
      if (aboveSig) {
        color = colorPrimary;
      } else if (pt.chrNum % 2 === 1) {
        color = colorSuccess;
      } else {
        color = colorMuted;
      }

      const radius = aboveSig ? 3 : aboveSug ? 2.5 : 2;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      if (aboveSig) {
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 0.75;
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // --- Y-axis ---
    const yTicks = yScale.ticks(6);
    ctx.strokeStyle = colorAxis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, plotHeight);
    ctx.stroke();

    ctx.font = "10px sans-serif";
    ctx.fillStyle = colorText;
    ctx.textAlign = "right";
    for (const tick of yTicks) {
      const ty = yScale(tick);
      ctx.beginPath();
      ctx.strokeStyle = colorAxis;
      ctx.lineWidth = 0.5;
      ctx.moveTo(-4, ty);
      ctx.lineTo(plotWidth, ty);
      ctx.stroke();

      ctx.fillStyle = colorText;
      ctx.fillText(String(tick), -8, ty + 3.5);
    }

    // Y-axis label (rotated)
    ctx.save();
    ctx.translate(-40, plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.font = "11px sans-serif";
    ctx.fillStyle = colorText;
    ctx.fillText("-log\u2081\u2080(p-value)", 0, 0);
    ctx.restore();

    // --- X-axis baseline ---
    ctx.beginPath();
    ctx.strokeStyle = colorAxis;
    ctx.lineWidth = 1;
    ctx.moveTo(0, plotHeight);
    ctx.lineTo(plotWidth, plotHeight);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.font = "11px sans-serif";
    ctx.fillStyle = colorText;
    ctx.fillText("Chromosome", plotWidth / 2, plotHeight + 36);

    ctx.restore();
  }, [
    canvasRef,
    inputPoints,
    chrBoundaries,
    width,
    height,
    significanceThreshold,
    suggestiveThreshold,
    preThinned,
    themeKey,
    hitTestRefs,
  ]);
}
