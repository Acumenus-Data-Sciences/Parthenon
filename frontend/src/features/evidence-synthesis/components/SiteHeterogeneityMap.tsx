import { useState } from "react";
import { fmt, num } from "@/lib/formatters";
import { useTranslation } from "react-i18next";

export interface HeterogeneitySite {
  site_name: string;
  hr: number;
  ci_lower: number;
  ci_upper: number;
  weight: number;
}

interface SiteHeterogeneityMapProps {
  sites: HeterogeneitySite[];
  pooledHr: number;
}

const WIDTH = 700;
const HEIGHT = 200;
const MARGIN = { left: 60, right: 30, top: 20, bottom: 40 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

function getBubbleColor(hr: number, ciLower: number, ciUpper: number): string {
  if (ciLower > 1 || ciUpper < 1) {
    // CI does not span null
    return hr < 1 ? "var(--success)" : "var(--critical)";
  }
  // CI spans null
  return "var(--text-muted)";
}

export function SiteHeterogeneityMap({ sites, pooledHr }: SiteHeterogeneityMapProps) {
  const { t } = useTranslation("app");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (sites.length === 0) return null;

  // Compute log scale range
  const allHrs = [...sites.map((s) => num(s.hr)), ...sites.map((s) => num(s.ci_lower)), ...sites.map((s) => num(s.ci_upper)), pooledHr];
  const validHrs = allHrs.filter((v) => v > 0);
  const logMin = Math.log(Math.max(Math.min(...validHrs) * 0.7, 0.01));
  const logMax = Math.log(Math.max(...validHrs) * 1.3);
  const logRange = logMax - logMin;

  const toX = (hr: number): number => {
    const logHr = Math.log(Math.max(hr, 0.01));
    return MARGIN.left + ((logHr - logMin) / logRange) * PLOT_WIDTH;
  };

  // Bubble size proportional to weight (inverse variance), clamped
  const maxWeight = Math.max(...sites.map((s) => num(s.weight)), 0.01);
  const bubbleRadius = (weight: number): number => {
    const normalized = num(weight) / maxWeight;
    return 6 + normalized * 18; // min 6px, max 24px
  };

  const centerY = MARGIN.top + PLOT_HEIGHT / 2;
  const nullX = toX(1);
  const pooledX = toX(pooledHr);

  // X-axis ticks
  const ticks = [0.25, 0.5, 1, 2, 4].filter((v) => {
    const x = toX(v);
    return x >= MARGIN.left && x <= MARGIN.left + PLOT_WIDTH;
  });

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">
        {t("analyses.auto.siteHeterogeneityMap_34e5ac")}
      </h3>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{ maxWidth: WIDTH, maxHeight: HEIGHT }}
      >
        {/* HR=1 reference line (dashed gold) */}
        <line
          x1={nullX}
          y1={MARGIN.top}
          x2={nullX}
          y2={HEIGHT - MARGIN.bottom}
          stroke="var(--accent)"
          strokeWidth={1}
          strokeDasharray="6,4"
          opacity={0.6}
        />

        {/* Pooled HR diamond marker */}
        <polygon
          points={`${pooledX},${centerY - 8} ${pooledX + 6},${centerY} ${pooledX},${centerY + 8} ${pooledX - 6},${centerY}`}
          fill="var(--accent)"
          opacity={0.9}
        />

        {/* Site bubbles */}
        {sites.map((site, idx) => {
          const hr = num(site.hr);
          const x = toX(hr);
          const r = bubbleRadius(site.weight);
          const color = getBubbleColor(hr, num(site.ci_lower), num(site.ci_upper));

          return (
            <g key={idx}>
              {/* CI whisker */}
              <line
                x1={toX(num(site.ci_lower))}
                y1={centerY}
                x2={toX(num(site.ci_upper))}
                y2={centerY}
                stroke={color}
                strokeWidth={1.5}
                opacity={hoveredIndex === idx ? 1 : 0.5}
              />
              {/* Bubble */}
              <circle
                cx={x}
                cy={centerY}
                r={r}
                fill={color}
                opacity={hoveredIndex === idx ? 0.9 : 0.6}
                stroke={hoveredIndex === idx ? "var(--text-primary)" : "none"}
                strokeWidth={hoveredIndex === idx ? 1.5 : 0}
                aria-label={site.site_name}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: "pointer" }}
              />
            </g>
          );
        })}

        {/* Tooltip */}
        {hoveredIndex !== null && (() => {
          const site = sites[hoveredIndex];
          const x = toX(num(site.hr));
          const tooltipWidth = 180;
          const tooltipX = Math.min(Math.max(x - tooltipWidth / 2, 5), WIDTH - tooltipWidth - 5);
          const tooltipY = MARGIN.top - 5;

          return (
            <g>
              <rect
                x={tooltipX}
                y={tooltipY - 55}
                width={tooltipWidth}
                height={52}
                rx={4}
                fill="var(--surface-overlay)"
                stroke="var(--surface-highlight)"
                strokeWidth={1}
              />
              <text x={tooltipX + 8} y={tooltipY - 38} fill="var(--text-primary)" fontSize={10} fontWeight="bold">
                {site.site_name}
              </text>
              <text x={tooltipX + 8} y={tooltipY - 24} fill="var(--text-secondary)" fontSize={9} fontFamily="monospace">
                HR {fmt(site.hr, 3)} [{fmt(site.ci_lower, 3)}, {fmt(site.ci_upper, 3)}]
              </text>
              <text x={tooltipX + 8} y={tooltipY - 11} fill="var(--text-muted)" fontSize={9} fontFamily="monospace">
                {t("analyses.auto.weightValue_f3c4f7", {
                  value: `${fmt(site.weight, 1)}%`,
                })}
              </text>
            </g>
          );
        })()}

        {/* X-axis line */}
        <line
          x1={MARGIN.left}
          y1={HEIGHT - MARGIN.bottom}
          x2={WIDTH - MARGIN.right}
          y2={HEIGHT - MARGIN.bottom}
          stroke="var(--surface-highlight)"
          strokeWidth={1}
        />

        {/* X-axis ticks */}
        {ticks.map((tick) => {
          const x = toX(tick);
          return (
            <g key={tick}>
              <line
                x1={x}
                y1={HEIGHT - MARGIN.bottom}
                x2={x}
                y2={HEIGHT - MARGIN.bottom + 5}
                stroke="var(--text-ghost)"
                strokeWidth={1}
              />
              <text
                x={x}
                y={HEIGHT - MARGIN.bottom + 18}
                fill="var(--text-ghost)"
                fontSize={10}
                textAnchor="middle"
                fontFamily="monospace"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Axis label */}
        <text
          x={MARGIN.left + PLOT_WIDTH / 2}
          y={HEIGHT - 3}
          fill="var(--text-ghost)"
          fontSize={10}
          textAnchor="middle"
        >
          {t("analyses.auto.hazardRatioLogScale_453e55")}
        </text>
      </svg>
    </div>
  );
}
