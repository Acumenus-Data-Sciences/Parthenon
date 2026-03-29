import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import type { RiskScoreTier } from "../types/riskScore";
import { TIER_COLORS, TIER_ORDER } from "../types/riskScore";

interface TierBreakdownChartProps {
  tiers: RiskScoreTier[];
  onTierClick?: (tier: string) => void;
}

function tierLabel(tier: string): string {
  return tier
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TierBreakdownChart({
  tiers,
  onTierClick,
}: TierBreakdownChartProps) {
  // Sort by TIER_ORDER
  const sorted = [...tiers].sort((a, b) => {
    const ai = TIER_ORDER.indexOf(
      a.risk_tier as (typeof TIER_ORDER)[number],
    );
    const bi = TIER_ORDER.indexOf(
      b.risk_tier as (typeof TIER_ORDER)[number],
    );
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const totalPatients = sorted.reduce(
    (sum, t) => sum + t.patient_count,
    0,
  );

  // Horizontal stacked bar data
  const stackedData = [
    sorted.reduce(
      (acc, t) => {
        acc[t.risk_tier] = t.patient_count;
        return acc;
      },
      {} as Record<string, number>,
    ),
  ];

  return (
    <div className="space-y-4">
      {/* Horizontal stacked tier distribution bar */}
      {totalPatients > 0 && (
        <div>
          <p className="text-xs text-[#8A857D] mb-2">
            Tier Distribution
          </p>
          <div className="flex h-6 w-full overflow-hidden rounded-lg bg-[#1A1A1F]">
            {sorted.map((t) => {
              const pct = (t.patient_count / totalPatients) * 100;
              if (pct < 0.3) return null;
              return (
                <div
                  key={t.risk_tier}
                  className="h-full transition-all duration-300 cursor-pointer hover:opacity-80"
                  style={{
                    width: `${pct}%`,
                    backgroundColor:
                      TIER_COLORS[t.risk_tier] ??
                      TIER_COLORS.uncomputable,
                  }}
                  title={`${tierLabel(t.risk_tier)}: ${t.patient_count.toLocaleString()} (${pct.toFixed(1)}%)`}
                  onClick={() => onTierClick?.(t.risk_tier)}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-2">
            {sorted.map((t) => (
              <div
                key={t.risk_tier}
                className="flex items-center gap-1.5 text-[10px] text-[#8A857D]"
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      TIER_COLORS[t.risk_tier] ??
                      TIER_COLORS.uncomputable,
                  }}
                />
                {tierLabel(t.risk_tier)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bar chart: patient counts per tier */}
      <div>
        <p className="text-xs text-[#8A857D] mb-2">
          Patients per Tier
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={sorted.map((t) => ({
              name: tierLabel(t.risk_tier),
              tier: t.risk_tier,
              count: t.patient_count,
            }))}
            margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
          >
            <XAxis
              dataKey="name"
              tick={{ fill: "#8A857D", fontSize: 11 }}
              axisLine={{ stroke: "#2A2A2F" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#8A857D", fontSize: 11 }}
              axisLine={{ stroke: "#2A2A2F" }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#141418",
                border: "1px solid #2A2A2F",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#F0EDE8" }}
              formatter={
                ((value: number) => [
                  value.toLocaleString(),
                  "Patients",
                ]) as never
              }
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={(entry: { tier?: string }) => {
                if (entry.tier) onTierClick?.(entry.tier);
              }}
            >
              {sorted.map((t) => (
                <Cell
                  key={t.risk_tier}
                  fill={
                    TIER_COLORS[t.risk_tier] ??
                    TIER_COLORS.uncomputable
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="overflow-hidden rounded-xl border border-[#2A2A2F]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#2A2A2F] bg-[#0E0E11]">
              <th className="px-3 py-2 text-left text-[#8A857D] font-medium">
                Tier
              </th>
              <th className="px-3 py-2 text-right text-[#8A857D] font-medium">
                Count
              </th>
              <th className="px-3 py-2 text-right text-[#8A857D] font-medium">
                %
              </th>
              <th className="px-3 py-2 text-right text-[#8A857D] font-medium">
                Mean Score
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const pct =
                totalPatients > 0
                  ? (t.patient_count / totalPatients) * 100
                  : 0;
              return (
                <tr
                  key={t.risk_tier}
                  className="border-b border-[#2A2A2F]/50 last:border-b-0 hover:bg-[#1A1A1F] cursor-pointer transition-colors"
                  onClick={() => onTierClick?.(t.risk_tier)}
                >
                  <td className="px-3 py-2 text-[#F0EDE8]">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            TIER_COLORS[t.risk_tier] ??
                            TIER_COLORS.uncomputable,
                        }}
                      />
                      {tierLabel(t.risk_tier)}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-[#C5C0B8]">
                    {t.patient_count.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                    {pct.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-[#C5C0B8]">
                    {t.mean_score != null
                      ? Number(t.mean_score).toFixed(1)
                      : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stacked bar (Recharts) for machine-readable completeness */}
      {stackedData.length > 0 && totalPatients > 0 && (
        <div className="hidden">
          {/* Hidden stacked bar for potential future use / accessibility */}
          <ResponsiveContainer width="100%" height={40}>
            <BarChart
              data={stackedData}
              layout="vertical"
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" hide />
              {sorted.map((t) => (
                <Bar
                  key={t.risk_tier}
                  dataKey={t.risk_tier}
                  stackId="tier"
                  fill={
                    TIER_COLORS[t.risk_tier] ??
                    TIER_COLORS.uncomputable
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
