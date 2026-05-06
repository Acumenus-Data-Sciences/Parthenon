import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBoundaries, fetchCdmChoropleth } from "../../api";
import type { BoundaryFeature, CdmMetricType, CountyChoroplethItem } from "../../types";
import type { LayerChoroplethItem, LayerDataParams, LayerDataResult } from "../types";

type DiseaseBurdenMapItem = LayerChoroplethItem & {
  gid: string;
  denominator: number | null;
  rate: number | null;
  metric: string;
};

function normalizeMetric(metric: string): CdmMetricType {
  if (metric === "deaths" || metric === "hospitalization" || metric === "patient_count") {
    return metric;
  }

  return "cases";
}

function mergeCountyStats(
  rows: CountyChoroplethItem[] | undefined,
  boundaries: BoundaryFeature[] | undefined,
  metric: string
): DiseaseBurdenMapItem[] | undefined {
  if (!rows || !boundaries) return undefined;

  const boundaryByGid = new Map(boundaries.map((feature) => [feature.properties.gid, feature]));

  return rows.reduce<DiseaseBurdenMapItem[]>((items, row) => {
      const boundary = boundaryByGid.get(row.gid);
      if (!boundary?.geometry) return items;

      items.push({
        geographic_location_id: row.boundary_id,
        location_name: row.name,
        fips: row.gid,
        latitude: 0,
        longitude: 0,
        value: row.value,
        patient_count: row.denominator ?? 0,
        geometry: boundary.geometry,
        gid: row.gid,
        denominator: row.denominator,
        rate: row.rate,
        metric,
      });

      return items;
    }, []);
}

export function useDiseaseBurdenData(params: LayerDataParams): LayerDataResult {
  const { conceptId, metric, enabled = true } = params;
  const cdmMetric = normalizeMetric(metric);
  const canFetch = enabled && conceptId !== null;

  const choropleth = useQuery({
    queryKey: ["gis", "disease-burden", "choropleth", conceptId, cdmMetric],
    queryFn: () => fetchCdmChoropleth({ concept_id: conceptId!, metric: cdmMetric }),
    enabled: canFetch,
    staleTime: 60_000,
  });

  const boundaries = useQuery({
    queryKey: ["gis", "disease-burden", "boundaries", "USA", "ADM2"],
    queryFn: () => fetchBoundaries({ level: "ADM2", country_code: "USA", simplify: 0.02 }),
    enabled: canFetch,
    staleTime: 5 * 60_000,
  });

  const choroplethData = useMemo(
    () => mergeCountyStats(choropleth.data, boundaries.data?.features, cdmMetric),
    [boundaries.data?.features, choropleth.data, cdmMetric]
  );

  return {
    choroplethData,
    analysisData: choropleth.data,
    detailData: null,
    isLoading: choropleth.isLoading || boundaries.isLoading,
  };
}
