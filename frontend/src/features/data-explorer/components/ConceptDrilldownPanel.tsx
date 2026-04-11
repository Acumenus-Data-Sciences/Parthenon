import { X, Loader2, Hash } from "lucide-react";
import { useConceptDrilldown } from "../hooks/useAchillesData";
import { TemporalTrendChart } from "./charts/TemporalTrendChart";
import { BoxPlotChart } from "./charts/BoxPlotChart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ConceptDrilldownPanelProps {
  sourceId: number;
  domain: string;
  conceptId: number;
  onClose?: () => void;
}

/** Format large numbers compactly */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const GENDER_COLORS: Record<string, string> = {
  Male: "var(--info)",
  MALE: "var(--info)",
  male: "var(--info)",
  Female: "var(--critical)",
  FEMALE: "var(--critical)",
  female: "var(--critical)",
};
const DEFAULT_COLOR = "var(--text-muted)";

function MiniTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { concept_name: string; count: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-surface-highlight bg-surface-overlay px-3 py-2 shadow-lg">
      <p className="text-xs text-text-primary">{item.concept_name}</p>
      <p className="font-['IBM_Plex_Mono',monospace] text-xs text-success">
        {item.count.toLocaleString()}
      </p>
    </div>
  );
}

export function ConceptDrilldownPanel({
  sourceId,
  domain,
  conceptId,
  onClose,
}: ConceptDrilldownPanelProps) {
  const { data, isLoading, error } = useConceptDrilldown(
    sourceId,
    domain,
    conceptId,
  );

  return (
    <div className="flex h-full flex-col border-l border-border-default bg-surface-base">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default bg-surface-raised px-5 py-3">
        <div className="min-w-0 flex-1">
          {data ? (
            <>
              <h3 className="truncate text-sm font-semibold text-text-primary">
                {data.concept_name}
              </h3>
              <div className="mt-0.5 flex items-center gap-1.5">
                <Hash size={11} className="text-text-muted" />
                <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-muted">
                  {data.concept_id}
                </span>
              </div>
            </>
          ) : (
            <h3 className="text-sm font-semibold text-text-primary">
              Concept Details
            </h3>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-2 rounded-md p-1.5 text-text-muted hover:bg-surface-elevated hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-critical">Failed to load concept details</p>
          </div>
        )}

        {data && (
          <>
            {/* Gender split */}
            {data.genderSplit.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Gender Distribution
                </h4>
                <div className="flex h-5 overflow-hidden rounded-full bg-surface-elevated">
                  {(() => {
                    const total = data.genderSplit.reduce(
                      (s, d) => s + d.count,
                      0,
                    );
                    return data.genderSplit.map((g, idx) => (
                      <div
                        key={idx}
                        className="transition-all"
                        style={{
                          width: `${total > 0 ? (g.count / total) * 100 : 0}%`,
                          backgroundColor:
                            GENDER_COLORS[g.concept_name] ?? DEFAULT_COLOR,
                        }}
                        title={`${g.concept_name}: ${g.count.toLocaleString()}`}
                      />
                    ));
                  })()}
                </div>
                <div className="mt-1.5 flex items-center gap-4">
                  {data.genderSplit.map((g, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <div
                        className="h-2 w-2 rounded-sm"
                        style={{
                          backgroundColor:
                            GENDER_COLORS[g.concept_name] ?? DEFAULT_COLOR,
                        }}
                      />
                      <span className="text-xs text-text-secondary">
                        {g.concept_name}
                      </span>
                      <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-muted">
                        {formatCompact(g.count)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Temporal trend */}
            {data.temporalTrend.length > 0 && (
              <TemporalTrendChart
                data={data.temporalTrend}
                title="Temporal Trend"
              />
            )}

            {/* Type distribution */}
            {data.typeDistribution.length > 0 && (
              <div className="rounded-xl border border-border-default bg-surface-raised p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Type Distribution
                </h4>
                <ResponsiveContainer width="100%" height={data.typeDistribution.length * 30 + 20}>
                  <BarChart
                    data={data.typeDistribution}
                    layout="vertical"
                    margin={{ top: 0, right: 30, bottom: 0, left: 0 }}
                  >
                    <XAxis
                      type="number"
                      tickFormatter={formatCompact}
                      tick={{ fill: "var(--text-primary)", fontSize: 10 }}
                      axisLine={{ stroke: "var(--border-default)" }}
                      tickLine={{ stroke: "var(--border-default)" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="concept_name"
                      width={160}
                      tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<MiniTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={18}>
                      {data.typeDistribution.map((_, idx) => (
                        <Cell key={idx} fill="var(--accent)" fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Age distribution box plot */}
            {data.ageDistribution && (
              <BoxPlotChart
                data={data.ageDistribution}
                label="Age at First Occurrence"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
