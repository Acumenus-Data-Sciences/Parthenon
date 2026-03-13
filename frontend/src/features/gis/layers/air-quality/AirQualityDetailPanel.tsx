import { useQuery } from "@tanstack/react-query";
import { fetchAqCountyDetail } from "./api";
import type { LayerDetailProps } from "../types";

export function AirQualityDetailPanel({ fips }: LayerDetailProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "aq", "detail", fips],
    queryFn: () => fetchAqCountyDetail(fips),
  });
  if (isLoading) return <p className="text-xs text-[#5A5650]">Loading...</p>;
  if (!data) return <p className="text-xs text-[#5A5650]">No air quality data</p>;
  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex justify-between">
        <span className="text-[#8A857D]">PM2.5</span>
        <span className="font-medium text-[#E8E4DC]">{data.pm25_value?.toFixed(1) ?? "—"} µg/m³</span>
      </div>
      <div className="flex justify-between">
        <span className="text-[#8A857D]">Ozone</span>
        <span className="font-medium text-[#E8E4DC]">{data.ozone_value?.toFixed(1) ?? "—"} ppb</span>
      </div>
    </div>
  );
}
