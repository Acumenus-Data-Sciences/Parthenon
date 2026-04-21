import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useTranslation } from "react-i18next";
import type { AttritionStep } from "../../types";

interface AttritionFunnelProps {
  steps: AttritionStep[];
  totalLabel?: string;
}

const MARGIN = { top: 20, right: 80, bottom: 20, left: 180 };
const BAR_HEIGHT = 34;
const GAP = 50;

export default function AttritionFunnel({
  steps,
  totalLabel,
}: AttritionFunnelProps) {
  const { t } = useTranslation("app");
  const svgRef = useRef<SVGSVGElement>(null);
  const resolvedTotalLabel =
    totalLabel ?? t("investigation.phenotype.attrition.totalPopulation");

  useEffect(() => {
    if (!svgRef.current || steps.length === 0) return;

    const width = svgRef.current.getBoundingClientRect().width || 600;
    const plotWidth = width - MARGIN.left - MARGIN.right;
    const computedHeight =
      MARGIN.top + steps.length * (BAR_HEIGHT + GAP) - GAP + MARGIN.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg
      .attr("viewBox", `0 0 ${width} ${computedHeight}`)
      .attr("width", "100%")
      .attr("height", computedHeight);

    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const maxCount = steps[0]?.count ?? 1;

    const xScale = d3
      .scaleLinear()
      .domain([0, maxCount])
      .range([0, plotWidth]);

    steps.forEach((step, i) => {
      const yOffset = i * (BAR_HEIGHT + GAP);
      const barWidth = Math.max(xScale(step.count), 4);
      const excluded =
        i < steps.length - 1 ? step.count - steps[i + 1].count : 0;

      // Left label
      g.append("text")
        .attr("x", -10)
        .attr("y", yOffset + BAR_HEIGHT / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "central")
        .attr("font-size", "11px")
        .attr("fill", "var(--text-primary)")
        .attr("font-family", "sans-serif")
        .text(i === 0 ? resolvedTotalLabel : step.label);

      // Bar background track
      g.append("rect")
        .attr("x", 0)
        .attr("y", yOffset)
        .attr("width", plotWidth)
        .attr("height", BAR_HEIGHT)
        .attr("rx", 4)
        .attr("fill", "var(--surface-overlay)")
        .attr("opacity", 0.6);

      // Filled bar (teal)
      g.append("rect")
        .attr("x", 0)
        .attr("y", yOffset)
        .attr("width", barWidth)
        .attr("height", BAR_HEIGHT)
        .attr("rx", 4)
        .attr("fill", "var(--success)"); // teal

      // Count text inside or right of bar
      const countLabel = t("investigation.phenotype.attrition.countLabel", {
        count: step.count.toLocaleString(),
      });
      const textX = barWidth + 8;
      g.append("text")
        .attr("x", textX)
        .attr("y", yOffset + BAR_HEIGHT / 2)
        .attr("dominant-baseline", "central")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", "var(--text-primary)")
        .attr("font-family", "sans-serif")
        .text(countLabel);

      // Percent badge (right margin)
      g.append("text")
        .attr("x", plotWidth + 6)
        .attr("y", yOffset + BAR_HEIGHT / 2)
        .attr("dominant-baseline", "central")
        .attr("font-size", "10px")
        .attr("fill", "var(--text-muted)")
        .attr("font-family", "sans-serif")
        .text(`${step.percent.toFixed(1)}%`);

      // Connector and exclusion annotation between bars
      if (i < steps.length - 1) {
        const connY1 = yOffset + BAR_HEIGHT + 2;
        const connY2 = yOffset + BAR_HEIGHT + GAP - 2;
        const midY = (connY1 + connY2) / 2;
        const midX = barWidth / 2;

        g.append("line")
          .attr("x1", midX)
          .attr("x2", midX)
          .attr("y1", connY1)
          .attr("y2", connY2)
          .attr("stroke", "var(--border-default)")
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "4,3");

        // Exclusion annotation
        if (excluded > 0) {
          // Horizontal tick to the right
          g.append("line")
            .attr("x1", midX)
            .attr("x2", midX + 60)
            .attr("y1", midY)
            .attr("y2", midY)
            .attr("stroke", "var(--primary)") // crimson
            .attr("stroke-width", 1);

          // Excluded label
          g.append("text")
            .attr("x", midX + 64)
            .attr("y", midY)
            .attr("dominant-baseline", "central")
            .attr("font-size", "10px")
            .attr("fill", "var(--primary)") // crimson
            .attr("font-family", "sans-serif")
            .text(
              `−${t("investigation.phenotype.attrition.excluded", {
                count: excluded.toLocaleString(),
              })}`,
            );
        }
      }
    });
  }, [resolvedTotalLabel, steps, t]);

  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-text-ghost text-sm">
        {t("investigation.phenotype.attrition.noData")}
      </div>
    );
  }

  return (
    <div className="w-full">
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}
