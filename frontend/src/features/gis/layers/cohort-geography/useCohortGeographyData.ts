import { useMemo } from "react";
import { useCohortGeographyAggregate } from "../../hooks/useGis";
import type { CohortGeographyFeature } from "../../types";
import type { LayerChoroplethItem, LayerDataParams, LayerDataResult } from "../types";

type CohortGeographyMapItem = LayerChoroplethItem & CohortGeographyFeature;

function hasTarget(params: LayerDataParams): boolean {
  return Boolean(
    params.cohortGeography?.cohort_definition_id ?? params.cohortGeography?.concept_id
  );
}

export function useCohortGeographyData(params: LayerDataParams): LayerDataResult {
  const enabled = params.enabled === true && hasTarget(params);
  const aggregate = useCohortGeographyAggregate(enabled ? params.cohortGeography ?? null : null);

  const choroplethData = useMemo<CohortGeographyMapItem[] | undefined>(() => {
    if (!aggregate.data) return undefined;

    return aggregate.data.features.map((feature) => ({
      ...feature,
      geographic_location_id: feature.geographic_location_id,
      location_name: feature.location_name,
      fips: feature.fips,
      latitude: feature.latitude ?? 0,
      longitude: feature.longitude ?? 0,
      value: feature.value ?? 0,
      patient_count: feature.denominator,
      geometry: feature.geometry,
    }));
  }, [aggregate.data]);

  return {
    choroplethData,
    analysisData: aggregate.data,
    detailData: null,
    isLoading: aggregate.isLoading,
  };
}
