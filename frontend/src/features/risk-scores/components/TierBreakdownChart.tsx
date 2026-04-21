import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { RiskScoreTier } from "../types/riskScore";
import { TIER_COLORS, TIER_ORDER } from "../types/riskScore";
import { getRiskScoreTierLabel } from "../lib/i18n";

interface TierBreakdownChartProps {
  tiers: RiskScoreTier[];
  onTierClick?: (tier: string) => void;
}

export function TierBreakdownChart({
  tiers,
  onTierClick,
}: TierBreakdownChartProps) {
  const { t } = useTranslation("app");

  const sorted = [...tiers].sort((left, right) => {
    const leftIndex = TIER_ORDER.indexOf(
      left.risk_tier as (typeof TIER_ORDER)[number],
    );
    const rightIndex = TIER_ORDER.indexOf(
      right.risk_tier as (typeof TIER_ORDER)[number],
    );
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });

  const totalPatients = sorted.reduce(
    (sum, tier) => sum + tier.patient_count,
    0,
  );

  const stackedData = [
    sorted.reduce((acc, tier) => {
      acc[tier.risk_tier] = tier.patient_count;
      return acc;
    }, {} as Record<string, number>),
  ];

  return (
    <div className="space-y-4">
      {totalPatients > 0 && (
        <div>
          <p className="mb-2 text-xs text-text-muted">
            {t("riskScores.tierBreakdown.tierDistribution")}
          </p>
          <div className="flex h-6 w-full overflow-hidden rounded-lg bg-surface-overlay">
            {sorted.map((tier) => {
              const pct = (tier.patient_count / totalPatients) * 100;
              if (pct < 0.3) return null;
              return (
                <div
                  key={tier.risk_tier}
                  className="h-full cursor-pointer transition-all duration-300 hover:opacity-80"
                  style={{
                    width: `${pct}%`,
                    backgroundColor:
                      TIER_COLORS[tier.risk_tier] ?? TIER_COLORS.uncomputable,
                  }}
                  title={`${getRiskScoreTierLabel(t, tier.risk_tier)}: ${tier.patient_count.toLocaleString()} (${pct.toFixed(1)}%)`}
                  onClick={() => onTierClick?.(tier.risk_tier)}
                />
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-4">
            {sorted.map((tier) => (
              <div
                key={tier.risk_tier}
                className="flex items-center gap-1.5 text-[10px] text-text-muted"
              >
                <div
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      TIER_COLORS[tier.risk_tier] ?? TIER_COLORS.uncomputable,
                  }}
                />
                {getRiskScoreTierLabel(t, tier.risk_tier)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs text-text-muted">
          {t("riskScores.tierBreakdown.patientsPerTier")}
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={sorted.map((tier) => ({
              name: getRiskScoreTierLabel(t, tier.risk_tier),
              tier: tier.risk_tier,
              count: tier.patient_count,
            }))}
            margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
          >
            <XAxis
              dataKey="name"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--surface-accent)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--surface-accent)" }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface-raised)",
                border: "1px solid #2A2A2F",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--text-primary)" }}
              formatter={
                ((value: number) => [
                  value.toLocaleString(),
                  t("riskScores.tierBreakdown.patients"),
                ]) as never
              }
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={(entry: unknown) => {
                const data = entry as { tier?: string };
                if (data.tier) onTierClick?.(data.tier);
              }}
            >
              {sorted.map((tier) => (
                <Cell
                  key={tier.risk_tier}
                  fill={TIER_COLORS[tier.risk_tier] ?? TIER_COLORS.uncomputable}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-hidden rounded-xl border border-border-default">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-default bg-surface-base">
              <th className="px-3 py-2 text-left font-medium text-text-muted">
                {t("riskScores.common.headers.tier")}
              </th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">
                {t("riskScores.common.headers.count")}
              </th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">
                %
              </th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">
                {t("riskScores.common.headers.meanScore")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((tier) => {
              const pct =
                totalPatients > 0 ? (tier.patient_count / totalPatients) * 100 : 0;
              return (
                <tr
                  key={tier.risk_tier}
                  className="cursor-pointer border-b border-border-default/50 transition-colors last:border-b-0 hover:bg-surface-overlay"
                  onClick={() => onTierClick?.(tier.risk_tier)}
                >
                  <td className="px-3 py-2 text-text-primary">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            TIER_COLORS[tier.risk_tier] ?? TIER_COLORS.uncomputable,
                        }}
                      />
                      {getRiskScoreTierLabel(t, tier.risk_tier)}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-secondary">
                    {tier.patient_count.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-muted">
                    {pct.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right font-['IBM_Plex_Mono',monospace] text-text-secondary">
                    {tier.mean_score != null ? Number(tier.mean_score).toFixed(1) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {stackedData.length > 0 && totalPatients > 0 && (
        <div className="hidden">
          <ResponsiveContainer width="100%" height={40}>
            <BarChart
              data={stackedData}
              layout="vertical"
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" hide />
              {sorted.map((tier) => (
                <Bar
                  key={tier.risk_tier}
                  dataKey={tier.risk_tier}
                  stackId="tier"
                  fill={TIER_COLORS[tier.risk_tier] ?? TIER_COLORS.uncomputable}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
