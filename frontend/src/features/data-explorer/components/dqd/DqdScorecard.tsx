import { Shield, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DqdRunSummary, DqdCategorySummary } from "../../types/dataExplorer";

interface DqdScorecardProps {
  summary: DqdRunSummary | null;
}

const CATEGORY_META: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  completeness: { label: "Completeness", icon: Shield, color: "text-[#60A5FA]" },
  conformance: { label: "Conformance", icon: CheckCircle2, color: "text-[#A855F7]" },
  plausibility: { label: "Plausibility", icon: AlertTriangle, color: "text-[#E5A84B]" },
};

function ScoreRing({
  passed,
  total,
  size = 80,
}: {
  passed: number;
  total: number;
  size?: number;
}) {
  const pct = total > 0 ? (passed / total) * 100 : 0;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color =
    pct >= 90 ? "#2DD4BF" : pct >= 70 ? "#E5A84B" : "#E85A6B";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#232328"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-lg font-semibold font-['IBM_Plex_Mono',monospace]"
          style={{ color }}
        >
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}

export function DqdScorecard({ summary }: DqdScorecardProps) {
  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[#232328] bg-[#151518] py-16">
        <Shield className="h-10 w-10 text-[#5A5650] mb-3" />
        <p className="text-sm text-[#8A857D]">No DQD results available</p>
        <p className="mt-1 text-xs text-[#5A5650]">
          Run a Data Quality Dashboard analysis to see results
        </p>
      </div>
    );
  }

  const { total_checks, passed, failed, by_category } = summary;

  return (
    <div className="space-y-4">
      {/* Score rings row */}
      <div className="grid grid-cols-4 gap-4">
        {/* Overall */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#232328] bg-[#151518] py-6">
          <ScoreRing passed={passed} total={total_checks} size={96} />
          <span className="mt-2 text-sm text-[#8A857D]">Overall Score</span>
          <span className="mt-0.5 text-xs text-[#5A5650]">
            {passed}/{total_checks} passed
          </span>
        </div>

        {/* Per-category */}
        {by_category.map((cat: DqdCategorySummary) => {
          const meta = CATEGORY_META[cat.category] ?? {
            label: cat.category,
            icon: Shield,
            color: "text-[#8A857D]",
          };
          const Icon = meta.icon;

          return (
            <div
              key={cat.category}
              className="flex flex-col items-center justify-center rounded-xl border border-[#232328] bg-[#151518] py-6"
            >
              <ScoreRing passed={cat.passed} total={cat.total} size={72} />
              <div className="mt-2 flex items-center gap-1.5">
                <Icon className={cn("h-3.5 w-3.5", meta.color)} />
                <span className="text-sm text-[#C5C0B8]">{meta.label}</span>
              </div>
              <span className="mt-0.5 text-xs text-[#5A5650]">
                {cat.passed}/{cat.total} passed
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-6 rounded-xl border border-[#232328] bg-[#151518] px-6 py-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#2DD4BF]" />
          <span className="text-sm font-['IBM_Plex_Mono',monospace] text-[#2DD4BF]">
            {passed}
          </span>
          <span className="text-sm text-[#8A857D]">Passed</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#E5A84B]" />
          <span className="text-sm font-['IBM_Plex_Mono',monospace] text-[#E5A84B]">
            {summary.warnings}
          </span>
          <span className="text-sm text-[#8A857D]">Warnings</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#E85A6B]" />
          <span className="text-sm font-['IBM_Plex_Mono',monospace] text-[#E85A6B]">
            {failed}
          </span>
          <span className="text-sm text-[#8A857D]">Failed</span>
        </div>
        <div className="flex-1">
          <div className="flex h-2 overflow-hidden rounded-full bg-[#1A1A1E]">
            {passed > 0 && (
              <div
                className="bg-[#2DD4BF] transition-all"
                style={{ width: `${(passed / total_checks) * 100}%` }}
              />
            )}
            {failed > 0 && (
              <div
                className="bg-[#E85A6B] transition-all"
                style={{ width: `${(failed / total_checks) * 100}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
