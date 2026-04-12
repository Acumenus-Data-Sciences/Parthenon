import { useQuery } from "@tanstack/react-query";
import { fetchSviTractDetail } from "./api";
import type { LayerDetailProps } from "../types";

const THEME_LABELS = [
  "Socioeconomic Status",
  "Household Composition",
  "Minority Status",
  "Housing & Transportation",
];

export function SviDetailPanel({ fips }: LayerDetailProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gis", "svi", "detail", fips],
    queryFn: () => fetchSviTractDetail(fips),
  });

  if (isLoading) return <p className="text-xs text-[#5A5650]">Loading...</p>;
  if (!data) return <p className="text-xs text-[#5A5650]">No SVI data</p>;

  const themes = [data.svi_theme1, data.svi_theme2, data.svi_theme3, data.svi_theme4];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#8A857D]">Overall SVI</span>
        <span className="font-medium text-[#E8E4DC]">
          {data.svi_overall !== null ? (data.svi_overall * 100).toFixed(0) + "%" : "—"}
        </span>
      </div>
      {themes.map((val, i) => (
        <div key={i} className="space-y-0.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[#5A5650]">{THEME_LABELS[i]}</span>
            <span className="text-[#8A857D]">
              {val !== null ? (val * 100).toFixed(0) + "%" : "—"}
            </span>
          </div>
          <div className="h-1 rounded-full bg-[#232328]">
            <div
              className="h-1 rounded-full bg-[#E85A6B]"
              style={{ width: `${(val ?? 0) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
