// Phase 18 (Plan 18-06) — Drug-classes horizontal BarChart (top 10 ATC3).
// Per D-14: 90-day pre-index window; subjects with zero drug records in
// the window are excluded from the denominator (matches the "absence of
// recording ≠ absence of treatment" principle).
//
// Recharts Tooltip & LabelList formatters cast `as never` per CLAUDE.md
// Gotcha #11. Empty-state copy strings VERBATIM from UI-SPEC §DrugClassesPanel.
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import type { EndpointProfileDrugClass } from "../../api";

type DrugClassesPanelProps = {
  drugClasses: EndpointProfileDrugClass[];
  sourceHasDrugData: boolean;
};

export function DrugClassesPanel({
  drugClasses,
  sourceHasDrugData,
}: DrugClassesPanelProps) {
  return (
    <section aria-labelledby="drug-classes-heading" className="space-y-4">
      <p
        id="drug-classes-heading"
        className="text-xs font-semibold uppercase tracking-wider text-slate-500"
      >
        Drug classes (90d pre-index)
      </p>
      <p className="text-xs text-slate-400">
        Top 10 ATC3 drug classes prescribed in the 90 days before first
        qualifying event.
      </p>
      <p className="text-xs text-slate-500">
        Subjects with no drug records in the 90d window are excluded from the
        denominator.
      </p>

      {drugClasses.length === 0 ? (
        <EmptyState
          title={
            sourceHasDrugData
              ? "No drug records in the 90-day pre-index window for this endpoint × source."
              : "This source has no drug-exposure data. Drug timeline cannot be rendered."
          }
        />
      ) : (
        <div className="rounded border border-slate-800 bg-slate-950/60 p-4">
          <ResponsiveContainer
            width="100%"
            height={drugClasses.length * 32 + 40}
          >
            <BarChart
              layout="vertical"
              data={drugClasses}
              margin={{ left: 140, right: 40 }}
            >
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="atc3_name"
                tick={{ fontSize: 12, fill: "var(--slate-300, #cbd5e1)" }}
                width={130}
              />
              <Bar
                dataKey="pct_on_drug"
                fill="var(--success)"
                fillOpacity={0.4}
                stroke="var(--success)"
                strokeOpacity={0.6}
                barSize={20}
              >
                <LabelList
                  dataKey="pct_on_drug"
                  position="right"
                  formatter={((v: number) => `${v.toFixed(1)}%`) as never}
                  style={{
                    fill: "var(--slate-300, #cbd5e1)",
                    fontSize: 12,
                  }}
                />
              </Bar>
              <Tooltip
                contentStyle={{
                  background: "#151518",
                  border: "1px solid #334155",
                  borderRadius: 4,
                }}
                formatter={
                  ((
                    v: number,
                    _name: string,
                    props: { payload: EndpointProfileDrugClass },
                  ) => [
                    `${v.toFixed(1)}% (${props.payload.subjects_on_drug.toLocaleString()} / ${props.payload.subjects_total.toLocaleString()})`,
                    "",
                  ]) as never
                }
                labelFormatter={(label: string) => label}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
