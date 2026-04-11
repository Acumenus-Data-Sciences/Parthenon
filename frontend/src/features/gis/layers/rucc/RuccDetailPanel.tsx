import { useQuery } from "@tanstack/react-query";
import { fetchRuccCountyDetail } from "./api";
import type { LayerDetailProps } from "../types";

export function RuccDetailPanel({ fips }: LayerDetailProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "rucc", "detail", fips],
    queryFn: () => fetchRuccCountyDetail(fips),
  });

  if (isLoading) return <p className="text-xs text-text-ghost">Loading...</p>;
  if (!data) return <p className="text-xs text-text-ghost">No RUCC data</p>;

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex justify-between">
        <span className="text-text-muted">RUCC Code</span>
        <span className="font-medium text-[#E8E4DC]">{data.rucc_code}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-text-muted">Classification</span>
        <span className="font-medium text-[#E8E4DC]">{data.rucc_label}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-text-muted">Category</span>
        <span className="font-medium capitalize text-[#E8E4DC]">{data.category}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-text-muted">Patients</span>
        <span className="font-medium text-[#E8E4DC]">{data.patient_count?.toLocaleString()}</span>
      </div>
    </div>
  );
}
