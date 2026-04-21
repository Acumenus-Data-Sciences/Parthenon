import type { CodeWASDisplayResult } from "../../types";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("app");
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
              className="flex flex-col gap-0.5 px-3 py-2 rounded border border-border-default/50 bg-surface-raised/40 min-w-[90px]"
            >
              <span className="text-[10px] text-text-ghost uppercase tracking-wide">
                {key.replace(/_/g, " ")}
              </span>
              <span className="text-xs font-medium text-text-primary">
                {String(val)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Cohort labels */}
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span>
          {t("investigation.phenotype.codewas.case")}:{" "}
          <span className="text-text-primary font-medium">
            {result.case_cohort_name}
          </span>
        </span>
        <span className="text-text-ghost">
          {t("investigation.phenotype.codewas.versus")}
        </span>
        <span>
          {t("investigation.phenotype.codewas.control")}:{" "}
          <span className="text-text-primary font-medium">
            {result.control_cohort_name}
          </span>
        </span>
      </div>

      {/* Top signals — bar chart + pin table */}
      {result.top_signals.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
            {t("investigation.phenotype.codewas.topSignals", {
              count: result.top_signals.length,
            })}
          </p>

          {/* Recharts horizontal bar chart */}
          <div className="rounded border border-border-default/50 bg-surface-raised/20 px-3 py-3">
            <SignalsBarChart signals={result.top_signals} maxSignals={20} />
          </div>

          {/* Pin table — detail rows below the chart */}
          <div className="rounded border border-border-default/50 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-default/50 bg-surface-raised/60">
                  <th className="text-left px-3 py-2 text-text-ghost font-medium">
                    {t("investigation.phenotype.codewas.label")}
                  </th>
                  <th className="text-right px-3 py-2 text-text-ghost font-medium">
                    {t("investigation.phenotype.codewas.count")}
                  </th>
                  <th className="px-3 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {result.top_signals.map((signal, i) => (
                  <tr
                    key={i}
                    className="border-b border-border-default/30 last:border-0 hover:bg-surface-raised/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-text-primary">{signal.label}</td>
                    <td className="px-3 py-2 text-text-secondary text-right tabular-nums">
                      {signal.count.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handlePin(signal.label, signal.count)}
                        title={t("investigation.common.actions.pinToDossier")}
                        className="text-[10px] px-2 py-0.5 rounded border border-border-hover text-text-muted hover:border-accent/50 hover:text-accent transition-colors"
                      >
                        {t("investigation.common.actions.pin")}
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
        <div className="rounded border border-border-default/50 bg-surface-raised/20 px-4 py-4">
          <ForestPlotWrapper
            data={forestData}
            title={t("investigation.phenotype.codewas.effectEstimates")}
          />
        </div>
      )}

      {/* Volcano plot placeholder */}
      <div className="rounded border border-border-default/30 bg-surface-raised/20 px-4 py-3 text-xs text-text-ghost">
        {t("investigation.phenotype.codewas.volcanoComingSoon")}
      </div>
    </div>
  );
}
