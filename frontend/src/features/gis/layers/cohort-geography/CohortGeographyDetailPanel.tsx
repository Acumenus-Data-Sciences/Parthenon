import { useMemo } from "react";
import { useCohortGeographyAggregate } from "../../hooks/useGis";
import type { LayerDetailProps } from "../types";
import { tAuto } from "@/i18n/autoUserFacing";

export function CohortGeographyDetailPanel({ fips, cohortGeography }: LayerDetailProps) {
  const hasTarget = Boolean(cohortGeography?.cohort_definition_id ?? cohortGeography?.concept_id);
  const aggregate = useCohortGeographyAggregate(hasTarget ? cohortGeography ?? null : null);
  const row = useMemo(
    () => aggregate.data?.features.find((item) => item.fips === fips),
    [aggregate.data?.features, fips]
  );

  if (!hasTarget) {
    return <p className="text-xs text-text-ghost">{tAuto("noCohortSelected_8ff0ff96")}</p>;
  }

  if (aggregate.isLoading) {
    return <p className="text-xs text-text-ghost">{tAuto("loading_b04ba49f")}</p>;
  }

  if (!row) {
    return <p className="text-xs text-text-ghost">{tAuto("noMappedMembers_2e98da22")}</p>;
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
