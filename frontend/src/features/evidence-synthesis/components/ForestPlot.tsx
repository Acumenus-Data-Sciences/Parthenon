import { cn } from "@/lib/utils";
import { fmt, num } from "@/lib/formatters";
import { useTranslation } from "react-i18next";
import type { PerSiteResult, PooledEstimate } from "../types/evidenceSynthesis";

interface ForestPlotProps {
  perSite: PerSiteResult[];
  pooled: PooledEstimate;
  className?: string;
}

/** Compute inverse-variance weight for a site */
function siteWeight(se: number): number {
  if (se <= 0 || !Number.isFinite(se)) return 0;
  return 1 / (se * se);
}

/**
 * Compute leave-one-out pooled HR (fixed-effect inverse-variance) excluding site at `excludeIdx`.
 * Returns the pooled HR without that site.
 */
function leaveOneOutPooledHr(sites: PerSiteResult[], excludeIdx: number): number {
  let wSum = 0;
  let wLogRrSum = 0;
  for (let i = 0; i < sites.length; i++) {
    if (i === excludeIdx) continue;
    const se = num(sites[i].se_log_rr);
    if (se <= 0) continue;
    const w = 1 / (se * se);
    wSum += w;
    wLogRrSum += w * num(sites[i].log_rr);
  }
  if (wSum === 0) return 1;
  return Math.exp(wLogRrSum / wSum);
}

/** Check if an HR estimate's CI excludes 1 (i.e., is significant) */
function isSignificant(ciLower: number, ciUpper: number): boolean {
  return ciLower > 1 || ciUpper < 1;
}

export function ForestPlot({ perSite, pooled, className }: ForestPlotProps) {
  const { t } = useTranslation("app");
  // Compute weights
  const weights = perSite.map((s) => siteWeight(num(s.se_log_rr)));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const weightPcts = weights.map((w) => (totalWeight > 0 ? (w / totalWeight) * 100 : 0));

  // Prediction interval for random effects
  const tau = num(pooled.tau);
  const logRrPooled = Math.log(Math.max(num(pooled.hr), 0.01));
  const hasPredictionInterval = tau > 0;
  const piLower = hasPredictionInterval ? Math.exp(logRrPooled - 1.96 * tau) : num(pooled.ci_lower);
  const piUpper = hasPredictionInterval ? Math.exp(logRrPooled + 1.96 * tau) : num(pooled.ci_upper);

  // Determine if pooled estimate is significant
  const pooledSignificant = isSignificant(num(pooled.ci_lower), num(pooled.ci_upper));

  // Leave-one-out: does removing each site change pooled significance?
  const leaveOneOutChanges = perSite.map((_, idx) => {
    if (perSite.length <= 2) return false; // Need at least 2 remaining sites
    const looHr = leaveOneOutPooledHr(perSite, idx);
    // Re-estimate CI approximately using remaining sites (inverse-variance)
    let wSum = 0;
    for (let i = 0; i < perSite.length; i++) {
      if (i === idx) continue;
      const se = num(perSite[i].se_log_rr);
      if (se > 0) wSum += 1 / (se * se);
    }
    const looCiHalfWidth = wSum > 0 ? 1.96 / Math.sqrt(wSum) : 0;
    const logLooHr = Math.log(Math.max(looHr, 0.01));
    const looCiLower = Math.exp(logLooHr - looCiHalfWidth);
    const looCiUpper = Math.exp(logLooHr + looCiHalfWidth);
    const looSignificant = isSignificant(looCiLower, looCiUpper);
    return looSignificant !== pooledSignificant;
  });

  // Determine axis range including prediction interval
  const allValues = [
    ...perSite.flatMap((s) => [num(s.ci_lower), num(s.ci_upper)]),
    num(pooled.ci_lower),
    num(pooled.ci_upper),
    piLower,
    piUpper,
  ].filter((v) => v > 0);
  const min = Math.min(...allValues, 0.1);
  const max = Math.max(...allValues, 3);
  const logMin = Math.log(Math.max(min * 0.8, 0.01));
  const logMax = Math.log(max * 1.2);
  const logRange = logMax - logMin;

  const toX = (hr: number) => {
    const logHr = Math.log(Math.max(hr, 0.01));
    return ((logHr - logMin) / logRange) * 100;
  };

  const nullLineX = toX(1);
  const rowHeight = 32;
  const svgHeight = (perSite.length + 2) * rowHeight + 40;

  return (
    <div className={cn("rounded-lg border border-border-default bg-surface-raised p-4", className)}>
      <h3 className="text-sm font-semibold text-text-primary mb-4">
        {t("analyses.auto.forestPlot_38213b")}
      </h3>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 650 ${svgHeight}`}
          className="w-full min-w-[550px]"
          style={{ maxHeight: svgHeight }}
        >
          {/* Null effect line at HR=1 */}
          <line
            x1={120 + nullLineX * 4.2}
            y1={10}
            x2={120 + nullLineX * 4.2}
            y2={svgHeight - 30}
            stroke="var(--text-ghost)"
            strokeWidth={1}
            strokeDasharray="4,4"
          />

          {/* Per-site rows */}
          {perSite.map((site, idx) => {
            const y = 24 + idx * rowHeight;
            const xHr = 120 + toX(num(site.hr)) * 4.2;
            const xLo = 120 + toX(num(site.ci_lower)) * 4.2;
            const xHi = 120 + toX(num(site.ci_upper)) * 4.2;

            return (
              <g key={idx}>
                {/* Label */}
                <text x={8} y={y + 4} fill="var(--text-secondary)" fontSize={11} fontFamily="monospace">
                  {site.site_name}
                </text>
                {/* CI line */}
                <line x1={xLo} y1={y} x2={xHi} y2={y} stroke="var(--text-muted)" strokeWidth={1.5} />
                {/* Point estimate */}
                <rect
                  x={xHr - 4}
                  y={y - 4}
                  width={8}
                  height={8}
                  fill="var(--success)"
                  rx={1}
                />
                {/* HR label */}
                <text x={550} y={y + 4} fill="var(--text-muted)" fontSize={10} fontFamily="monospace" textAnchor="end">
                  {fmt(site.hr, 2)} [{fmt(site.ci_lower, 2)}, {fmt(site.ci_upper, 2)}]
                </text>
                {/* Weight % column */}
                <text x={600} y={y + 4} fill="var(--text-ghost)" fontSize={9} fontFamily="monospace" textAnchor="end" data-testid={`weight-${idx}`}>
                  {fmt(weightPcts[idx], 1)}%
                </text>
                {/* Leave-one-out sensitivity marker */}
                {leaveOneOutChanges[idx] && (
                  <circle
                    cx={615}
                    cy={y}
                    r={3}
                    fill="var(--accent)"
                    data-testid={`loo-marker-${idx}`}
                  >
                    <title>
                      {t(
                        "analyses.auto.removingThisSiteChangesPooledSignificance_0d6ce2",
                      )}
                    </title>
                  </circle>
                )}
              </g>
            );
          })}

          {/* Column header for weight */}
          <text x={600} y={10} fill="var(--text-ghost)" fontSize={9} fontFamily="monospace" textAnchor="end" fontWeight="bold">
            {t("analyses.auto.wtPercent_22a0d3")}
          </text>

          {/* Pooled estimate (diamond) */}
          {(() => {
            const y = 24 + perSite.length * rowHeight + 12;
            const xHr = 120 + toX(num(pooled.hr)) * 4.2;
            const xLo = 120 + toX(num(pooled.ci_lower)) * 4.2;
            const xHi = 120 + toX(num(pooled.ci_upper)) * 4.2;

            // Prediction interval diamond (wider, semi-transparent)
            const xPiLo = 120 + toX(piLower) * 4.2;
            const xPiHi = 120 + toX(piUpper) * 4.2;

            return (
              <g>
                <line x1={0} y1={y - 14} x2={650} y2={y - 14} stroke="var(--surface-elevated)" strokeWidth={1} />
                <text x={8} y={y + 4} fill="var(--text-primary)" fontSize={11} fontWeight="bold" fontFamily="monospace">
                  {t("analyses.auto.pooled_d3f276")}
                </text>

                {/* Prediction interval diamond (behind CI diamond) */}
                {hasPredictionInterval && (
                  <polygon
                    points={`${xPiLo},${y} ${xHr},${y - 9} ${xPiHi},${y} ${xHr},${y + 9}`}
                    fill="var(--accent)"
                    opacity={0.2}
                    data-testid="prediction-interval-diamond"
                  />
                )}

                {/* CI Diamond */}
                <polygon
                  points={`${xLo},${y} ${xHr},${y - 6} ${xHi},${y} ${xHr},${y + 6}`}
                  fill="var(--accent)"
                  opacity={0.8}
                />
                <text x={550} y={y + 4} fill="var(--accent)" fontSize={10} fontFamily="monospace" fontWeight="bold" textAnchor="end">
                  {fmt(pooled.hr, 2)} [{fmt(pooled.ci_lower, 2)}, {fmt(pooled.ci_upper, 2)}]
                </text>
              </g>
            );
          })()}

          {/* X-axis */}
          {[0.25, 0.5, 1, 2, 4].filter((v) => v >= min * 0.9 && v <= max * 1.1).map((tick) => {
            const x = 120 + toX(tick) * 4.2;
            return (
              <g key={tick}>
                <line x1={x} y1={svgHeight - 30} x2={x} y2={svgHeight - 25} stroke="var(--text-ghost)" strokeWidth={1} />
                <text x={x} y={svgHeight - 12} fill="var(--text-ghost)" fontSize={9} textAnchor="middle" fontFamily="monospace">
                  {tick}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
