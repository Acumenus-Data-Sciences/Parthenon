import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useThemeStore } from "@/stores/themeStore";

export interface ManhattanPlotProps {
  data: Array<{ chr: string; pos: number; p: number }>;
  significanceThreshold?: number;
  suggestiveThreshold?: number;
  width?: number;
  height?: number;
  onLocusClick?: (chr: string, pos: number) => void;
}

const MARGIN = { top: 30, right: 30, bottom: 50, left: 60 };

function themeColor(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  return styles.getPropertyValue(name).trim() || fallback;
}

// Chromosome order: 1–22, X=23, Y=24
function chrToNum(chr: string): number {
  const s = chr.replace(/^chr/i, "");
  if (s === "X") return 23;
  if (s === "Y") return 24;
  const n = parseInt(s, 10);
  return isNaN(n) ? 25 : n;
}

function chrLabel(num: number): string {
  if (num === 23) return "X";
  if (num === 24) return "Y";
  return String(num);
}

interface PreparedPoint {
  chr: string;
  chrNum: number;
  pos: number;
  p: number;
  negLogP: number;
  cumPos: number;
}

function prepareData(
  raw: Array<{ chr: string; pos: number; p: number }>,
): { points: PreparedPoint[]; chrBoundaries: Map<number, { start: number; end: number; mid: number }> } {
  // Sort by chromosome then position
  const sorted = [...raw].sort((a, b) => {
    const ca = chrToNum(a.chr);
    const cb = chrToNum(b.chr);
    if (ca !== cb) return ca - cb;
    return a.pos - b.pos;
  });

  // Compute per-chromosome max position
  const chrMaxPos = new Map<number, number>();
  for (const d of sorted) {
    const cn = chrToNum(d.chr);
    const cur = chrMaxPos.get(cn) ?? 0;
    if (d.pos > cur) chrMaxPos.set(cn, d.pos);
  }

  // Sorted unique chromosome numbers
  const chrNums = Array.from(chrMaxPos.keys()).sort((a, b) => a - b);

  // Cumulative offsets per chromosome
  const chrOffset = new Map<number, number>();
  const chrBoundaries = new Map<number, { start: number; end: number; mid: number }>();
  let cumulative = 0;
  const GAP = 2_000_000; // small gap between chromosomes
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
    const p = Math.max(d.p, 1e-300); // guard against log(0)
    return {
      chr: d.chr,
      chrNum: cn,
      pos: d.pos,
      p,
      negLogP: -Math.log10(p),
      cumPos: offset + d.pos,
    };
  });

  return { points, chrBoundaries };
}

export default function ManhattanPlot({
  data,
  significanceThreshold = 5e-8,
  suggestiveThreshold = 1e-5,
  width = 800,
  height = 400,
  onLocusClick,
}: ManhattanPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useThemeStore((state) => state.theme);
  // Store prepared data for click handling
  const pointsRef = useRef<PreparedPoint[]>([]);
  const xScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null);
  const yScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotHeight = height - MARGIN.top - MARGIN.bottom;
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

    // --- Data preparation ---
    const { points: allPoints, chrBoundaries } = prepareData(data);

    // Performance thinning: for large datasets, skip non-significant low points
    let points = allPoints;
    if (allPoints.length > 500_000) {
      points = allPoints.filter((d) => d.negLogP >= 1);
    }
    pointsRef.current = points;

    const sigLine = -Math.log10(significanceThreshold);
    const sugLine = -Math.log10(suggestiveThreshold);
    const maxNegLogP = Math.max(d3.max(points, (d) => d.negLogP) ?? sigLine + 2, sigLine + 2);

    // Cumulative total length
    const chrNums = Array.from(chrBoundaries.keys()).sort((a, b) => a - b);
    const totalCumLen = chrBoundaries.get(chrNums[chrNums.length - 1])?.end ?? 1;

    const xScale = d3.scaleLinear().domain([0, totalCumLen]).range([0, plotWidth]);
    const yScale = d3.scaleLinear().domain([0, maxNegLogP * 1.05]).range([plotHeight, 0]);
    xScaleRef.current = xScale;
    yScaleRef.current = yScale;

    // --- Clear & background ---
    ctx.fillStyle = colorBg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(MARGIN.left, MARGIN.top);

    // --- Chromosome separators and labels ---
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = colorMuted;

    for (const cn of chrNums) {
      const bnd = chrBoundaries.get(cn)!;
      const xStart = xScale(bnd.start);
      const xEnd = xScale(bnd.end);
      const xMid = xScale(bnd.mid);

      // Alternate band shading
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

      // Chromosome label below x-axis
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

    // --- Significance threshold line (crimson, dashed) ---
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

    // X-axis label
    ctx.textAlign = "center";
    ctx.font = "11px sans-serif";
    ctx.fillStyle = colorText;
    ctx.fillText("Chromosome", plotWidth / 2, plotHeight + 36);

    ctx.restore();
  }, [data, significanceThreshold, suggestiveThreshold, width, height, theme]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!onLocusClick || pointsRef.current.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left - MARGIN.left;
    const py = e.clientY - rect.top - MARGIN.top;

    const xScale = xScaleRef.current;
    const yScale = yScaleRef.current;
    if (!xScale || !yScale) return;

    // Find nearest point within 5px (canvas coordinates)
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
      onLocusClick(closest.chr, closest.pos);
    }
  }

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-ghost text-sm rounded border border-border-default"
        style={{ width, height }}
      >
        No GWAS data available
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      style={{ cursor: onLocusClick ? "crosshair" : "default", display: "block" }}
    />
  );
}
