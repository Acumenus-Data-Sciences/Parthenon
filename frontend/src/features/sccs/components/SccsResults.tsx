import { Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalysisExecution } from "@/features/analyses/types/analysis";
import type { SccsResult } from "../types/sccs";

interface SccsResultsProps {
  execution: AnalysisExecution | null;
  isLoading?: boolean;
}

export function SccsResults({ execution, isLoading }: SccsResultsProps) {
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
          SCCS analysis is {execution.status}...
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

  const result = execution.result_json as unknown as SccsResult | null;

  if (!result || result.status !== "completed") {
    return (
      <div className="text-center py-12 text-[#5A5650] text-sm">
        {result?.message ?? "No results available."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Population Summary */}
      {result.population && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Cases", value: result.population.cases },
            { label: "Outcomes", value: result.population.outcomes },
            { label: "Observation Periods", value: result.population.observation_periods },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-[#232328] bg-[#151518] p-4 text-center"
            >
              <p className="text-2xl font-bold text-[#F0EDE8]">
                {card.value?.toLocaleString() ?? "-"}
              </p>
              <p className="text-xs text-[#8A857D] mt-1">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* IRR Estimates Table */}
      {result.estimates && result.estimates.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
          <div className="p-4 border-b border-[#232328]">
            <h3 className="text-sm font-semibold text-[#F0EDE8]">
              Incidence Rate Ratios
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#232328]">
                  {["Covariate", "IRR", "95% CI Lower", "95% CI Upper", "Log RR", "SE"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-[#8A857D]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.estimates.map((est, idx) => (
                  <tr key={idx} className="border-b border-[#232328] last:border-0">
                    <td className="px-4 py-2 text-[#F0EDE8]">{est.covariate}</td>
                    <td className={cn(
                      "px-4 py-2 font-mono font-semibold",
                      est.irr > 1 ? "text-[#E85A6B]" : est.irr < 1 ? "text-[#2DD4BF]" : "text-[#F0EDE8]",
                    )}>
                      {est.irr.toFixed(3)}
                    </td>
                    <td className="px-4 py-2 font-mono text-[#8A857D]">{est.ci_lower.toFixed(3)}</td>
                    <td className="px-4 py-2 font-mono text-[#8A857D]">{est.ci_upper.toFixed(3)}</td>
                    <td className="px-4 py-2 font-mono text-[#8A857D]">{est.log_rr.toFixed(4)}</td>
                    <td className="px-4 py-2 font-mono text-[#8A857D]">{est.se_log_rr.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Execution Info */}
      {result.elapsed_seconds != null && (
        <p className="text-xs text-[#5A5650]">
          Completed in {result.elapsed_seconds.toFixed(1)}s
        </p>
      )}
    </div>
  );
}
