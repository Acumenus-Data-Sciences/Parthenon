// Phase 18 (Plan 18-06) — Survival sub-panel.
// Layout per 18-UI-SPEC §SurvivalPanel: disabled banner ⇒ stat tiles ⇒
// KaplanMeierPlot (via D-13 adapter) ⇒ age-at-death 5-year-bin BarChart.
//
// All copy strings are VERBATIM from UI-SPEC §SurvivalPanel copy.
// Recharts Tooltip formatters are cast `as never` per CLAUDE.md Gotcha #11.
// KaplanMeierPlot is wrapped in overflow-x-auto per UI-SPEC Flag §2 — its
// hard-coded width=700 visually overflows the 624px drawer inner-width.
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KaplanMeierPlot } from "@/features/estimation/components/KaplanMeierPlot";
import type {
  EndpointProfileKmPoint,
  EndpointProfileSummary,
} from "../../api";
import { useEndpointProfileKmData } from "../../hooks/useEndpointProfileKmData";

type SurvivalPanelProps = {
  summary: EndpointProfileSummary;
  kmPoints: EndpointProfileKmPoint[];
  sourceHasDeathData: boolean;
  endpointDisplayName: string;
};

// Inline StatTile per UI-SPEC Flag §11 (do not promote to a shared primitive
// pre-emptively; Phase 17 follows the same pattern).
function StatTile({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="flex-1 rounded border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-100">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{caption}</p>
    </div>
  );
}

export function SurvivalPanel({
  summary,
  kmPoints,
  sourceHasDeathData,
  endpointDisplayName,
}: SurvivalPanelProps) {
  // D-13 adapter — derives nCensored client-side from
  // (subject_count, at_risk, events). MUST receive summary.subject_count.
  const kmProps = useEndpointProfileKmData(
    kmPoints,
    summary.subject_count,
    endpointDisplayName,
  );

  // UI-SPEC §SurvivalPanel copy — verbatim.
  const medianValue =
    summary.median_survival_days !== null && summary.death_count >= 20
      ? `${(summary.median_survival_days / 365.25).toFixed(1)} years`
      : "—";
  const medianCaption =
    summary.median_survival_days !== null && summary.death_count >= 20
      ? "Kaplan-Meier median"
      : "Too few deaths to estimate";

  if (!sourceHasDeathData) {
    return (
      <section aria-labelledby="survival-heading" className="space-y-4">
        <p
          id="survival-heading"
          className="text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          Survival
        </p>
        <div
          role="alert"
          className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
        >
          No death data in this source — survival panel disabled. Comorbidity
          + drug panels still render below.
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="survival-heading" className="space-y-4">
      <p
        id="survival-heading"
        className="text-xs font-semibold uppercase tracking-wider text-slate-500"
      >
        Survival
      </p>

      <div className="flex gap-3">
        <StatTile
          label="Median survival"
          value={medianValue}
          caption={medianCaption}
        />
        <StatTile
          label="Deaths"
          value={summary.death_count.toLocaleString()}
          caption="subjects with death date"
        />
        <StatTile
          label="Subjects at index"
          value={summary.subject_count.toLocaleString()}
          caption="first qualifying event"
        />
      </div>

      {summary.death_count > 0 && (
        <div className="overflow-x-auto rounded border border-slate-800 bg-slate-950/60 p-4">
          <KaplanMeierPlot
            targetCurve={kmProps.targetCurve}
            comparatorCurve={kmProps.comparatorCurve}
            targetLabel={kmProps.targetLabel}
            comparatorLabel={kmProps.comparatorLabel}
            timeUnit={kmProps.timeUnit}
            showCI={kmProps.showCI}
            showRiskDifference={kmProps.showRiskDifference}
            showRMST={kmProps.showRMST}
            interactive={kmProps.interactive}
          />
        </div>
      )}

      {summary.death_count > 0 && summary.age_at_death_bins.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Age at death (5-year bins)
          </p>
          <div className="rounded border border-slate-800 bg-slate-950/60 p-4">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={summary.age_at_death_bins}>
                <XAxis
                  dataKey="bin_start"
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                  label={{
                    value: "Age (years)",
                    position: "insideBottom",
                    offset: -2,
                    style: { fontSize: 10, fill: "var(--text-muted)" },
                  }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--text-muted)" }}
                  label={{
                    value: "Deaths",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 10, fill: "var(--text-muted)" },
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="var(--slate-400, #94a3b8)"
                  stroke="var(--slate-500, #64748b)"
                />
                <Tooltip
                  contentStyle={{
                    background: "#151518",
                    border: "1px solid #334155",
                    borderRadius: 4,
                  }}
                  formatter={
                    ((v: number) => [`${v.toLocaleString()} deaths`, ""]) as never
                  }
                  labelFormatter={(label) => {
                    const age = Number(label);
                    return Number.isFinite(age) ? `Age ${age}–${age + 4}` : "";
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
