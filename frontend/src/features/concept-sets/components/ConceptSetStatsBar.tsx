import { Layers, CheckCircle2, Globe } from "lucide-react";
import { useConceptSetStats } from "../hooks/useConceptSets";

export function ConceptSetStatsBar({ onStatClick, activeKey }: { onStatClick?: (key: string) => void; activeKey?: string } = {}) {
  const { data: stats } = useConceptSetStats();

  if (!stats) return null;

  const metrics = [
    { label: "Total", key: "total", value: stats.total, icon: Layers, color: "#C5C0B8" },
    {
      label: "With Items",
      key: "with_items",
      value: stats.with_items,
      icon: CheckCircle2,
      color: "#2DD4BF",
    },
    { label: "Public", key: "public", value: stats.public, icon: Globe, color: "#60A5FA" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {metrics.map((m) => (
        <div
          key={m.label}
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors cursor-pointer ${activeKey === m.key ? "border-[#C9A227]/50 bg-[#C9A227]/5" : "border-[#232328] bg-[#151518] hover:border-[#3A3A40]"}`}
          onClick={() => onStatClick?.(m.key)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onStatClick?.(m.key); }}
        >
          <div
            className="flex items-center justify-center w-8 h-8 rounded-md"
            style={{ backgroundColor: `${m.color}12` }}
          >
            <m.icon size={16} style={{ color: m.color }} />
          </div>
          <div>
            <p
              className="text-lg font-semibold font-['IBM_Plex_Mono',monospace]"
              style={{ color: m.color }}
            >
              {m.value}
            </p>
            <p className="text-[10px] text-[#5A5650] uppercase tracking-wider">
              {m.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
