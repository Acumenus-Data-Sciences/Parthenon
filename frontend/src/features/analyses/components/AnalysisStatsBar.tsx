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

export function AnalysisStatsBar() {
  const { data: stats } = useAnalysisStats();

  if (!stats) return null;

  const metrics = [
    { label: "Characterizations", value: stats.characterizations.total, icon: BarChart3, color: "#60A5FA" },
    { label: "Incidence Rates", value: stats.incidence_rates.total, icon: TrendingUp, color: "#2DD4BF" },
    { label: "Pathways", value: stats.pathways.total, icon: GitBranch, color: "#C9A227" },
    { label: "Estimations", value: stats.estimations.total, icon: Scale, color: "#A78BFA" },
    { label: "Predictions", value: stats.predictions.total, icon: Brain, color: "#F472B6" },
    { label: "SCCS", value: stats.sccs.total, icon: Clock, color: "#FB923C" },
    { label: "Evidence Synth", value: stats.evidence_synthesis.total, icon: Layers, color: "#34D399" },
    { label: "Total", value: stats.grand_total, icon: Sigma, color: "#C5C0B8" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 lg:grid-cols-8">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="flex items-center gap-2.5 rounded-lg border border-[#232328] bg-[#151518] px-3 py-2.5"
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
            <p className="text-[9px] text-[#5A5650] uppercase tracking-wider truncate">
              {m.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
