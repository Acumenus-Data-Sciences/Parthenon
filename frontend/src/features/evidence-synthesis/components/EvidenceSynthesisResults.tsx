import { Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalysisExecution } from "@/features/analyses/types/analysis";
import type { EvidenceSynthesisResult } from "../types/evidenceSynthesis";
import { ForestPlot } from "./ForestPlot";

/** Safely format a value that may be "NA", null, or a string-encoded number */
function fmt(v: unknown, decimals = 3): string {
  if (v == null || v === "NA" || v === "NaN" || v === "") return "N/A";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toFixed(decimals) : "N/A";
}

function num(v: unknown): number {
  if (v == null || v === "NA" || v === "NaN") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

interface EvidenceSynthesisResultsProps {
  execution: AnalysisExecution | null;
  isLoading?: boolean;
}

export function EvidenceSynthesisResults({
  execution,
  isLoading,
}: EvidenceSynthesisResultsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="text-center py-12 text-[#5A5650] text-sm">
        No execution selected. Run the analysis to see results.
      </div>
    );
  }

  if (execution.status === "running" || execution.status === "queued" || execution.status === "pending") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 size={24} className="animate-spin text-[#2DD4BF]" />
        <p className="text-sm text-[#8A857D]">
          Evidence synthesis is {execution.status}...
        </p>
      </div>
    );
  }

  if (execution.status === "failed") {
    return (
      <div className="rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/5 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-[#E85A6B] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#E85A6B]">Execution Failed</p>
            <p className="text-xs text-[#8A857D] mt-1">
              {execution.fail_message ?? "Unknown error"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const result = execution.result_json as unknown as EvidenceSynthesisResult | null;

  if (!result || result.status !== "completed") {
    return (
      <div className="text-center py-12 text-[#5A5650] text-sm">
        {result?.message ?? "No results available."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pooled Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Pooled HR", value: fmt(result.pooled.hr) },
          { label: "95% CI", value: `[${fmt(result.pooled.ci_lower)}, ${fmt(result.pooled.ci_upper)}]` },
          { label: "Method", value: result.method === "bayesian" ? "Bayesian RE" : "Fixed Effect" },
          { label: "Tau (heterogeneity)", value: isNaN(num(result.pooled.tau)) ? "N/A" : fmt(result.pooled.tau, 4) },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-[#232328] bg-[#151518] p-4 text-center"
          >
            <p className="text-lg font-bold text-[#F0EDE8] font-mono">{card.value}</p>
            <p className="text-xs text-[#8A857D] mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Forest Plot */}
      {result.per_site && result.per_site.length > 0 && (
        <ForestPlot perSite={result.per_site} pooled={result.pooled} />
      )}

      {/* Per-site Table */}
      {result.per_site && result.per_site.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
          <div className="p-4 border-b border-[#232328]">
            <h3 className="text-sm font-semibold text-[#F0EDE8]">Per-Site Results</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#232328]">
                  {["Site", "HR", "95% CI Lower", "95% CI Upper", "Log(RR)", "SE"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-[#8A857D]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.per_site.map((site, idx) => (
                  <tr key={idx} className="border-b border-[#232328] last:border-0">
                    <td className="px-4 py-2 text-[#F0EDE8]">{site.site_name}</td>
                    <td className={cn(
                      "px-4 py-2 font-mono font-semibold",
                      num(site.hr) > 1 ? "text-[#E85A6B]" : num(site.hr) < 1 ? "text-[#2DD4BF]" : "text-[#F0EDE8]",
                    )}>
                      {fmt(site.hr, 4)}
                    </td>
                    <td className="px-4 py-2 font-mono text-[#8A857D]">{fmt(site.ci_lower, 4)}</td>
                    <td className="px-4 py-2 font-mono text-[#8A857D]">{fmt(site.ci_upper, 4)}</td>
                    <td className="px-4 py-2 font-mono text-[#8A857D]">{fmt(site.log_rr, 4)}</td>
                    <td className="px-4 py-2 font-mono text-[#8A857D]">{fmt(site.se_log_rr, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timing */}
      {result.elapsed_seconds != null && (
        <p className="text-xs text-[#5A5650]">
          Completed in {fmt(result.elapsed_seconds, 1)}s
        </p>
      )}
    </div>
  );
}
