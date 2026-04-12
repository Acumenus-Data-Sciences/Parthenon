import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { FHIR_RESOURCE_ICONS, fmtNumber } from "../../lib/fhir-utils";
import type { ResourcePreview } from "../../lib/fhir-utils";

export function ResourcePreviewPanel({ preview }: { preview: ResourcePreview[] }) {
  const totalResources = preview.reduce((s, p) => s + p.count, 0);

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <div className="px-4 py-3 bg-[#1C1C20] border-b border-[#232328] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-[#8A857D]" />
          <h4 className="text-sm font-medium text-[#F0EDE8]">Resource Preview</h4>
        </div>
        <span className="text-xs text-[#8A857D]">
          {fmtNumber(totalResources)} resource{totalResources !== 1 ? "s" : ""} detected
        </span>
      </div>
      <div className="divide-y divide-[#1C1C20]">
        {preview.map((p) => {
          const icon = FHIR_RESOURCE_ICONS[p.resourceType] ?? "\u{1F4C4}";
          const idPct = p.count > 0 ? Math.round((p.hasId / p.count) * 100) : 0;
          const codePct = p.count > 0 ? Math.round((p.hasCoding / p.count) * 100) : 0;
          return (
            <div
              key={p.resourceType}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span className="text-base w-6 text-center">{icon}</span>
              <span className="flex-1 text-sm font-medium text-[#F0EDE8]">
                {p.resourceType}
              </span>
              <span className="text-xs tabular-nums text-[#C5C0B8] font-semibold w-12 text-right">
                {fmtNumber(p.count)}
              </span>
              <div className="flex items-center gap-3 text-[10px] text-[#8A857D] w-40 justify-end">
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded",
                    idPct === 100
                      ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                      : idPct > 0
                        ? "bg-[#C9A227]/10 text-[#C9A227]"
                        : "bg-[#E85A6B]/10 text-[#E85A6B]",
                  )}
                >
                  {idPct}% IDs
                </span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded",
                    codePct === 100
                      ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                      : codePct > 0
                        ? "bg-[#C9A227]/10 text-[#C9A227]"
                        : "bg-[#232328] text-[#5A5650]",
                  )}
                >
                  {codePct}% coded
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
