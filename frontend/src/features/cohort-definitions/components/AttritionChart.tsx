import { useMemo } from "react";
import { Panel, EmptyState } from "@/components/ui";
import { BarChart2 } from "lucide-react";

export interface AttritionStep {
  name: string;
  personCount: number;
  personPercent: number;
}

interface AttritionChartProps {
  steps: AttritionStep[] | null;
  totalCount: number | null;
}

export function AttritionChart({ steps, totalCount }: AttritionChartProps) {
  const bars = useMemo(() => {
    if (!steps || steps.length === 0 || !totalCount) return [];
    return steps.map((step, i) => ({
      ...step,
      dropCount: i === 0 ? 0 : steps[i - 1].personCount - step.personCount,
      widthPercent: totalCount > 0 ? (step.personCount / totalCount) * 100 : 0,
    }));
  }, [steps, totalCount]);

  if (!steps || steps.length === 0) {
    return (
      <Panel header={<span className="panel-title">Inclusion Rule Attrition</span>}>
        <EmptyState
          icon={<BarChart2 size={32} />}
          title="No attrition data"
          message="Generate the cohort to see inclusion rule attrition statistics."
        />
      </Panel>
    );
  }

  return (
    <Panel header={<span className="panel-title">Inclusion Rule Attrition</span>}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        {bars.map((bar, i) => (
          <div key={i}>
            {/* Step label */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: "var(--space-1)",
            }}>
              <span style={{
                fontSize: "var(--text-sm)",
                color: i === 0 ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: i === 0 ? 600 : 400,
              }}>
                {i === 0 ? "Initial Events" : bar.name}
              </span>
              <span style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-sm)",
                  color: "var(--text-primary)",
                  fontWeight: 500,
                }}>
                  {bar.personCount.toLocaleString()}
                </span>
                {i > 0 && bar.dropCount > 0 && (
                  <span style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--critical)",
                  }}>
                    -{bar.dropCount.toLocaleString()}
                  </span>
                )}
              </span>
            </div>

            {/* Bar */}
            <div style={{
              height: 24,
              background: "var(--surface-overlay)",
              borderRadius: "var(--radius-sm)",
              overflow: "hidden",
              position: "relative",
            }}>
              <div
                style={{
                  height: "100%",
                  width: `${bar.widthPercent}%`,
                  background: i === 0
                    ? "var(--primary)"
                    : `color-mix(in srgb, var(--primary) ${100 - i * 10}%, var(--info))`,
                  borderRadius: "var(--radius-sm)",
                  transition: "width var(--duration-slow) var(--ease-out)",
                  minWidth: bar.widthPercent > 0 ? 4 : 0,
                }}
              />
              {/* Percentage label inside bar */}
              <span style={{
                position: "absolute",
                right: "var(--space-2)",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "var(--text-xs)",
                fontFamily: "var(--font-mono)",
                color: bar.widthPercent > 20 ? "var(--text-primary)" : "var(--text-muted)",
              }}>
                {bar.personPercent.toFixed(1)}%
              </span>
            </div>

            {/* Connector line between bars */}
            {i < bars.length - 1 && (
              <div style={{
                marginLeft: "var(--space-4)",
                borderLeft: "2px solid var(--border-subtle)",
                height: "var(--space-2)",
              }} />
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
