import type { CodeWASDisplayResult } from "../../types";

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

  const maxCount = Math.max(1, ...result.top_signals.map((s) => s.count));

  // Forest plot max HR extent for bar scaling
  const maxHr = result.forest_plot
    ? Math.max(2, ...result.forest_plot.map((r) => r.upper))
    : 2;

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
          Case: <span className="text-zinc-200 font-medium">{result.case_cohort_name}</span>
        </span>
        <span className="text-zinc-600">vs.</span>
        <span>
          Control: <span className="text-zinc-200 font-medium">{result.control_cohort_name}</span>
        </span>
      </div>

      {/* Top signals table */}
      {result.top_signals.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1">
            Top Signals ({result.top_signals.length})
          </p>
          <div className="rounded border border-zinc-700/50 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-700/50 bg-zinc-800/60">
                  <th className="text-left px-3 py-2 text-zinc-500 font-medium">Label</th>
                  <th className="text-right px-3 py-2 text-zinc-500 font-medium">Count</th>
                  <th className="px-3 py-2 text-zinc-500 font-medium w-32">Relative</th>
                  <th className="px-3 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {result.top_signals.map((signal, i) => {
                  const pct = Math.round((signal.count / maxCount) * 100);
                  return (
                    <tr
                      key={i}
                      className="border-b border-zinc-700/30 last:border-0 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-3 py-2 text-zinc-200">{signal.label}</td>
                      <td className="px-3 py-2 text-zinc-300 text-right tabular-nums">
                        {signal.count.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <div className="w-full bg-zinc-700/40 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-[#2DD4BF]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handlePin(signal.label, signal.count)}
                          title="Pin to dossier"
                          className="text-[10px] px-2 py-0.5 rounded border border-zinc-600 text-zinc-400 hover:border-[#C9A227]/50 hover:text-[#C9A227] transition-colors"
                        >
                          Pin
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Forest plot */}
      {result.forest_plot && result.forest_plot.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Forest Plot
          </p>
          <div className="rounded border border-zinc-700/50 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-700/50 bg-zinc-800/60">
                  <th className="text-left px-3 py-2 text-zinc-500 font-medium w-40">Label</th>
                  <th className="text-right px-3 py-2 text-zinc-500 font-medium w-20">HR</th>
                  <th className="px-3 py-2 text-zinc-500 font-medium">95% CI</th>
                </tr>
              </thead>
              <tbody>
                {result.forest_plot.map((row, i) => {
                  const hrPct = Math.min(100, (row.hr / maxHr) * 100);
                  const lowerPct = Math.min(100, (row.lower / maxHr) * 100);
                  const upperPct = Math.min(100, (row.upper / maxHr) * 100);
                  const ciWidth = upperPct - lowerPct;

                  return (
                    <tr
                      key={i}
                      className="border-b border-zinc-700/30 last:border-0 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-3 py-2 text-zinc-200 truncate max-w-[10rem]">{row.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
                        {row.hr.toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative w-full bg-zinc-700/40 rounded-full h-2">
                          {/* CI range */}
                          <div
                            className="absolute top-0 h-2 bg-zinc-500/50 rounded-full"
                            style={{ left: `${lowerPct}%`, width: `${ciWidth}%` }}
                          />
                          {/* Point estimate */}
                          <div
                            className="absolute top-0 w-2 h-2 rounded-full bg-[#C9A227] -translate-x-1/2"
                            style={{ left: `${hrPct}%` }}
                          />
                          {/* Null line at HR=1 */}
                          <div
                            className="absolute top-0 w-px h-2 bg-zinc-400/60"
                            style={{ left: `${(1 / maxHr) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500 mt-0.5 block">
                          [{row.lower.toFixed(2)}, {row.upper.toFixed(2)}]
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Volcano plot placeholder */}
      <div className="rounded border border-zinc-700/30 bg-zinc-800/20 px-4 py-3 text-xs text-zinc-500">
        Interactive volcano plot coming in a future update.
      </div>
    </div>
  );
}
