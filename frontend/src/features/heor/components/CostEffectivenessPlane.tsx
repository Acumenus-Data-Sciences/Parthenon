import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChartCard, CHART, formatCompact } from "@/features/data-explorer/components/charts/chartUtils";
import type { HeorResult } from "../types";

interface Props {
  results: HeorResult[];
  wtp?: number;
}

const POINT_COLORS = [CHART.accent, CHART.gold, CHART.crimson, CHART.blue, "#A855F7", "var(--success)"];

export default function CostEffectivenessPlane({ results, wtp = 50000 }: Props) {
  const { t } = useTranslation("app");

  const quadrants = {
    ne: {
      label: t("heor.charts.costEffectivenessPlane.quadrants.moreCostlyMoreEffective"),
      sub: t("heor.charts.costEffectivenessPlane.quadrants.tradeOffIcerDecides"),
    },
    nw: {
      label: t("heor.charts.costEffectivenessPlane.quadrants.moreCostlyLessEffective"),
      sub: t("heor.charts.costEffectivenessPlane.quadrants.dominated"),
    },
    se: {
      label: t("heor.charts.costEffectivenessPlane.quadrants.lessCostlyMoreEffective"),
      sub: t("heor.charts.costEffectivenessPlane.quadrants.dominant"),
    },
    sw: {
      label: t("heor.charts.costEffectivenessPlane.quadrants.lessCostlyLessEffective"),
      sub: t("heor.charts.costEffectivenessPlane.quadrants.tradeOff"),
    },
  } as const;

  const points = useMemo(
    () =>
      results
        .filter((result) => result.incremental_qalys !== null && result.incremental_cost !== null)
        .map((result, index) => ({
          x: result.incremental_qalys!,
          y: result.incremental_cost!,
          label:
            result.scenario?.name ??
            t("heor.analysis.scenarioFallback", { id: result.scenario_id }),
          icer: result.icer,
          nmb: result.net_monetary_benefit,
          color: POINT_COLORS[index % POINT_COLORS.length],
        })),
    [results, t],
  );

  if (points.length === 0) {
    return (
      <ChartCard
        title={t("heor.charts.costEffectivenessPlane.title")}
        subtitle={t("heor.charts.costEffectivenessPlane.emptySubtitle")}
      >
        <div className="h-64 flex items-center justify-center text-sm text-text-ghost">
          {t("heor.charts.costEffectivenessPlane.noData")}
        </div>
      </ChartCard>
    );
  }

  const allX = points.map((point) => point.x);
  const allY = points.map((point) => point.y);
  const maxAbsX = Math.max(Math.abs(Math.min(...allX)), Math.abs(Math.max(...allX)), 0.1);
  const maxAbsY = Math.max(Math.abs(Math.min(...allY)), Math.abs(Math.max(...allY)), 100);
  const padX = maxAbsX * 1.4;
  const padY = maxAbsY * 1.4;

  const W = 560;
  const H = 400;
  const margin = { top: 24, right: 24, bottom: 44, left: 64 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;

  const scaleX = (value: number) => margin.left + ((value + padX) / (2 * padX)) * plotW;
  const scaleY = (value: number) => margin.top + ((padY - value) / (2 * padY)) * plotH;

  const wtpX1 = -padX;
  const wtpX2 = padX;

  const clipWtpY = (value: number) => Math.max(-padY, Math.min(padY, wtp * value));

  const makeAxisTicks = (maxAbs: number, count: number) => {
    const step = maxAbs / (count / 2);
    const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
    const normalized = step / magnitude;
    const niceStep =
      normalized <= 1
        ? magnitude
        : normalized <= 2
          ? 2 * magnitude
          : normalized <= 5
            ? 5 * magnitude
            : 10 * magnitude;
    const ticks: number[] = [];
    for (let value = -Math.ceil(maxAbs / niceStep) * niceStep; value <= maxAbs * 1.1; value += niceStep) {
      if (Math.abs(value) < niceStep * 0.01) {
        ticks.push(0);
      } else {
        ticks.push(value);
      }
    }
    return [...new Set(ticks)].filter((value) => value >= -maxAbs * 1.3 && value <= maxAbs * 1.3);
  };

  const xTicks = makeAxisTicks(padX, 6);
  const yTicks = makeAxisTicks(padY, 6);

  return (
    <ChartCard
      title={t("heor.charts.costEffectivenessPlane.title")}
      subtitle={t("heor.charts.costEffectivenessPlane.subtitle", {
        wtp: wtp.toLocaleString(),
      })}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={t("heor.charts.costEffectivenessPlane.ariaLabel")}
      >
        <rect
          x={scaleX(0)}
          y={margin.top}
          width={scaleX(padX) - scaleX(0)}
          height={scaleY(0) - margin.top}
          fill="var(--success)"
          opacity={0.03}
        />
        <rect
          x={margin.left}
          y={margin.top}
          width={scaleX(0) - margin.left}
          height={scaleY(0) - margin.top}
          fill="var(--critical)"
          opacity={0.04}
        />
        <rect
          x={scaleX(0)}
          y={scaleY(0)}
          width={scaleX(padX) - scaleX(0)}
          height={margin.top + plotH - scaleY(0)}
          fill="var(--success)"
          opacity={0.06}
        />
        <rect
          x={margin.left}
          y={scaleY(0)}
          width={scaleX(0) - margin.left}
          height={margin.top + plotH - scaleY(0)}
          fill="var(--accent)"
          opacity={0.03}
        />

        {xTicks.map((value) => (
          <line
            key={`gx-${value}`}
            x1={scaleX(value)}
            y1={margin.top}
            x2={scaleX(value)}
            y2={margin.top + plotH}
            stroke={CHART.grid}
            strokeWidth={value === 0 ? 1.5 : 0.5}
            strokeDasharray={value === 0 ? undefined : "3,3"}
          />
        ))}
        {yTicks.map((value) => (
          <line
            key={`gy-${value}`}
            x1={margin.left}
            y1={scaleY(value)}
            x2={margin.left + plotW}
            y2={scaleY(value)}
            stroke={CHART.grid}
            strokeWidth={value === 0 ? 1.5 : 0.5}
            strokeDasharray={value === 0 ? undefined : "3,3"}
          />
        ))}

        <line
          x1={scaleX(wtpX1)}
          y1={scaleY(clipWtpY(wtpX1))}
          x2={scaleX(wtpX2)}
          y2={scaleY(clipWtpY(wtpX2))}
          stroke={CHART.gold}
          strokeWidth={1.5}
          strokeDasharray="6,4"
          opacity={0.7}
        />
        <text
          x={scaleX(padX * 0.6)}
          y={scaleY(clipWtpY(padX * 0.6)) - 8}
          fill={CHART.gold}
          fontSize={10}
          fontWeight={500}
          opacity={0.8}
        >
          {t("heor.charts.costEffectivenessPlane.wtpLabel", {
            value: formatCompact(wtp),
          })}
        </text>

        <text
          x={scaleX(padX * 0.5)}
          y={scaleY(padY * 0.85)}
          fill={CHART.textDim}
          fontSize={9}
          textAnchor="middle"
        >
          {quadrants.ne.sub}
        </text>
        <text
          x={scaleX(-padX * 0.5)}
          y={scaleY(padY * 0.85)}
          fill={CHART.textDim}
          fontSize={9}
          textAnchor="middle"
        >
          {quadrants.nw.sub}
        </text>
        <text
          x={scaleX(padX * 0.5)}
          y={scaleY(-padY * 0.85)}
          fill={CHART.textDim}
          fontSize={9}
          textAnchor="middle"
        >
          {quadrants.se.sub}
        </text>
        <text
          x={scaleX(-padX * 0.5)}
          y={scaleY(-padY * 0.85)}
          fill={CHART.textDim}
          fontSize={9}
          textAnchor="middle"
        >
          {quadrants.sw.sub}
        </text>

        <text
          x={margin.left + plotW / 2}
          y={H - 4}
          fill={CHART.textSec}
          fontSize={11}
          textAnchor="middle"
          fontWeight={500}
        >
          {t("heor.charts.costEffectivenessPlane.incrementalQalys")}
        </text>
        <text
          x={14}
          y={margin.top + plotH / 2}
          fill={CHART.textSec}
          fontSize={11}
          textAnchor="middle"
          fontWeight={500}
          transform={`rotate(-90, 14, ${margin.top + plotH / 2})`}
        >
          {t("heor.charts.costEffectivenessPlane.incrementalCost")}
        </text>

        {xTicks.filter((value) => value !== 0).map((value) => (
          <text
            key={`xl-${value}`}
            x={scaleX(value)}
            y={margin.top + plotH + 16}
            fill={CHART.textDim}
            fontSize={9}
            textAnchor="middle"
          >
            {formatCompact(value)}
          </text>
        ))}
        {yTicks.filter((value) => value !== 0).map((value) => (
          <text
            key={`yl-${value}`}
            x={margin.left - 8}
            y={scaleY(value) + 3}
            fill={CHART.textDim}
            fontSize={9}
            textAnchor="end"
          >
            ${formatCompact(value)}
          </text>
        ))}

        {points.map((point, index) => (
          <g key={index}>
            <circle cx={scaleX(point.x)} cy={scaleY(point.y)} r={10} fill={point.color} opacity={0.15} />
            <circle
              cx={scaleX(point.x)}
              cy={scaleY(point.y)}
              r={6}
              fill={point.color}
              stroke={CHART.bg}
              strokeWidth={2}
            />
            <text
              x={scaleX(point.x) + 10}
              y={scaleY(point.y) - 10}
              fill={CHART.textPrimary}
              fontSize={10}
              fontWeight={500}
            >
              {point.label}
            </text>
            {point.icer !== null && (
              <text
                x={scaleX(point.x) + 10}
                y={scaleY(point.y) + 2}
                fill={CHART.textMuted}
                fontSize={9}
              >
                {t("heor.charts.costEffectivenessPlane.icer", {
                  value: formatCompact(point.icer),
                })}
              </text>
            )}
          </g>
        ))}

        <text x={scaleX(0) + 4} y={scaleY(0) - 4} fill={CHART.textDim} fontSize={9}>
          {t("heor.charts.costEffectivenessPlane.origin")}
        </text>
      </svg>

      <div className="flex flex-wrap gap-4 mt-3 px-1">
        {points.map((point, index) => (
          <div key={index} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: point.color }}
            />
            <span className="text-text-secondary">{point.label}</span>
            {point.nmb !== null && (
              <span
                className={`font-mono text-[10px] ${point.nmb >= 0 ? "text-success" : "text-critical"}`}
              >
                {t("heor.charts.costEffectivenessPlane.nmb", {
                  value: formatCompact(point.nmb),
                })}
              </span>
            )}
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
