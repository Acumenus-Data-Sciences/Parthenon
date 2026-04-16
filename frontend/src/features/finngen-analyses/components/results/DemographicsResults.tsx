// frontend/src/features/finngen-analyses/components/results/DemographicsResults.tsx
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DemographicsDisplay } from "../../types";
import { Users, BarChart3 } from "lucide-react";

interface DemographicsResultsProps {
  display: DemographicsDisplay;
}

export function DemographicsResults({ display }: DemographicsResultsProps) {
  const [selectedCohortIdx, setSelectedCohortIdx] = useState(0);

  const cohort = display.cohorts[selectedCohortIdx];

  const pyramidData = useMemo(() => {
    if (!cohort) return [];
    return cohort.age_histogram
      .sort((a, b) => a.decile - b.decile)
      .map((bin) => ({
        decile: `${bin.decile * 10}-${bin.decile * 10 + 9}`,
        male: -bin.male,
        female: bin.female,
      }));
  }, [cohort]);

  if (display.cohorts.length === 0 || !cohort) {
    return (
      <div className="py-12 text-center text-sm text-text-ghost">
        No demographic data available.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cohort selector (if multiple) */}
      {display.cohorts.length > 1 && (
        <div className="flex gap-1">
          {display.cohorts.map((c, idx) => (
            <button
              key={c.cohort_id}
              type="button"
              onClick={() => setSelectedCohortIdx(idx)}
              className={[
                "px-3 py-1.5 text-xs rounded transition-colors",
                selectedCohortIdx === idx
                  ? "bg-success/20 text-success font-medium"
                  : "text-text-ghost hover:text-text-secondary",
              ].join(" ")}
            >
              {c.cohort_name}
            </button>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard icon={Users} label="Total N" value={cohort.n.toLocaleString()} />
        <SummaryCard icon={BarChart3} label="Mean Age" value={cohort.summary.mean_age?.toFixed(1) ?? "--"} />
        <SummaryCard icon={BarChart3} label="Median Age" value={String(cohort.summary.median_age ?? "--")} />
        <SummaryCard
          icon={Users}
          label="Gender (M/F/U)"
          value={`${pct(cohort.gender_counts.male, cohort.n)}/${pct(cohort.gender_counts.female, cohort.n)}/${pct(cohort.gender_counts.unknown, cohort.n)}`}
        />
      </div>

      {/* Age pyramid */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4">
        <h3 className="text-xs font-semibold text-text-secondary mb-3">Age-Gender Pyramid</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={pyramidData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
            <XAxis
              type="number"
              tickFormatter={(v: number) => String(Math.abs(v))}
              tick={{ fontSize: 10, fill: "var(--text-ghost)" }}
            />
            <YAxis
              type="category"
              dataKey="decile"
              tick={{ fontSize: 10, fill: "var(--text-ghost)" }}
              width={50}
            />
            <Tooltip
              formatter={((value: number, name: string) => [
                Math.abs(value).toLocaleString(),
                name,
              ]) as never}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="male" fill="#6366F1" name="Male" />
            <Bar dataKey="female" fill="#EC4899" name="Female" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${((n / total) * 100).toFixed(0)}%`;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border border-border-default bg-surface-overlay p-3">
      <div className="flex items-center gap-1.5 text-text-ghost mb-1">
        <Icon size={12} />
        <span className="text-[10px]">{label}</span>
      </div>
      <p className="text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}
