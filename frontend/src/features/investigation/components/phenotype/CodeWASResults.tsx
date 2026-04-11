import type { CodeWASDisplayResult } from "../../types";
import { SignalsBarChart } from "./SignalsBarChart";
import { ForestPlotWrapper } from "./ForestPlotWrapper";

type PinFinding = {
  domain: string;
  section: string;
  finding_type: string;
  finding_payload: Record<string, unknown>;
};

interface CodeWASResultsProps {
  result: CodeWASDisplayResult;
  onPinFinding: (finding: PinFinding) => void;
}

export function CodeWASResults({ result, onPinFinding }: CodeWASResultsProps) {
  const summaryEntries = Object.entries(result.analysis_summary).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );

  function handlePin(label: string, count: number) {
    onPinFinding({
      domain: "phenotype",
      section: "phenotype_definition",
      finding_type: "codewas_hit",
      finding_payload: {
        label,
        count,
        case_cohort_name: result.case_cohort_name,
        control_cohort_name: result.control_cohort_name,
      },
    });
  }

  // Forest plot data mapped to ForestPlotWrapper shape
  const forestData = result.forest_plot
    ? result.forest_plot.map((r) => ({
        label: r.label,
        hr: r.hr,
        lower: r.lower,
        upper: r.upper,
      }))
    : [];

  return (
    <div className="flex flex-col gap-5">
      {/* Summary bar */}
      {summaryEntries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summaryEntries.map(([key, val]) => (
            <div
              key={key}
              className="flex flex-col gap-0.5 px-3 py-2 rounded border border-zinc-700/50 bg-zinc-800/40 min-w-[90px]"
            >
              <span className="text-[10px] text-zinc-500 uppercase tracking-wide">
                {key.replace(/_/g, " ")}
              </span>
              <span className="text-xs font-medium text-zinc-200">
                {String(val)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Cohort labels */}
      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <span>
          Case:{" "}
          <span className="text-zinc-200 font-medium">
            {result.case_cohort_name}
          </span>
        </span>
        <span className="text-zinc-600">vs.</span>
        <span>
          Control:{" "}
          <span className="text-zinc-200 font-medium">
            {result.control_cohort_name}
          </span>
        </span>
      </div>

      {/* Top signals — bar chart + pin table */}
      {result.top_signals.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Top Signals ({result.top_signals.length})
          </p>

          {/* Recharts horizontal bar chart */}
          <div className="rounded border border-zinc-700/50 bg-zinc-800/20 px-3 py-3">
            <SignalsBarChart signals={result.top_signals} maxSignals={20} />
          </div>

          {/* Pin table — detail rows below the chart */}
          <div className="rounded border border-zinc-700/50 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-700/50 bg-zinc-800/60">
                  <th className="text-left px-3 py-2 text-zinc-500 font-medium">
                    Label
                  </th>
                  <th className="text-right px-3 py-2 text-zinc-500 font-medium">
                    Count
                  </th>
                  <th className="px-3 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {result.top_signals.map((signal, i) => (
                  <tr
                    key={i}
                    className="border-b border-zinc-700/30 last:border-0 hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-zinc-200">{signal.label}</td>
                    <td className="px-3 py-2 text-zinc-300 text-right tabular-nums">
                      {signal.count.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handlePin(signal.label, signal.count)}
                        title="Pin to dossier"
                        className="text-[10px] px-2 py-0.5 rounded border border-zinc-600 text-zinc-400 hover:border-accent/50 hover:text-accent transition-colors"
                      >
                        Pin
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Forest plot — D3 dark-themed */}
      {forestData.length > 0 && (
        <div className="rounded border border-zinc-700/50 bg-zinc-800/20 px-4 py-4">
          <ForestPlotWrapper
            data={forestData}
            title="Effect Estimates"
          />
        </div>
      )}

      {/* Volcano plot placeholder */}
      <div className="rounded border border-zinc-700/30 bg-zinc-800/20 px-4 py-3 text-xs text-zinc-500">
        Interactive volcano plot coming in a future update.
      </div>
    </div>
  );
}
