import { useMemo } from "react";
import { fmt } from "@/lib/formatters";
import { useTranslation } from "react-i18next";

interface CalibrationPlotProps {
  data: { predicted: number; observed: number }[];
  slope: number;
  intercept: number;
  populationBins?: { binStart: number; binEnd: number; count: number }[];
}

export function CalibrationPlot({
  data,
  slope,
  intercept,
  populationBins,
}: CalibrationPlotProps) {
  const { t } = useTranslation("app");
  const width = 400;
  const height = 440; // Extra 40px for marginal histogram
  const barAreaH = 40;
  const padding = { top: 30, right: 30, bottom: 50 + barAreaH, left: 55 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const toX = (predicted: number) => padding.left + predicted * plotW;
  const toY = (observed: number) => padding.top + (1 - observed) * plotH;

  const gridLines = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  // Compute ICI and E-max from calibration data
  const calibrationMetrics = useMemo(() => {
    if (data.length === 0) return { ici: 0, emax: 0 };
    const diffs = data.map((pt) => Math.abs(pt.observed - pt.predicted));
    const ici = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
    const emax = Math.max(...diffs);
    return { ici, emax };
  }, [data]);

  // Auto-generate decile bins from calibration data if not provided
  const decileBins = useMemo(() => {
    if (populationBins && populationBins.length > 0) return populationBins;
    // Create bins from calibration points spread across 10 deciles
    if (data.length === 0) return [];
    const numBins = 10;
    const bins: { binStart: number; binEnd: number; count: number }[] = [];
    for (let i = 0; i < numBins; i++) {
      const binStart = i / numBins;
      const binEnd = (i + 1) / numBins;
      const count = data.filter(
        (pt) => pt.predicted >= binStart && pt.predicted < binEnd,
      ).length;
      bins.push({ binStart, binEnd, count });
    }
    return bins;
  }, [data, populationBins]);

  const maxBinCount = useMemo(
    () => decileBins.length > 0 ? Math.max(...decileBins.map((b) => b.count), 1) : 1,
    [decileBins],
  );

  const barAreaTop = padding.top + plotH + 20;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-text-primary"
      data-testid="calibration-plot-svg"
    >
      {/* Background */}
      <rect width={width} height={height} fill="var(--surface-raised)" rx={8} />

      {/* Grid */}
      {gridLines.map((v) => (
        <g key={v}>
          <line
            x1={toX(v)}
            y1={padding.top}
            x2={toX(v)}
            y2={padding.top + plotH}
            stroke="var(--surface-elevated)"
            strokeWidth={0.5}
          />
          <line
            x1={padding.left}
            y1={toY(v)}
            x2={padding.left + plotW}
            y2={toY(v)}
            stroke="var(--surface-elevated)"
            strokeWidth={0.5}
          />
          <text
            x={toX(v)}
            y={padding.top + plotH + 16}
            textAnchor="middle"
            fill="var(--text-ghost)"
            fontSize={10}
          >
            {v.toFixed(1)}
          </text>
          <text
            x={padding.left - 8}
            y={toY(v) + 3}
            textAnchor="end"
            fill="var(--text-ghost)"
            fontSize={10}
          >
            {v.toFixed(1)}
          </text>
        </g>
      ))}

      {/* Perfect calibration diagonal */}
      <line
        x1={toX(0)}
        y1={toY(0)}
        x2={toX(1)}
        y2={toY(1)}
        stroke="var(--surface-highlight)"
        strokeWidth={1}
        strokeDasharray="6 4"
      />

      {/* Calibration line from slope/intercept */}
      {(() => {
        const y0 = intercept;
        const y1 = intercept + slope;
        const clampedY0 = Math.max(0, Math.min(1, y0));
        const clampedY1 = Math.max(0, Math.min(1, y1));
        return (
          <line
            x1={toX(0)}
            y1={toY(clampedY0)}
            x2={toX(1)}
            y2={toY(clampedY1)}
            stroke="var(--accent)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.7}
          />
        );
      })()}

      {/* Data points */}
      {data.map((pt, idx) => (
        <g key={idx}>
          <circle
            cx={toX(pt.predicted)}
            cy={toY(pt.observed)}
            r={5}
            fill="var(--success)"
            stroke="var(--surface-base)"
            strokeWidth={1.5}
            opacity={0.9}
          />
        </g>
      ))}

      {/* Plot boundary */}
      <rect
        x={padding.left}
        y={padding.top}
        width={plotW}
        height={plotH}
        fill="none"
        stroke="var(--surface-highlight)"
        strokeWidth={1}
      />

      {/* Slope/Intercept Annotation */}
      <rect
        x={padding.left + 8}
        y={padding.top + 8}
        width={130}
        height={40}
        rx={4}
        fill="var(--surface-base)"
        stroke="var(--surface-elevated)"
        strokeWidth={1}
      />
      <text
        x={padding.left + 16}
        y={padding.top + 24}
        fill="var(--accent)"
        fontSize={10}
        fontFamily="IBM Plex Mono, monospace"
      >
        {t("analyses.auto.slopeValue_6534ca", { value: fmt(slope) })}
      </text>
      <text
        x={padding.left + 16}
        y={padding.top + 40}
        fill="var(--accent)"
        fontSize={10}
        fontFamily="IBM Plex Mono, monospace"
      >
        {t("analyses.auto.interceptValue_12e39b", { value: fmt(intercept) })}
      </text>

      {/* ICI and E-max Annotation */}
      <rect
        x={padding.left + plotW - 120}
        y={padding.top + 8}
        width={112}
        height={40}
        rx={4}
        fill="var(--surface-base)"
        stroke="var(--surface-elevated)"
        strokeWidth={1}
        data-testid="ici-emax-annotation"
      />
      <text
        x={padding.left + plotW - 112}
        y={padding.top + 24}
        fill="var(--success)"
        fontSize={10}
        fontFamily="IBM Plex Mono, monospace"
        data-testid="ici-value"
      >
        ICI: {fmt(calibrationMetrics.ici, 4)}
      </text>
      <text
        x={padding.left + plotW - 112}
        y={padding.top + 40}
        fill="var(--critical)"
        fontSize={10}
        fontFamily="IBM Plex Mono, monospace"
        data-testid="emax-value"
      >
        {t("analyses.auto.eMaxValue_398d9f", {
          value: fmt(calibrationMetrics.emax, 4),
        })}
      </text>

      {/* Decile population bars (marginal histogram) */}
      {decileBins.length > 0 && (
        <g data-testid="decile-bars">
          {decileBins.map((bin, i) => {
            const barX = toX(bin.binStart) + 1;
            const barW = Math.max(1, toX(bin.binEnd) - toX(bin.binStart) - 2);
            const barH = maxBinCount > 0 ? (bin.count / maxBinCount) * (barAreaH - 4) : 0;
            return (
              <rect
                key={i}
                x={barX}
                y={barAreaTop + (barAreaH - 4) - barH}
                width={barW}
                height={barH}
                fill="var(--success)"
                opacity={0.3}
                rx={1}
              />
            );
          })}
          <text
            x={padding.left + plotW / 2}
            y={barAreaTop + barAreaH + 4}
            textAnchor="middle"
            fill="var(--text-ghost)"
            fontSize={8}
          >
            {t(
              "analyses.auto.patientCountPerPredictedProbabilityBin_74a916",
            )}
          </text>
        </g>
      )}

      {/* Axis labels */}
      <text
        x={padding.left + plotW / 2}
        y={barAreaTop - 6}
        textAnchor="middle"
        fill="var(--text-muted)"
        fontSize={11}
        fontWeight={600}
          >
            {t("analyses.auto.predictedProbability_81f385")}
          </text>
      <text
        x={14}
        y={padding.top + plotH / 2}
        textAnchor="middle"
        fill="var(--text-muted)"
        fontSize={11}
        fontWeight={600}
        transform={`rotate(-90 14 ${padding.top + plotH / 2})`}
          >
            {t("analyses.auto.observedProbability_d35356")}
          </text>
    </svg>
  );
}
