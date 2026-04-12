import type { ValidationMetrics } from "../types/prediction";
import { fmt, num } from "@/lib/formatters";

interface ExternalValidationComparisonProps {
  development: ValidationMetrics;
  validations: ValidationMetrics[];
}

function aucColor(auc: number): string {
  if (auc >= 0.7) return "#2DD4BF";
  if (auc >= 0.6) return "#C9A227";
  return "#E85A6B";
}

function calSlopeColor(slope: number): string {
  if (slope >= 0.8 && slope <= 1.2) return "#2DD4BF";
  if (slope >= 0.6 && slope <= 1.4) return "#C9A227";
  return "#E85A6B";
}

export function ExternalValidationComparison({
  development,
  validations,
}: ExternalValidationComparisonProps) {
  const allDatabases = [development, ...validations];

  // --- AUC Forest Plot ---
  const width = 600;
  const rowHeight = 32;
  const padding = { top: 30, right: 80, bottom: 30, left: 160 };
  const plotW = width - padding.left - padding.right;
  const plotH = allDatabases.length * rowHeight;
  const height = padding.top + plotH + padding.bottom;

  const xMin = 0.4;
  const xMax = 1.0;
  const toX = (v: number) => padding.left + ((v - xMin) / (xMax - xMin)) * plotW;
  const xTicks = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

  return (
    <div className="space-y-4">
      {/* AUC Forest Plot */}
      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="text-[#F0EDE8]"
          role="img"
          aria-label="External validation AUC forest plot"
        >
          <rect width={width} height={height} fill="#151518" rx={8} />

          {/* Grid lines and x-axis ticks */}
          {xTicks.map((v) => (
            <g key={v}>
              <line
                x1={toX(v)}
                y1={padding.top}
                x2={toX(v)}
                y2={padding.top + plotH}
                stroke="#232328"
                strokeWidth={0.5}
              />
              <text
                x={toX(v)}
                y={padding.top + plotH + 16}
                textAnchor="middle"
                fill="#5A5650"
                fontSize={10}
              >
                {v.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Random classifier line at 0.5 */}
          <line
            x1={toX(0.5)}
            y1={padding.top}
            x2={toX(0.5)}
            y2={padding.top + plotH}
            stroke="#5A5650"
            strokeWidth={1}
            strokeDasharray="4 4"
          />

          {/* Database rows */}
          {allDatabases.map((db, i) => {
            const y = padding.top + i * rowHeight + rowHeight / 2;
            const isDev = i === 0;
            const color = isDev ? "#2DD4BF" : "#C9A227";
            const ciLeft = Math.max(db.auc_ci_lower, xMin);
            const ciRight = Math.min(db.auc_ci_upper, xMax);
            const aucClamped = Math.max(Math.min(db.auc, xMax), xMin);

            return (
              <g key={db.database_name}>
                {/* Row background on hover */}
                {i % 2 === 1 && (
                  <rect
                    x={0}
                    y={padding.top + i * rowHeight}
                    width={width}
                    height={rowHeight}
                    fill="#1A1A1E"
                  />
                )}

                {/* Database label */}
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill={isDev ? "#2DD4BF" : "#C5C0B8"}
                  fontSize={11}
                  fontWeight={isDev ? 600 : 400}
                >
                  {db.database_name.length > 20
                    ? db.database_name.slice(0, 20) + "..."
                    : db.database_name}
                </text>

                {/* CI whisker */}
                <line
                  x1={toX(ciLeft)}
                  y1={y}
                  x2={toX(ciRight)}
                  y2={y}
                  stroke={color}
                  strokeWidth={1.5}
                  opacity={0.7}
                />

                {/* CI caps */}
                <line x1={toX(ciLeft)} y1={y - 5} x2={toX(ciLeft)} y2={y + 5} stroke={color} strokeWidth={1.5} />
                <line x1={toX(ciRight)} y1={y - 5} x2={toX(ciRight)} y2={y + 5} stroke={color} strokeWidth={1.5} />

                {/* AUC diamond */}
                <polygon
                  points={`${toX(aucClamped)},${y - 6} ${toX(aucClamped) + 5},${y} ${toX(aucClamped)},${y + 6} ${toX(aucClamped) - 5},${y}`}
                  fill={color}
                  stroke="#151518"
                  strokeWidth={0.5}
                />

                {/* AUC value label */}
                <text
                  x={width - padding.right + 10}
                  y={y + 4}
                  fill={aucColor(db.auc)}
                  fontSize={10}
                  fontFamily="IBM Plex Mono, monospace"
                  fontWeight={600}
                >
                  {fmt(db.auc)}
                </text>
              </g>
            );
          })}

          {/* Plot boundary */}
          <rect
            x={padding.left}
            y={padding.top}
            width={plotW}
            height={plotH}
            fill="none"
            stroke="#323238"
            strokeWidth={1}
          />

          {/* X-axis label */}
          <text
            x={padding.left + plotW / 2}
            y={height - 6}
            textAnchor="middle"
            fill="#8A857D"
            fontSize={11}
            fontWeight={600}
          >
            AUC
          </text>
        </svg>
      </div>

      {/* Metrics Comparison Table */}
      <div className="rounded-lg border border-[#232328] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#1C1C20]">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Database
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Population
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Outcomes
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                AUC (95% CI)
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Brier
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Cal. Slope
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Cal. Intercept
              </th>
            </tr>
          </thead>
          <tbody>
            {allDatabases.map((db, i) => {
              const isDev = i === 0;
              return (
                <tr
                  key={db.database_name}
                  className={i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]"}
                  style={isDev ? { borderLeft: "3px solid #2DD4BF" } : undefined}
                >
                  <td className="px-4 py-3 text-sm">
                    <span className={isDev ? "text-[#2DD4BF] font-semibold" : "text-[#F0EDE8]"}>
                      {db.database_name}
                    </span>
                    {isDev && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#2DD4BF]/10 text-[#2DD4BF]">
                        DEV
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                    {num(db.population_size).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                    {num(db.outcome_count).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs">
                    <span style={{ color: aucColor(db.auc) }}>
                      {fmt(db.auc)}
                    </span>
                    <span className="text-[#5A5650] ml-1">
                      ({fmt(db.auc_ci_lower, 2)}-{fmt(db.auc_ci_upper, 2)})
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                    {fmt(db.brier_score, 4)}
                  </td>
                  <td className="px-3 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs">
                    <span style={{ color: calSlopeColor(db.calibration_slope) }}>
                      {fmt(db.calibration_slope)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                    {fmt(db.calibration_intercept)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
