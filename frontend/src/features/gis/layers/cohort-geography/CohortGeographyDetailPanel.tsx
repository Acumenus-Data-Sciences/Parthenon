import { useMemo } from "react";
import { useCohortGeographyAggregate } from "../../hooks/useGis";
import type { LayerDetailProps } from "../types";

export function CohortGeographyDetailPanel({ fips, cohortGeography }: LayerDetailProps) {
  const hasTarget = Boolean(cohortGeography?.cohort_definition_id ?? cohortGeography?.concept_id);
  const aggregate = useCohortGeographyAggregate(hasTarget ? cohortGeography ?? null : null);
  const row = useMemo(
    () => aggregate.data?.features.find((item) => item.fips === fips),
    [aggregate.data?.features, fips]
  );

  if (!hasTarget) {
    return <p className="text-xs text-text-ghost">No cohort selected.</p>;
  }

  if (aggregate.isLoading) {
    return <p className="text-xs text-text-ghost">Loading...</p>;
  }

  if (!row) {
    return <p className="text-xs text-text-ghost">No mapped members.</p>;
  }

  return (
    <div className="space-y-2 text-xs">
      <Metric
        label="Members"
        value={row.member_count === null ? "Suppressed" : row.member_count.toLocaleString()}
      />
      <Metric label="Denominator" value={row.denominator.toLocaleString()} />
      <Metric
        label="Rate"
        value={row.rate_per_1000 === null ? "-" : `${row.rate_per_1000.toLocaleString()} / 1K`}
      />
      {row.area_sq_km !== null && (
        <Metric label="Area" value={`${Math.round(row.area_sq_km).toLocaleString()} km2`} />
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-text-ghost">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}
