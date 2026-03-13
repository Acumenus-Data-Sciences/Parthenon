import type { LayerDetailProps } from "../types";

export function ComorbidityDetailPanel({ fips }: LayerDetailProps) {
  // Detail panel uses hotspot data from parent — simplified for now
  return (
    <div className="text-xs text-[#8A857D]">
      <p>Comorbidity data for {fips}</p>
      <p className="mt-1 text-[10px] text-[#5A5650]">
        DM + HTN + Obesity burden score
      </p>
    </div>
  );
}
