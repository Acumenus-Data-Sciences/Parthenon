import { useEffect, useRef } from "react";
import * as d3 from "d3";

export interface VennCircle {
  id: number;
  label: string;
  count: number;
  color: string;
}

export interface VennDiagramProps {
  circles: VennCircle[];
  operation: "union" | "intersect" | "subtract";
  resultCount?: number;
  width?: number;
  height?: number;
}

const DEFAULT_COLORS = ["var(--success)", "var(--primary)", "var(--accent)"];
const TEXT_COLOR = "#d4d4d8";
const STROKE_COLOR = "#52525b";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

interface CircleLayout {
  cx: number;
  cy: number;
  r: number;
  color: string;
  label: string;
  count: number;
}

export default function VennDiagram({
  circles,
  operation,
  resultCount,
  width = 400,
  height = 300,
}: VennDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width)
      .attr("height", height);

    const defs = svg.append("defs");

    const count = circles.length;
    if (count < 2 || count > 3) return;

    // Build circle layouts
    const layouts: CircleLayout[] = [];

    if (count === 2) {
      const r = Math.min(width, height) * 0.32;
      const offset = r * 0.6;
      const cy = height / 2;
      const cx1 = width / 2 - offset / 2;
      const cx2 = width / 2 + offset / 2;

      layouts.push({
        cx: cx1,
        cy,
        r,
        color: circles[0].color || DEFAULT_COLORS[0],
        label: circles[0].label,
        count: circles[0].count,
      });
      layouts.push({
        cx: cx2,
        cy,
        r,
        color: circles[1].color || DEFAULT_COLORS[1],
        label: circles[1].label,
        count: circles[1].count,
      });
    } else {
      // 3 circles in equilateral triangle arrangement
      const r = Math.min(width, height) * 0.28;
      const triangleR = r * 0.65;
      const centerX = width / 2;
      const centerY = height / 2 + r * 0.05;

      const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
      angles.forEach((angle, i) => {
        layouts.push({
          cx: centerX + triangleR * Math.cos(angle),
          cy: centerY + triangleR * Math.sin(angle),
          r,
          color: circles[i].color || DEFAULT_COLORS[i],
          label: circles[i].label,
          count: circles[i].count,
        });
      });
    }

    // Clip paths for operation highlighting
    // We create clip paths to carve out intersection regions

    // Draw base circles with low opacity
    const baseOpacity = 0.25;
    layouts.forEach((layout, i) => {
      svg
        .append("circle")
        .attr("cx", layout.cx)
        .attr("cy", layout.cy)
        .attr("r", layout.r)
        .attr("fill", layout.color)
        .attr("fill-opacity", baseOpacity)
        .attr("stroke", STROKE_COLOR)
        .attr("stroke-width", 1.5);

      // Clip path for each individual circle
      defs
        .append("clipPath")
        .attr("id", `venn-clip-${i}`)
        .append("circle")
        .attr("cx", layout.cx)
        .attr("cy", layout.cy)
        .attr("r", layout.r);
    });

    // Operation highlighting overlay
    const highlightOpacity = 0.5;

    if (operation === "union") {
      // Highlight all circles at higher opacity
      layouts.forEach((layout) => {
        svg
          .append("circle")
          .attr("cx", layout.cx)
          .attr("cy", layout.cy)
          .attr("r", layout.r)
          .attr("fill", layout.color)
          .attr("fill-opacity", highlightOpacity - baseOpacity)
          .attr("stroke", "none");
      });
    } else if (operation === "intersect") {
      // Highlight center overlap region
      // For 2 circles: draw second circle clipped to first
      if (count === 2) {
        svg
          .append("circle")
          .attr("cx", layouts[1].cx)
          .attr("cy", layouts[1].cy)
          .attr("r", layouts[1].r)
          .attr("fill", "#ffffff")
          .attr("fill-opacity", 0.25)
          .attr("stroke", "none")
          .attr("clip-path", "url(#venn-clip-0)");
      } else {
        // For 3 circles: clip third circle to intersection of first two
        // We use nested clipping approach with a group
        const g = svg.append("g").attr("clip-path", "url(#venn-clip-0)");
        const g2 = g.append("g").attr("clip-path", "url(#venn-clip-1)");
        g2
          .append("circle")
          .attr("cx", layouts[2].cx)
          .attr("cy", layouts[2].cy)
          .attr("r", layouts[2].r)
          .attr("fill", "#ffffff")
          .attr("fill-opacity", 0.35)
          .attr("stroke", "none");
      }
    } else if (operation === "subtract") {
      // Highlight first circle minus the overlap
      // Draw first circle, clipped to exclude subsequent circles
      // We draw a highlight circle for circle 0, then overdraw the overlap areas with base color

      // Highlight circle 0 at higher opacity
      svg
        .append("circle")
        .attr("cx", layouts[0].cx)
        .attr("cy", layouts[0].cy)
        .attr("r", layouts[0].r)
        .attr("fill", layouts[0].color)
        .attr("fill-opacity", highlightOpacity - baseOpacity)
        .attr("stroke", "none");

      // Re-draw overlapping portions of other circles to cancel out the highlight
      for (let i = 1; i < layouts.length; i++) {
        svg
          .append("circle")
          .attr("cx", layouts[i].cx)
          .attr("cy", layouts[i].cy)
          .attr("r", layouts[i].r)
          .attr("fill", layouts[0].color)
          .attr("fill-opacity", -(highlightOpacity - baseOpacity) + baseOpacity * 0.5)
          .attr("stroke", "none")
          .attr("clip-path", `url(#venn-clip-0)`);
      }
    }

    // Circle strokes on top (redraw for clean borders)
    layouts.forEach((layout) => {
      svg
        .append("circle")
        .attr("cx", layout.cx)
        .attr("cy", layout.cy)
        .attr("r", layout.r)
        .attr("fill", "none")
        .attr("stroke", STROKE_COLOR)
        .attr("stroke-width", 1.5);
    });

    // Labels below each circle
    layouts.forEach((layout, i) => {
      const labelY = layout.cy + layout.r + 18;
      const anchor = count === 2 ? (i === 0 ? "end" : "start") : "middle";
      const labelX =
        count === 2
          ? i === 0
            ? layout.cx - layout.r * 0.1
            : layout.cx + layout.r * 0.1
          : layout.cx;

      svg
        .append("text")
        .attr("x", labelX)
        .attr("y", labelY)
        .attr("text-anchor", anchor)
        .attr("dominant-baseline", "hanging")
        .attr("font-size", "11px")
        .attr("font-family", "sans-serif")
        .attr("fill", TEXT_COLOR)
        .text(layout.label);

      svg
        .append("text")
        .attr("x", labelX)
        .attr("y", labelY + 14)
        .attr("text-anchor", anchor)
        .attr("dominant-baseline", "hanging")
        .attr("font-size", "10px")
        .attr("font-family", "sans-serif")
        .attr("fill", "#a1a1aa")
        .text(`n=${formatCount(layout.count)}`);
    });

    // Result count in center overlap region
    if (resultCount !== undefined) {
      let resultX = width / 2;
      let resultY = height / 2;

      if (operation === "intersect" && count === 2) {
        resultX = (layouts[0].cx + layouts[1].cx) / 2;
        resultY = height / 2;
      } else if (operation === "subtract") {
        // Leftward in the first circle, away from overlap
        resultX = layouts[0].cx - layouts[0].r * 0.45;
        resultY = height / 2;
      }

      svg
        .append("text")
        .attr("x", resultX)
        .attr("y", resultY - 8)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size", "18px")
        .attr("font-weight", "bold")
        .attr("font-family", "sans-serif")
        .attr("fill", "#ffffff")
        .text(formatCount(resultCount));

      svg
        .append("text")
        .attr("x", resultX)
        .attr("y", resultY + 12)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("font-size", "9px")
        .attr("font-family", "sans-serif")
        .attr("fill", "#a1a1aa")
        .text("result");
    }
  }, [circles, operation, resultCount, width, height]);

  return <svg ref={svgRef} className="overflow-visible" />;
}
