import { Layers, CheckCircle2, Globe } from "lucide-react";
import { useConceptSetStats } from "../hooks/useConceptSets";

export function ConceptSetStatsBar({ onStatClick, activeKey }: { onStatClick?: (key: string) => void; activeKey?: string } = {}) {
  const { data: stats } = useConceptSetStats();

  if (!stats) return null;

  const metrics = [
    { label: "Total", key: "total", value: stats.total, icon: Layers, color: "var(--text-secondary)" },
    {
      label: "With Items",
      key: "with_items",
      value: stats.with_items,
      icon: CheckCircle2,
      color: "var(--success)",
    },
    { label: "Public", key: "public", value: stats.public, icon: Globe, color: "var(--info)" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {metrics.map((m) => (
        <div
          key={m.label}
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors cursor-pointer ${activeKey === m.key ? "border-accent/50 bg-accent/5" : "border-border-default bg-surface-raised hover:border-surface-highlight"}`}
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
            <p className="text-[10px] text-text-ghost uppercase tracking-wider">
              {m.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
