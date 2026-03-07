import { useState } from "react";
import { Loader2, Activity } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { runCohortDiagnostics } from "../api/cohortApi";
import type { CohortDiagnosticsResult } from "../types/cohortExpression";

interface CohortDiagnosticsPanelProps {
  definitionId: number;
}

function VisitContextChart({ data }: { data: { visit_type: string; person_count: number }[] }) {
  if (data.length === 0) return null;
  const maxCount = Math.max(...data.map((d) => d.person_count), 1);

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <h4 className="text-sm font-semibold text-[#F0EDE8] mb-3">Visit Context at Index</h4>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.visit_type} className="flex items-center gap-3">
            <span className="text-xs text-[#C5C0B8] w-36 shrink-0 truncate">{d.visit_type}</span>
            <div className="flex-1 h-5 bg-[#0E0E11] rounded overflow-hidden">
              <div
                className="h-full bg-[#2DD4BF] rounded"
                style={{ width: `${(d.person_count / maxCount) * 100}%`, minWidth: d.person_count > 0 ? 2 : 0 }}
              />
            </div>
            <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D] w-16 text-right">
              {d.person_count.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgeAtIndexChart({ data }: { data: { age_group: number; person_count: number }[] }) {
  if (data.length === 0) return null;

  const width = 400;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const maxCount = Math.max(...data.map((d) => d.person_count), 1);
  const barW = plotW / data.length;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <h4 className="text-sm font-semibold text-[#F0EDE8] mb-3">Age at Index</h4>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Age distribution at index date">
        <rect width={width} height={height} fill="#151518" rx={8} />
        {data.map((d, i) => {
          const barH = (d.person_count / maxCount) * plotH;
          const x = padding.left + i * barW;
          const y = padding.top + plotH - barH;
          return (
            <g key={d.age_group}>
              <rect x={x + 2} y={y} width={barW - 4} height={barH} fill="#C9A227" opacity={0.7} rx={2}>
                <title>{d.age_group}-{d.age_group + 9}: {d.person_count.toLocaleString()} persons</title>
              </rect>
              <text x={x + barW / 2} y={padding.top + plotH + 16} textAnchor="middle" fill="#5A5650" fontSize={9}>
                {d.age_group}-{d.age_group + 9}
              </text>
            </g>
          );
        })}
        <rect x={padding.left} y={padding.top} width={plotW} height={plotH} fill="none" stroke="#323238" strokeWidth={1} />
        <text x={padding.left + plotW / 2} y={height - 4} textAnchor="middle" fill="#8A857D" fontSize={10} fontWeight={600}>
          Age Group
        </text>
      </svg>
    </div>
  );
}

function TimeDistributionCard({ label, p25, median, p75 }: { label: string; p25?: number; median?: number; p75?: number }) {
  if (median == null) return null;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-3">
      <p className="text-xs font-medium text-[#8A857D]">{label}</p>
      <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#F0EDE8]">
        {Math.round(median).toLocaleString()} <span className="text-xs font-normal text-[#5A5650]">days</span>
      </p>
      <p className="text-[10px] text-[#5A5650]">
        IQR: {Math.round(p25 ?? 0).toLocaleString()} - {Math.round(p75 ?? 0).toLocaleString()}
      </p>
    </div>
  );
}

export function CohortDiagnosticsPanel({ definitionId }: CohortDiagnosticsPanelProps) {
  const [result, setResult] = useState<CohortDiagnosticsResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => runCohortDiagnostics(definitionId, { source_id: 1 }),
    onSuccess: (data) => setResult(data),
  });

  if (!result && !mutation.isPending) {
    return (
      <div className="rounded-lg border border-dashed border-[#323238] bg-[#151518] p-6 text-center">
        <Activity size={24} className="mx-auto text-[#323238] mb-3" />
        <h3 className="text-sm font-semibold text-[#F0EDE8]">Cohort Diagnostics</h3>
        <p className="mt-1 text-xs text-[#8A857D]">
          Run diagnostics to see visit context, observation time, and age distribution.
        </p>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          className="mt-4 px-4 py-2 rounded-lg bg-[#2DD4BF]/10 text-[#2DD4BF] text-sm font-medium hover:bg-[#2DD4BF]/20 transition-colors"
        >
          Run Diagnostics
        </button>
        {mutation.isError && (
          <p className="mt-2 text-xs text-[#E85A6B]">
            {mutation.error instanceof Error ? mutation.error.message : "Failed to run diagnostics"}
          </p>
        )}
      </div>
    );
  }

  if (mutation.isPending) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 size={24} className="animate-spin text-[#2DD4BF]" />
        <p className="text-sm text-[#8A857D]">Running cohort diagnostics...</p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-4">
      {/* Counts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 text-center">
          <p className="text-2xl font-bold text-[#F0EDE8] font-['IBM_Plex_Mono',monospace]">
            {result.counts.distinct_persons.toLocaleString()}
          </p>
          <p className="text-xs text-[#8A857D] mt-1">Distinct Persons</p>
        </div>
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 text-center">
          <p className="text-2xl font-bold text-[#C9A227] font-['IBM_Plex_Mono',monospace]">
            {result.counts.total_records.toLocaleString()}
          </p>
          <p className="text-xs text-[#8A857D] mt-1">Total Records</p>
        </div>
      </div>

      {/* Time Distributions */}
      <div className="grid grid-cols-2 gap-4">
        <TimeDistributionCard
          label="Observation Before Index"
          p25={result.time_distributions.p25_before}
          median={result.time_distributions.median_before}
          p75={result.time_distributions.p75_before}
        />
        <TimeDistributionCard
          label="Observation After Index"
          p25={result.time_distributions.p25_after}
          median={result.time_distributions.median_after}
          p75={result.time_distributions.p75_after}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VisitContextChart data={result.visit_context} />
        <AgeAtIndexChart data={result.age_at_index} />
      </div>

      {/* Re-run button */}
      <div className="text-right">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="px-3 py-1.5 rounded text-xs text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
        >
          Re-run diagnostics
        </button>
      </div>
    </div>
  );
}
