import {
  BarChart3,
  TrendingUp,
  GitBranch,
  Scale,
  Brain,
  Clock,
  Layers,
  Sigma,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAnalysisStats } from "../api/analysisStatsApi";

export function useAnalysisStats() {
  return useQuery({
    queryKey: ["analysis-stats"],
    queryFn: getAnalysisStats,
  });
}

export function AnalysisStatsBar({ onStatClick }: { onStatClick?: (key: string) => void } = {}) {
  const { data: stats } = useAnalysisStats();

  if (!stats) return null;

  const metrics = [
    { label: "Characterizations", key: "characterizations", value: stats.characterizations.total, icon: BarChart3, color: "var(--info)" },
    { label: "Incidence Rates", key: "incidence-rates", value: stats.incidence_rates.total, icon: TrendingUp, color: "var(--success)" },
    { label: "Pathways", key: "pathways", value: stats.pathways.total, icon: GitBranch, color: "var(--accent)" },
    { label: "Estimations", key: "estimations", value: stats.estimations.total, icon: Scale, color: "var(--domain-observation)" },
    { label: "Predictions", key: "predictions", value: stats.predictions.total, icon: Brain, color: "var(--domain-procedure)" },
    { label: "SCCS", key: "sccs", value: stats.sccs.total, icon: Clock, color: "var(--domain-device)" },
    { label: "Evidence Synth", key: "evidence-synthesis", value: stats.evidence_synthesis.total, icon: Layers, color: "var(--success)" },
    { label: "Total", key: "total", value: stats.grand_total, icon: Sigma, color: "var(--text-secondary)" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 lg:grid-cols-8">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="flex items-center gap-2.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2.5 transition-colors hover:border-surface-highlight cursor-pointer"
          onClick={() => onStatClick?.(m.key)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onStatClick?.(m.key); }}
        >
          <div
            className="flex items-center justify-center w-7 h-7 rounded-md shrink-0"
            style={{ backgroundColor: `${m.color}12` }}
          >
            <m.icon size={14} style={{ color: m.color }} />
          </div>
          <div className="min-w-0">
            <p
              className="text-base font-semibold font-['IBM_Plex_Mono',monospace] leading-tight"
              style={{ color: m.color }}
            >
              {m.value}
            </p>
            <p className="text-[9px] text-text-ghost uppercase tracking-wider truncate">
              {m.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
