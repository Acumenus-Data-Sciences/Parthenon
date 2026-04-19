// Phase 18 (Plan 18-06) — Comorbidity heatmap (50×1 single-column).
// Per D-07: positive phi = crimson, negative = teal-400, |phi|<0.05 = neutral.
// Per D-06: clicking a row navigates the SAME drawer to the clicked
// endpoint's profile via onNavigate prop (parent calls navigate()).
//
// Layout: HTML/CSS grid (NOT Recharts). 50 rows ranked by |phi| with
// `grid grid-cols-[1fr_96px_16px] gap-2 h-6 items-center`. Tooltip is an
// absolutely-positioned div that reveals phi + OR + CI on row hover.
//
// All copy strings are VERBATIM from UI-SPEC §ComorbidityMatrixPanel copy.
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import type { EndpointProfileComorbidity } from "../../api";
import { getPhiCellClass } from "./heatmap-helpers";

type ComorbidityMatrixPanelProps = {
  comorbidities: EndpointProfileComorbidity[];
  universeSize: number;
  minSubjects: number;
  sourceKey: string;
  onNavigate: (comorbidEndpointName: string) => void;
};

export function ComorbidityMatrixPanel({
  comorbidities,
  universeSize,
  minSubjects,
  sourceKey,
  onNavigate,
}: ComorbidityMatrixPanelProps) {
  const [hoveredRank, setHoveredRank] = useState<number | null>(null);

  return (
    <section aria-labelledby="comorbidities-heading" className="space-y-4">
      <p
        id="comorbidities-heading"
        className="text-xs font-semibold uppercase tracking-wider text-slate-500"
      >
        Comorbidities
      </p>
      <p className="text-xs text-slate-400">
        Top 50 co-occurring FinnGen endpoints by |phi|. Click a row to
        navigate to that endpoint's profile.
      </p>

      {comorbidities.length === 0 && (
        <EmptyState
          title={
            universeSize === 0
              ? `No co-occurring endpoints with ≥ ${minSubjects} subjects on this source.`
              : `Only ${universeSize.toLocaleString()} FinnGen endpoints have ≥ ${minSubjects} subjects on this source. Ranked list is shorter than 50.`
          }
        />
      )}

      {comorbidities.length > 0 && (
        <div
          className="rounded border border-slate-800 bg-slate-950/60 p-2"
          role="list"
        >
          <div className="flex flex-col gap-[2px]">
            {comorbidities.map((c) => {
              const cellClass = getPhiCellClass(c.phi_coef);
              const showOverlay = Math.abs(c.phi_coef) >= 0.2;
              const isHovered = hoveredRank === c.rank;
              const displayName =
                c.comorbid_endpoint_display_name ?? c.comorbid_endpoint_name;
              return (
                <div key={c.comorbid_endpoint_name} className="relative">
                  <button
                    type="button"
                    onClick={() => onNavigate(c.comorbid_endpoint_name)}
                    onMouseEnter={() => setHoveredRank(c.rank)}
                    onMouseLeave={() => setHoveredRank(null)}
                    onFocus={() => setHoveredRank(c.rank)}
                    onBlur={() => setHoveredRank(null)}
                    role="listitem"
                    title={c.comorbid_endpoint_name}
                    className="grid w-full grid-cols-[1fr_96px_16px] items-center gap-2 rounded px-2 h-6 cursor-pointer hover:border hover:border-teal-400/40 hover:bg-slate-900/60 focus:outline-none focus:ring-1 focus:ring-teal-400/40 group"
                  >
                    <span className="truncate max-w-[280px] text-left text-xs text-slate-200">
                      {displayName}
                    </span>
                    <div
                      className={`${cellClass} flex h-4 items-center justify-center rounded`}
                    >
                      {showOverlay && (
                        <span className="font-mono text-[10px] tabular-nums">
                          {c.phi_coef.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <ChevronRight
                      size={12}
                      className="text-slate-600 group-hover:text-teal-400"
                    />
                  </button>
                  {isHovered && (
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute right-0 top-full z-10 mt-1 rounded border border-slate-700 bg-[#151518] px-2 py-1 text-left shadow-lg"
                    >
                      <p className="text-xs font-semibold text-slate-100">
                        {displayName}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400">
                        phi={c.phi_coef.toFixed(3)} · OR=
                        {c.odds_ratio.toFixed(2)} (
                        {c.or_ci_low.toFixed(2)}–{c.or_ci_high.toFixed(2)}) ·{" "}
                        {c.co_count.toLocaleString()} co-occurrences
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Universe: {universeSize.toLocaleString()} FinnGen endpoints with ≥{" "}
        {minSubjects} subjects on {sourceKey}.
      </p>
    </section>
  );
}
