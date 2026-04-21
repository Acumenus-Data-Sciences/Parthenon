import { useState, useCallback } from "react";
import { fmt, num } from "@/lib/formatters";
import { useTranslation } from "react-i18next";

interface SccsEra {
  era_name: string;
  era_type: "pre-exposure" | "exposure" | "post-exposure" | "control";
  start_day: number;
  end_day: number;
  event_count: number;
  person_days: number;
  irr?: number;
  ci_lower?: number;
  ci_upper?: number;
}

interface SccsTimelineProps {
  eras: SccsEra[];
  exposureName?: string;
}

const ERA_COLORS: Record<string, string> = {
  "pre-exposure": "var(--text-muted)",
  exposure: "var(--success)",
  "post-exposure": "var(--accent)",
  control: "var(--surface-highlight)",
};

interface TooltipState {
  x: number;
  y: number;
  era: SccsEra;
}

export function SccsTimeline({ eras, exposureName }: SccsTimelineProps) {
  const { t } = useTranslation("app");
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const handleMouseEnter = useCallback((e: React.MouseEvent<SVGGElement>, era: SccsEra) => {
    const rect = (e.currentTarget.closest("svg") as SVGSVGElement)?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 10,
      era,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  if (eras.length === 0) return null;

  const width = 800;
  const height = 260;
  const padding = { top: 50, right: 30, bottom: 50, left: 30 };
  const plotW = width - padding.left - padding.right;
  const barArea = height - padding.top - padding.bottom;

  const allDays = eras.flatMap((e) => [e.start_day, e.end_day]);
  const minDay = Math.min(...allDays);
  const maxDay = Math.max(...allDays);
  const dayRange = maxDay - minDay || 1;

  // IRR magnitude encoding: block height proportional to log(IRR)
  const maxLogIrr = Math.max(
    ...eras.map((e) => (e.irr != null ? Math.abs(Math.log(Math.max(num(e.irr), 0.01))) : 0)),
    0.1,
  );

  const toX = (day: number) =>
    padding.left + ((day - minDay) / dayRange) * plotW;

  const toH = (era: SccsEra): number => {
    if (era.irr != null) {
      // Height proportional to |log(IRR)|, creating a "risk landscape"
      const logIrr = Math.abs(Math.log(Math.max(num(era.irr), 0.01)));
      return Math.max((logIrr / maxLogIrr) * barArea * 0.7, 12);
    }
    // Fallback to event rate for eras without IRR
    const maxRate = Math.max(
      ...eras.map((e) => (e.person_days > 0 ? e.event_count / e.person_days : 0)),
      0.001,
    );
    const rate = era.person_days > 0 ? era.event_count / era.person_days : 0;
    return Math.max((rate / maxRate) * barArea * 0.7, 12);
  };

  // Day axis ticks
  const tickStep = Math.max(Math.round(dayRange / 8), 1);
  const dayTicks: number[] = [];
  for (let d = minDay; d <= maxDay; d += tickStep) {
    dayTicks.push(d);
  }
  if (dayTicks[dayTicks.length - 1] !== maxDay) dayTicks.push(maxDay);

  const baseY = padding.top + barArea;

  // Generate pseudo-random event dots within each era for density overlay
  function generateEventDots(era: SccsEra, x1: number, x2: number): Array<{ cx: number; cy: number }> {
    const dots: Array<{ cx: number; cy: number }> = [];
    const blockH = toH(era);
    const count = Math.min(era.event_count, 30); // Cap at 30 dots for readability
    const blockW = x2 - x1;
    if (blockW < 2 || count === 0) return dots;

    // Deterministic distribution based on era start_day
    for (let i = 0; i < count; i++) {
      const frac = count === 1 ? 0.5 : i / (count - 1);
      const jitterX = ((((era.start_day * 17 + i * 31) % 100) / 100) - 0.5) * blockW * 0.15;
      const jitterY = ((((era.start_day * 13 + i * 23) % 100) / 100) - 0.5) * blockH * 0.4;
      dots.push({
        cx: x1 + frac * blockW + jitterX,
        cy: baseY - blockH / 2 + jitterY,
      });
    }
    return dots;
  }

  return (
    <div className="overflow-x-auto relative">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-text-primary"
        role="img"
        aria-label={t("analyses.auto.sCCSTimelineForExposure_5e3be1", {
          exposure: exposureName ?? t("analyses.auto.exposure_3efb7d"),
        })}
      >
        <rect width={width} height={height} fill="var(--surface-raised)" rx={8} />

        {/* Title */}
        {exposureName && (
          <text
            x={width / 2}
            y={20}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize={11}
            fontWeight={600}
          >
            {exposureName} — {t("analyses.auto.riskWindowTimeline_f301f1")}
          </text>
        )}

        {/* Day axis */}
        <line
          x1={padding.left}
          y1={baseY}
          x2={padding.left + plotW}
          y2={baseY}
          stroke="var(--surface-highlight)"
          strokeWidth={1}
        />
        {dayTicks.map((d) => (
          <g key={d}>
            <line
              x1={toX(d)}
              y1={baseY}
              x2={toX(d)}
              y2={baseY + 5}
              stroke="var(--text-ghost)"
              strokeWidth={1}
            />
            <text
              x={toX(d)}
              y={baseY + 18}
              textAnchor="middle"
              fill="var(--text-ghost)"
              fontSize={9}
            >
              {d}
            </text>
          </g>
        ))}
        <text
          x={padding.left + plotW / 2}
          y={height - 8}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={10}
        >
          {t("analyses.auto.daysRelativeToExposureStart_7ea334")}
        </text>

        {/* Era blocks */}
        {eras.map((era, i) => {
          const x1 = toX(era.start_day);
          const x2 = toX(era.end_day);
          const blockW = Math.max(x2 - x1, 2);
          const blockH = toH(era);
          const color = ERA_COLORS[era.era_type] ?? "var(--surface-highlight)";
          const dots = generateEventDots(era, x1, x1 + blockW);

          return (
            <g
              key={i}
              onMouseEnter={(e) => handleMouseEnter(e, era)}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: "pointer" }}
              data-testid={`era-block-${i}`}
            >
              {/* Block with IRR-proportional height */}
              <rect
                x={x1}
                y={baseY - blockH}
                width={blockW}
                height={blockH}
                fill={color}
                opacity={0.5}
                stroke={color}
                strokeWidth={1}
                rx={2}
              >
                <title>
                  {t("analyses.auto.eraEventPersonDaysTooltip_9b4085", {
                    eraName: era.era_name,
                    eventCount: era.event_count,
                    personDays: era.person_days.toLocaleString(),
                    irrSuffix:
                      era.irr != null
                        ? ` (${t("analyses.auto.iRRValue_3fe1a8", {
                            value: fmt(era.irr),
                          })})`
                        : "",
                  })}
                </title>
              </rect>

              {/* Event density dots */}
              {dots.map((dot, di) => (
                <circle
                  key={di}
                  cx={dot.cx}
                  cy={dot.cy}
                  r={1.5}
                  fill="var(--text-primary)"
                  opacity={0.4}
                />
              ))}

              {/* CI whiskers */}
              {era.irr != null && era.ci_lower != null && era.ci_upper != null && (
                (() => {
                  const midX = x1 + blockW / 2;
                  const logLower = Math.abs(Math.log(Math.max(num(era.ci_lower), 0.01)));
                  const logUpper = Math.abs(Math.log(Math.max(num(era.ci_upper), 0.01)));
                  // Whisker heights relative to the same scale
                  const hLower = Math.max((logLower / maxLogIrr) * barArea * 0.7, 4);
                  const hUpper = Math.max((logUpper / maxLogIrr) * barArea * 0.7, 4);
                  const whiskerTop = baseY - Math.max(hUpper, hLower, blockH) - 2;
                  const whiskerBottom = baseY - Math.min(hLower, hUpper) + 4;
                  return (
                    <g>
                      <line
                        x1={midX}
                        y1={whiskerTop}
                        x2={midX}
                        y2={whiskerBottom}
                        stroke={color}
                        strokeWidth={1}
                        opacity={0.7}
                      />
                      <line
                        x1={midX - 3}
                        y1={whiskerTop}
                        x2={midX + 3}
                        y2={whiskerTop}
                        stroke={color}
                        strokeWidth={1}
                        opacity={0.7}
                      />
                      <line
                        x1={midX - 3}
                        y1={whiskerBottom}
                        x2={midX + 3}
                        y2={whiskerBottom}
                        stroke={color}
                        strokeWidth={1}
                        opacity={0.7}
                      />
                    </g>
                  );
                })()
              )}

              {/* Label inside block */}
              {blockW > 50 && (
                <>
                  <text
                    x={x1 + blockW / 2}
                    y={baseY - blockH + 14}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize={9}
                    fontWeight={600}
                  >
                    {era.era_name}
                  </text>
                  <text
                    x={x1 + blockW / 2}
                    y={baseY - blockH + 26}
                    textAnchor="middle"
                    fill="var(--text-secondary)"
                    fontSize={8}
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    {t("analyses.auto.eventsCount_5917d5", {
                      count: era.event_count,
                    })}
                  </text>
                </>
              )}

              {/* IRR annotation above exposure eras */}
              {era.irr != null && era.era_type === "exposure" && (
                <g>
                  <text
                    x={x1 + blockW / 2}
                    y={baseY - blockH - 10}
                    textAnchor="middle"
                    fill="var(--success)"
                    fontSize={10}
                    fontWeight={600}
                    fontFamily="IBM Plex Mono, monospace"
                  >
                    {t("analyses.auto.iRRWithValue_2057d0", {
                      value: fmt(era.irr),
                    })}
                  </text>
                  {era.ci_lower != null && era.ci_upper != null && (
                    <text
                      x={x1 + blockW / 2}
                      y={baseY - blockH - 22}
                      textAnchor="middle"
                      fill="var(--text-muted)"
                      fontSize={8}
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      ({fmt(era.ci_lower)}-{fmt(era.ci_upper)})
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${padding.left}, ${height - 38})`}>
          {(["pre-exposure", "exposure", "post-exposure", "control"] as const).map((type, i) => (
            <g key={type} transform={`translate(${i * 150}, 0)`}>
              <rect x={0} y={0} width={10} height={10} rx={2} fill={ERA_COLORS[type]} opacity={0.6} />
              <text x={14} y={9} fill="var(--text-muted)" fontSize={9}>
                {type === "pre-exposure"
                  ? t("analyses.auto.preExposure_f8b5cd")
                  : type === "post-exposure"
                    ? t("analyses.auto.postExposure_4fc98c")
                    : type === "control"
                      ? t("analyses.auto.control_e9c8f7")
                      : t("analyses.auto.exposure_3efb7d")}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Interactive tooltip overlay */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 rounded-lg border border-border-default bg-surface-overlay p-3 shadow-lg text-xs"
          style={{
            left: Math.min(tooltip.x, width - 200),
            top: Math.max(tooltip.y - 80, 0),
          }}
          data-testid="timeline-tooltip"
        >
          <p className="font-semibold text-text-primary mb-1">{tooltip.era.era_name}</p>
          {tooltip.era.irr != null && (
            <p className="font-mono text-success">
              IRR: {fmt(tooltip.era.irr)}{" "}
              {tooltip.era.ci_lower != null && tooltip.era.ci_upper != null && (
                <span className="text-text-muted">
                  [{fmt(tooltip.era.ci_lower)} - {fmt(tooltip.era.ci_upper)}]
                </span>
              )}
            </p>
          )}
          <p className="text-text-muted">
            {t("analyses.auto.eventsLabel_ec1423")} {tooltip.era.event_count}
          </p>
          <p className="text-text-muted">
            {t("analyses.auto.personTimeLabel_efbcb3")}{" "}
            {t("analyses.auto.personTimeDays_dcbeb5", {
              value: tooltip.era.person_days.toLocaleString(),
            })}
          </p>
        </div>
      )}
    </div>
  );
}
