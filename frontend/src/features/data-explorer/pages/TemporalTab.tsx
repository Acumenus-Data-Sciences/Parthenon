import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { useTemporalTrends } from "../hooks/useAchillesData";
import type { Domain } from "../types/dataExplorer";
import { DOMAIN_LABELS } from "../types/dataExplorer";

interface TemporalTabProps {
  sourceId: number;
}

const DOMAINS: Domain[] = [
  "condition",
  "drug",
  "procedure",
  "measurement",
  "observation",
  "visit",
];

const DOMAIN_COLORS: Record<Domain, string> = {
  condition: "#2DD4BF",
  drug: "#C9A227",
  procedure: "#60A5FA",
  measurement: "#A855F7",
  observation: "#E5A84B",
  visit: "#E85A6B",
};

/** Format year_month "2020-01" to "Jan 2020" */
function formatMonth(ym: string): string {
  const [year, month] = ym.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Format large numbers compactly */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function MultiLineTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#323238] bg-[#1A1A1E] px-3 py-2 shadow-lg">
      <p className="text-xs text-[#8A857D] mb-1">
        {label ? formatMonth(label) : ""}
      </p>
      {payload.map((p, idx) => (
        <p
          key={idx}
          className="font-['IBM_Plex_Mono',monospace] text-xs"
          style={{ color: p.color }}
        >
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export default function TemporalTab({ sourceId }: TemporalTabProps) {
  const [enabledDomains, setEnabledDomains] = useState<Set<Domain>>(
    new Set(["condition", "drug", "procedure"]),
  );

  // Call hooks unconditionally for all domains (rules-of-hooks requirement),
  // then filter by enabled state during rendering.
  const conditionTrends = useTemporalTrends(sourceId, enabledDomains.has("condition") ? "condition" : "");
  const drugTrends = useTemporalTrends(sourceId, enabledDomains.has("drug") ? "drug" : "");
  const procedureTrends = useTemporalTrends(sourceId, enabledDomains.has("procedure") ? "procedure" : "");
  const measurementTrends = useTemporalTrends(sourceId, enabledDomains.has("measurement") ? "measurement" : "");
  const observationTrends = useTemporalTrends(sourceId, enabledDomains.has("observation") ? "observation" : "");
  const visitTrends = useTemporalTrends(sourceId, enabledDomains.has("visit") ? "visit" : "");

  const trendQueries = useMemo(() => [
    { domain: "condition" as Domain, ...conditionTrends },
    { domain: "drug" as Domain, ...drugTrends },
    { domain: "procedure" as Domain, ...procedureTrends },
    { domain: "measurement" as Domain, ...measurementTrends },
    { domain: "observation" as Domain, ...observationTrends },
    { domain: "visit" as Domain, ...visitTrends },
  ], [conditionTrends, drugTrends, procedureTrends, measurementTrends, observationTrends, visitTrends]);

  const toggleDomain = (domain: Domain) => {
    setEnabledDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  // Merge all domain data into a single series with one row per year_month
  const mergedData = useMemo(() => {
    const map = new Map<string, Record<string, number>>();

    for (const tq of trendQueries) {
      if (!enabledDomains.has(tq.domain) || !tq.data) continue;
      for (const point of tq.data) {
        if (!map.has(point.year_month)) {
          map.set(point.year_month, { year_month_sort: 0 });
        }
        map.get(point.year_month)![tq.domain] = point.count;
      }
    }

    return Array.from(map.entries())
      .map(([ym, counts]) => ({ year_month: ym, ...counts }))
      .sort((a, b) => a.year_month.localeCompare(b.year_month));
  }, [trendQueries, enabledDomains]);

  const isAnyLoading = trendQueries.some(
    (tq) => enabledDomains.has(tq.domain) && tq.isLoading,
  );

  const tickInterval = Math.max(1, Math.floor(mergedData.length / 12));

  return (
    <div className="space-y-6">
      {/* Domain checkboxes */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
          Domains:
        </span>
        {DOMAINS.map((domain) => (
          <label
            key={domain}
            className="flex items-center gap-2 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={enabledDomains.has(domain)}
              onChange={() => toggleDomain(domain)}
              className="sr-only"
            />
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                enabledDomains.has(domain)
                  ? "border border-transparent"
                  : "border border-[#323238] text-[#5A5650]",
              )}
              style={
                enabledDomains.has(domain)
                  ? {
                      backgroundColor: `${DOMAIN_COLORS[domain]}15`,
                      color: DOMAIN_COLORS[domain],
                      borderColor: `${DOMAIN_COLORS[domain]}40`,
                    }
                  : undefined
              }
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: enabledDomains.has(domain)
                    ? DOMAIN_COLORS[domain]
                    : "#5A5650",
                }}
              />
              {DOMAIN_LABELS[domain]}
            </div>
          </label>
        ))}
      </div>

      {/* Loading */}
      {isAnyLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-[#8A857D]" />
        </div>
      )}

      {/* Chart */}
      {mergedData.length > 0 && (
        <div className="rounded-xl border border-[#232328] bg-[#151518] p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#8A857D]">
            Multi-Domain Temporal Overlay
          </h3>
          <ResponsiveContainer width="100%" height={360}>
            <LineChart
              data={mergedData}
              margin={{ top: 8, right: 20, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#323238"
                vertical={false}
              />
              <XAxis
                dataKey="year_month"
                tickFormatter={formatMonth}
                interval={tickInterval}
                tick={{ fill: "#F0EDE8", fontSize: 10 }}
                axisLine={{ stroke: "#323238" }}
                tickLine={{ stroke: "#323238" }}
              />
              <YAxis
                tickFormatter={formatCompact}
                tick={{ fill: "#F0EDE8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip content={<MultiLineTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: 12 }}
                formatter={(value: string) => (
                  <span className="text-xs text-[#C5C0B8]">{value}</span>
                )}
              />
              {DOMAINS.filter((d) => enabledDomains.has(d)).map((domain) => (
                <Line
                  key={domain}
                  type="monotone"
                  dataKey={domain}
                  name={DOMAIN_LABELS[domain]}
                  stroke={DOMAIN_COLORS[domain]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: DOMAIN_COLORS[domain],
                    stroke: "#151518",
                    strokeWidth: 2,
                  }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Empty state */}
      {!isAnyLoading && mergedData.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#151518] py-16">
          <p className="text-sm text-[#8A857D]">No temporal data available</p>
          <p className="mt-1 text-xs text-[#5A5650]">
            Select domains above and ensure Achilles has been run
          </p>
        </div>
      )}
    </div>
  );
}
