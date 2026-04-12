import { cn } from "@/lib/utils";
import { fmt, num } from "@/lib/formatters";
import type { SccsResult, SccsEra } from "../types/sccs";

interface SccsVerdictDashboardProps {
  result: SccsResult;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPrimaryExposureEra(eras: SccsEra[]): SccsEra | null {
  return eras.find((e) => e.era_type === "exposure" && e.irr != null) ?? null;
}

function getPreExposureEra(eras: SccsEra[]): SccsEra | null {
  return eras.find((e) => e.era_type === "pre-exposure") ?? null;
}

function getControlEra(eras: SccsEra[]): SccsEra | null {
  return eras.find((e) => e.era_type === "control") ?? null;
}

function isSignificant(_irr: number, ciLower?: number, ciUpper?: number): boolean {
  if (ciLower == null || ciUpper == null) return false;
  return num(ciLower) > 1 || num(ciUpper) < 1;
}

function computeExcessRisk(irr: number, baseRate: number): number {
  // Absolute excess risk per 1,000 exposed patients
  // excess = (IRR - 1) * baseRate * 1000
  return (irr - 1) * baseRate * 1000;
}

function directionArrow(irr: number): string {
  if (irr > 1.05) return "\u2191"; // up arrow
  if (irr < 0.95) return "\u2193"; // down arrow
  return "\u2194"; // left-right arrow (neutral)
}

function irrBlockColor(irr: number): string {
  if (irr > 1.05) return "#E85A6B";
  if (irr < 0.95) return "#2DD4BF";
  return "#8A857D";
}

// ---------------------------------------------------------------------------
// Risk Window Summary Card
// ---------------------------------------------------------------------------

function RiskWindowSummaryCard({ result }: { result: SccsResult }) {
  const eras = result.eras ?? [];
  const primary = getPrimaryExposureEra(eras);
  const preExposure = getPreExposureEra(eras);
  const control = getControlEra(eras);

  if (!primary) {
    return (
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4" data-testid="risk-window-summary">
        <p className="text-sm text-[#5A5650]">No exposure era with IRR data available.</p>
      </div>
    );
  }

  const irr = num(primary.irr);
  const ciLower = primary.ci_lower != null ? num(primary.ci_lower) : undefined;
  const ciUpper = primary.ci_upper != null ? num(primary.ci_upper) : undefined;
  const sig = isSignificant(irr, ciLower, ciUpper);

  // Base rate from control era (events per person-day)
  const controlRate =
    control && control.person_days > 0
      ? control.event_count / control.person_days
      : primary.person_days > 0
        ? primary.event_count / primary.person_days / irr
        : 0;
  const excessRisk = computeExcessRisk(irr, controlRate);

  // Pre-exposure trend test
  const preExposureIrr = preExposure?.irr != null ? num(preExposure.irr) : null;
  const preExposurePass = preExposureIrr == null || preExposureIrr <= 1.5;

  // Control period deviation
  const controlIrr = control?.irr != null ? num(control.irr) : null;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-5" data-testid="risk-window-summary">
      <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">Risk Window Summary</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Primary IRR */}
        <div className="space-y-2">
          <p className="text-xs text-[#8A857D] uppercase tracking-wide">Primary Exposure IRR</p>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "text-3xl font-bold font-mono",
                irr > 1 ? "text-[#E85A6B]" : irr < 1 ? "text-[#2DD4BF]" : "text-[#F0EDE8]",
              )}
              data-testid="primary-irr"
            >
              {fmt(irr, 2)}
            </span>
            <span className="text-lg" data-testid="direction-arrow">
              {directionArrow(irr)}
            </span>
          </div>
          {ciLower != null && ciUpper != null && (
            <p className="text-xs font-mono text-[#8A857D]">
              95% CI: {fmt(ciLower, 2)} - {fmt(ciUpper, 2)}
            </p>
          )}
          <span
            className={cn(
              "inline-block px-2 py-0.5 rounded text-xs font-medium border",
              sig
                ? irr > 1
                  ? "bg-[#E85A6B]/15 text-[#E85A6B] border-[#E85A6B]/30"
                  : "bg-[#2DD4BF]/15 text-[#2DD4BF] border-[#2DD4BF]/30"
                : "bg-[#8A857D]/15 text-[#8A857D] border-[#8A857D]/30",
            )}
            data-testid="significance-verdict"
          >
            {sig ? "Statistically Significant" : "Not Significant"}
          </span>
        </div>

        {/* Absolute Excess Risk */}
        <div className="space-y-2">
          <p className="text-xs text-[#8A857D] uppercase tracking-wide">Absolute Excess Risk</p>
          <p className="text-xl font-bold font-mono text-[#C9A227]" data-testid="excess-risk">
            {Number.isFinite(excessRisk) ? `${excessRisk >= 0 ? "+" : ""}${fmt(excessRisk, 1)}` : "N/A"}
          </p>
          <p className="text-xs text-[#5A5650]">
            additional events per 1,000 exposed patients during risk window
          </p>
        </div>

        {/* Diagnostics */}
        <div className="space-y-3">
          {/* Pre-exposure trend test */}
          <div>
            <p className="text-xs text-[#8A857D] uppercase tracking-wide mb-1">Pre-Exposure Trend</p>
            <span
              className={cn(
                "inline-block px-2 py-0.5 rounded text-xs font-medium border",
                preExposurePass
                  ? "bg-[#2DD4BF]/15 text-[#2DD4BF] border-[#2DD4BF]/30"
                  : "bg-[#C9A227]/15 text-[#C9A227] border-[#C9A227]/30",
              )}
              data-testid="pre-exposure-badge"
            >
              {preExposurePass ? "PASS" : "FAIL \u2014 possible assumption violation"}
            </span>
            {preExposureIrr != null && (
              <p className="text-xs font-mono text-[#5A5650] mt-1">IRR: {fmt(preExposureIrr, 2)}</p>
            )}
          </div>

          {/* Control period IRR */}
          {controlIrr != null && (
            <div>
              <p className="text-xs text-[#8A857D] uppercase tracking-wide mb-1">Control Period IRR</p>
              <p className="text-sm font-mono text-[#F0EDE8]" data-testid="control-irr">
                {fmt(controlIrr, 2)}
                {Math.abs(controlIrr - 1) > 0.2 && (
                  <span className="ml-2 text-xs text-[#C9A227]">(deviation from 1.0 — possible misspecification)</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multi-Window Comparison Strip
// ---------------------------------------------------------------------------

function MultiWindowStrip({ eras }: { eras: SccsEra[] }) {
  const sorted = [...eras].sort((a, b) => a.start_day - b.start_day);
  if (sorted.length === 0) return null;

  const minDay = Math.min(...sorted.map((e) => e.start_day));
  const maxDay = Math.max(...sorted.map((e) => e.end_day));
  const dayRange = maxDay - minDay || 1;

  const stripWidth = 700;
  const padding = 40;
  const plotW = stripWidth - padding * 2;

  const toX = (day: number) => padding + ((day - minDay) / dayRange) * plotW;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-5" data-testid="multi-window-strip">
      <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">Risk Window Comparison</h3>
      <div className="overflow-x-auto">
        <svg
          width={stripWidth}
          height={120}
          viewBox={`0 0 ${stripWidth} 120`}
          className="text-[#F0EDE8]"
          role="img"
          aria-label="Multi-window comparison strip"
        >
          <rect width={stripWidth} height={120} fill="#151518" rx={8} />

          {/* Timeline axis */}
          <line x1={padding} y1={80} x2={stripWidth - padding} y2={80} stroke="#323238" strokeWidth={1} />

          {sorted.map((era, i) => {
            const x1 = toX(era.start_day);
            const x2 = toX(era.end_day);
            const blockW = Math.max(x2 - x1, 4);
            const irr = era.irr != null ? num(era.irr) : null;
            const color = irr != null ? irrBlockColor(irr) : "#323238";
            const isPreExposure = era.era_type === "pre-exposure";
            const isPostExposure = era.era_type === "post-exposure";
            const elevatedPre = isPreExposure && irr != null && irr > 1.5;
            const elevatedPost = isPostExposure && irr != null && irr > 1.2;

            return (
              <g key={i} data-testid={`window-block-${era.era_type}`}>
                {/* Timeline block */}
                <rect
                  x={x1}
                  y={58}
                  width={blockW}
                  height={22}
                  fill={color}
                  opacity={0.5}
                  rx={3}
                  stroke={elevatedPre ? "#C9A227" : color}
                  strokeWidth={elevatedPre ? 2 : 1}
                />

                {/* IRR badge above */}
                {irr != null && (
                  <g>
                    <rect
                      x={x1 + blockW / 2 - 22}
                      y={32}
                      width={44}
                      height={20}
                      rx={4}
                      fill={color}
                      opacity={0.2}
                    />
                    <text
                      x={x1 + blockW / 2}
                      y={46}
                      textAnchor="middle"
                      fill={color}
                      fontSize={10}
                      fontWeight={600}
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {fmt(irr, 2)}
                    </text>
                  </g>
                )}

                {/* Era name below */}
                <text
                  x={x1 + blockW / 2}
                  y={108}
                  textAnchor="middle"
                  fill="#8A857D"
                  fontSize={8}
                >
                  {era.era_name.length > 14 ? era.era_name.substring(0, 14) + "..." : era.era_name}
                </text>

                {/* Carryover flag for elevated post-exposure */}
                {elevatedPost && (
                  <text
                    x={x1 + blockW / 2}
                    y={22}
                    textAnchor="middle"
                    fill="#C9A227"
                    fontSize={8}
                    fontWeight={600}
                    data-testid="carryover-flag"
                  >
                    carryover?
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Mini Forest Plot (for IRR table rows)
// ---------------------------------------------------------------------------

export function InlineMiniForestPlot({
  irr,
  ciLower,
  ciUpper,
}: {
  irr: number;
  ciLower?: number;
  ciUpper?: number;
}) {
  const w = 120;
  const h = 20;
  const pad = 8;
  const plotW = w - pad * 2;

  // Log scale centered on IRR=1
  const logMin = Math.log(0.1);
  const logMax = Math.log(10);
  const logRange = logMax - logMin;

  const toX = (val: number): number => {
    const lv = Math.log(Math.max(Math.min(val, 10), 0.1));
    return pad + ((lv - logMin) / logRange) * plotW;
  };

  const refX = toX(1);
  const irrX = toX(num(irr));
  const ciLowX = ciLower != null ? toX(num(ciLower)) : null;
  const ciHighX = ciUpper != null ? toX(num(ciUpper)) : null;
  const color = num(irr) > 1 ? "#E85A6B" : num(irr) < 1 ? "#2DD4BF" : "#8A857D";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label={`IRR ${fmt(irr, 2)}`}>
      {/* Reference line at IRR=1 */}
      <line x1={refX} y1={2} x2={refX} y2={h - 2} stroke="#C9A227" strokeWidth={1} strokeDasharray="2 2" opacity={0.5} />

      {/* CI line */}
      {ciLowX != null && ciHighX != null && (
        <>
          <line x1={ciLowX} y1={h / 2} x2={ciHighX} y2={h / 2} stroke={color} strokeWidth={1.5} />
          <line x1={ciLowX} y1={h / 2 - 3} x2={ciLowX} y2={h / 2 + 3} stroke={color} strokeWidth={1} />
          <line x1={ciHighX} y1={h / 2 - 3} x2={ciHighX} y2={h / 2 + 3} stroke={color} strokeWidth={1} />
        </>
      )}

      {/* Point estimate */}
      <circle cx={irrX} cy={h / 2} r={3} fill={color} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

export function SccsVerdictDashboard({ result }: SccsVerdictDashboardProps) {
  const eras = result.eras ?? [];

  return (
    <div className="space-y-4" data-testid="sccs-verdict-dashboard">
      <RiskWindowSummaryCard result={result} />
      {eras.length > 0 && <MultiWindowStrip eras={eras} />}
    </div>
  );
}
