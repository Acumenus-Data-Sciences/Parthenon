import { useCohortGeographyAggregate } from "../../hooks/useGis";
import type { LayerAnalysisProps } from "../types";
import { tAuto } from "@/i18n/autoUserFacing";

export function CohortGeographyAnalysisPanel({ cohortGeography }: LayerAnalysisProps) {
  const hasTarget = Boolean(cohortGeography?.cohort_definition_id ?? cohortGeography?.concept_id);
  const aggregate = useCohortGeographyAggregate(hasTarget ? cohortGeography ?? null : null);

  if (!hasTarget) {
    return <p className="text-xs text-text-ghost">{tAuto("selectAGeneratedCohortOrCondition_0c85d86b")}</p>;
  }

  if (aggregate.isLoading) {
    return <p className="text-xs text-text-ghost">{tAuto("loadingCohortGeography_575c6146")}</p>;
  }

  if (!aggregate.data) {
    return <p className="text-xs text-text-ghost">{tAuto("noCohortGeographyData_ff0096ed")}</p>;
  }

  const rows = [...aggregate.data.features]
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 5);

  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Mapped" value={aggregate.data.summary.geocoded_members.toLocaleString()} />
        <Stat label="Unknown" value={aggregate.data.summary.unknown_members.toLocaleString()} />
        <Stat label="Coverage" value={`${aggregate.data.summary.coverage_percent}%`} />
      </div>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.fips} className="flex items-center justify-between gap-3">
            <span className="truncate text-text-muted">{row.location_name}</span>
            <span className="font-medium text-text-primary">
              {aggregate.data.metric === "prevalence_per_1000"
                ? `${(row.rate_per_1000 ?? 0).toLocaleString()} / 1K`
                : (row.member_count ?? 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      {aggregate.data.summary.suppressed_geographies > 0 && (
        <p className="text-[10px] text-text-ghost">
          {aggregate.data.summary.suppressed_geographies} {tAuto("geographiesSuppressedByCellCount_fc33fd92")}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border-default bg-surface-base px-2 py-1">
      <div className="text-[10px] uppercase text-text-ghost">{label}</div>
      <div className="font-semibold text-text-primary">{value}</div>
    </div>
  );
}
