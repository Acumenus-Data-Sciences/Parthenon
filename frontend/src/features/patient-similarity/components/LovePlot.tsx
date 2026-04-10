import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { CovariateBalanceRow } from "../types/patientSimilarity";

interface LovePlotProps {
  covariates: CovariateBalanceRow[];
}

const THRESHOLD = 0.1;
const DEFAULT_SHOW = 20;
const ROW_HEIGHT = 22;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = 600;
const TEAL = "#2DD4BF";
const CRIMSON = "#9B1B30";

export function LovePlot({ covariates }: LovePlotProps) {
  const [showAll, setShowAll] = useState(false);

  const sorted = [...covariates].sort(
    (a, b) => Math.abs(b.smd) - Math.abs(a.smd),
  );

  const displayed = showAll ? sorted : sorted.slice(0, DEFAULT_SHOW);
  const chartData = displayed.map((row) => ({
    covariate:
      row.covariate.length > 30
        ? row.covariate.slice(0, 28) + "..."
        : row.covariate,
    fullName: row.covariate,
    absSmd: Math.abs(row.smd),
    smd: row.smd,
    domain: row.domain,
    type: row.type,
  }));

  // Reverse so highest SMD is at top (BarChart vertical renders bottom-up)
  const reversedData = [...chartData].reverse();

  const chartHeight = Math.min(
    MAX_HEIGHT,
    Math.max(MIN_HEIGHT, reversedData.length * ROW_HEIGHT + 40),
  );

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[#F0EDE8]">
        Covariate Balance (Love Plot)
      </h3>
      <p className="mb-3 text-xs text-[#8A857D]">
        Standardized Mean Difference (|SMD|) per covariate. Covariates below 0.1
        (teal) are considered balanced.
      </p>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={reversedData}
          layout="vertical"
          margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
        >
          <XAxis
            type="number"
            domain={[0, "auto"]}
            tick={{ fill: "#8A857D", fontSize: 10 }}
            axisLine={{ stroke: "#323238" }}
            tickLine={{ stroke: "#323238" }}
            label={{
              value: "|SMD|",
              position: "insideBottomRight",
              offset: -5,
              fill: "#5A5650",
              fontSize: 10,
            }}
          />
          <YAxis
            type="category"
            dataKey="covariate"
            width={180}
            tick={{ fill: "#8A857D", fontSize: 10 }}
            axisLine={{ stroke: "#323238" }}
            tickLine={false}
          />
          <ReferenceLine
            x={THRESHOLD}
            stroke="#5A5650"
            strokeDasharray="4 4"
            label={{
              value: "0.1",
              position: "top",
              fill: "#5A5650",
              fontSize: 10,
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1A1A1F",
              border: "1px solid #323238",
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: "#F0EDE8" }}
            formatter={
              ((value: number, _name: string, entry: { payload: { fullName: string; domain: string; type: string } }) => [
                `|SMD|: ${value.toFixed(4)} (${entry.payload.domain}, ${entry.payload.type})`,
                entry.payload.fullName,
              ]) as never
            }
          />
          <Bar dataKey="absSmd" radius={[0, 3, 3, 0]} barSize={14}>
            {reversedData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.absSmd < THRESHOLD ? TEAL : CRIMSON}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {sorted.length > DEFAULT_SHOW && (
        <button
          type="button"
          onClick={() => setShowAll((prev) => !prev)}
          className="mt-2 text-xs text-[#2DD4BF] hover:text-[#2DD4BF]/80 transition-colors"
        >
          {showAll
            ? `Show top ${DEFAULT_SHOW}`
            : `Show all (${sorted.length})`}
        </button>
      )}
    </div>
  );
}
