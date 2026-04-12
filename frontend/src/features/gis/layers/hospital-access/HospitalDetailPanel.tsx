import type { LayerDetailProps } from "../types";

export function HospitalDetailPanel({ fips }: LayerDetailProps) {
  return (
    <div className="text-xs text-[#8A857D]">
      <p>Nearest hospitals to {fips}</p>
      <p className="mt-1 text-[10px] text-[#5A5650]">Distance rings: 15/30/60 km</p>
    </div>
  );
}
