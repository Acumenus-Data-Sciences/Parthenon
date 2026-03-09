import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface ConsortDiagramProps {
  enrollment: { assessed: number; excluded?: number; reasons?: string[] };
  allocated: Array<{ group: string; count: number }>;
  followUp?: Array<{ group: string; completed: number; lost?: number }>;
  analyzed?: Array<{ group: string; count: number; excluded?: number }>;
  width?: number;
  height?: number;
}

const BOX_W = 180;
const BOX_H = 50;
const BOX_RX = 4;
const FONT_SIZE = 11;
const SMALL_FONT = 9;
const V_GAP = 50;

function wrapText(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  lines: string[],
  cx: number,
  cy: number,
  fontSize: number,
  bold = false,
) {
  const totalH = lines.length * (fontSize + 2);
  const startY = cy - totalH / 2 + fontSize / 2;

  lines.forEach((line, i) => {
    g.append("text")
      .attr("x", cx)
      .attr("y", startY + i * (fontSize + 2))
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", `${fontSize}px`)
      .attr("font-weight", bold && i === 0 ? "bold" : "normal")
      .attr("fill", "#333")
      .attr("font-family", "sans-serif")
      .text(line);
  });
}

function drawBox(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  g.append("rect")
    .attr("x", x - w / 2)
    .attr("y", y - h / 2)
    .attr("width", w)
    .attr("height", h)
    .attr("rx", BOX_RX)
    .attr("fill", "#ffffff")
    .attr("stroke", "#333")
    .attr("stroke-width", 1.5);
}

function drawArrow(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  markerId: string,
) {
  g.append("line")
    .attr("x1", x1)
    .attr("y1", y1)
    .attr("x2", x2)
    .attr("y2", y2)
    .attr("stroke", "#333")
    .attr("stroke-width", 1.5)
    .attr("marker-end", `url(#${markerId})`);
}

export default function ConsortDiagram({
  enrollment,
  allocated,
  followUp,
  analyzed,
  width = 700,
  height = 500,
}: ConsortDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width)
      .attr("height", height);

    // White background
    svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#ffffff");

    // Arrowhead marker
    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "consort-arrow")
      .attr("viewBox", "0 0 10 7")
      .attr("refX", 10)
      .attr("refY", 3.5)
      .attr("markerWidth", 8)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("polygon")
      .attr("points", "0 0, 10 3.5, 0 7")
      .attr("fill", "#333");

    const g = svg.append("g");
    const cx = width / 2;

    // Determine rows
    const hasExcluded = enrollment.excluded != null && enrollment.excluded > 0;
    const numGroups = allocated.length;

    // Row Y positions
    let currentY = 40;

    // === Row 1: Enrollment ===
    const enrollY = currentY;
    const enrollBoxH = BOX_H;
    drawBox(g, cx, enrollY, BOX_W + 40, enrollBoxH);
    wrapText(g, [
      "Assessed for eligibility",
      `(n = ${enrollment.assessed.toLocaleString()})`,
    ], cx, enrollY, FONT_SIZE, true);

    currentY += enrollBoxH / 2 + V_GAP;

    // === Exclusion box (to the right) ===
    if (hasExcluded) {
      const exclX = cx + BOX_W / 2 + 100;
      const exclY = enrollY + enrollBoxH / 2 + V_GAP / 2;
      const reasons = enrollment.reasons ?? [];
      const exclLines = [
        `Excluded (n = ${enrollment.excluded?.toLocaleString()})`,
        ...reasons.map((r) => `- ${r}`),
      ];
      const exclBoxH = Math.max(BOX_H, exclLines.length * 14 + 16);

      drawBox(g, exclX, exclY, BOX_W + 20, exclBoxH);
      wrapText(g, exclLines, exclX, exclY, SMALL_FONT);

      // Horizontal arrow from main flow to exclusion box
      drawArrow(g, cx, enrollY + enrollBoxH / 2, cx, exclY, "");
      drawArrow(g, cx, exclY, exclX - (BOX_W + 20) / 2 - 2, exclY, "consort-arrow");
    }

    // === Row 2: Allocation ===
    const allocY = currentY;
    const totalGroupWidth = numGroups * (BOX_W + 20);
    const groupSpacing = totalGroupWidth / numGroups;
    const groupStartX = cx - (totalGroupWidth - groupSpacing) / 2;

    // Arrow down from enrollment to allocation level
    drawArrow(g, cx, enrollY + enrollBoxH / 2, cx, allocY - BOX_H / 2 - 10, "");

    // Horizontal distribution line
    if (numGroups > 1) {
      const leftX = groupStartX;
      const rightX = groupStartX + (numGroups - 1) * groupSpacing;
      g.append("line")
        .attr("x1", leftX)
        .attr("x2", rightX)
        .attr("y1", allocY - BOX_H / 2 - 10)
        .attr("y2", allocY - BOX_H / 2 - 10)
        .attr("stroke", "#333")
        .attr("stroke-width", 1.5);
    }

    const groupXPositions: number[] = [];

    allocated.forEach((grp, i) => {
      const gx = groupStartX + i * groupSpacing;
      groupXPositions.push(gx);

      // Arrow down to box
      drawArrow(g, gx, allocY - BOX_H / 2 - 10, gx, allocY - BOX_H / 2 - 2, "consort-arrow");

      drawBox(g, gx, allocY, BOX_W, BOX_H);
      wrapText(g, [
        `Allocated to ${grp.group}`,
        `(n = ${grp.count.toLocaleString()})`,
      ], gx, allocY, FONT_SIZE, true);
    });

    currentY = allocY + BOX_H / 2 + V_GAP;

    // === Row 3: Follow-up (optional) ===
    if (followUp && followUp.length > 0) {
      const fuY = currentY;

      followUp.forEach((fu, i) => {
        const gx = groupXPositions[i] ?? groupStartX + i * groupSpacing;

        drawArrow(g, gx, fuY - V_GAP + BOX_H / 2, gx, fuY - BOX_H / 2 - 2, "consort-arrow");

        const fuLines = [
          `Follow-up: ${fu.group}`,
          `Completed: ${fu.completed.toLocaleString()}`,
        ];
        if (fu.lost != null && fu.lost > 0) {
          fuLines.push(`Lost: ${fu.lost.toLocaleString()}`);
        }
        const fuBoxH = Math.max(BOX_H, fuLines.length * 14 + 12);

        drawBox(g, gx, fuY, BOX_W, fuBoxH);
        wrapText(g, fuLines, gx, fuY, FONT_SIZE);
      });

      currentY = fuY + BOX_H / 2 + V_GAP;
    }

    // === Row 4: Analysis (optional) ===
    if (analyzed && analyzed.length > 0) {
      const anaY = currentY;

      analyzed.forEach((an, i) => {
        const gx = groupXPositions[i] ?? groupStartX + i * groupSpacing;

        drawArrow(g, gx, anaY - V_GAP + BOX_H / 2, gx, anaY - BOX_H / 2 - 2, "consort-arrow");

        const anaLines = [
          `Analyzed: ${an.group}`,
          `(n = ${an.count.toLocaleString()})`,
        ];
        if (an.excluded != null && an.excluded > 0) {
          anaLines.push(`Excluded: ${an.excluded.toLocaleString()}`);
        }
        const anaBoxH = Math.max(BOX_H, anaLines.length * 14 + 12);

        drawBox(g, gx, anaY, BOX_W, anaBoxH);
        wrapText(g, anaLines, gx, anaY, FONT_SIZE);
      });
    }
  }, [enrollment, allocated, followUp, analyzed, width, height]);

  return <svg ref={svgRef} />;
}
