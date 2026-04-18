import { useTranslation } from "react-i18next";
import { formatNumber } from "@/i18n/format";

interface DapGapItem {
  dimension: string;
  source_value: number;
  benchmark_value: number;
  gap: number;
  status: "met" | "gap" | "critical";
}

interface DapGapSource {
  source_id: number;
  source_name: string;
  gaps: DapGapItem[];
}

interface DapGapMatrixProps {
  data: DapGapSource[];
}

const STATUS_STYLES: Record<string, string> = {
  met: "bg-success/20 text-success",
  gap: "bg-accent/20 text-accent",
  critical: "bg-primary/20 text-primary",
};

export default function DapGapMatrix({ data }: DapGapMatrixProps) {
  const { t } = useTranslation("app");

  if (data.length === 0) return null;

  // Extract all unique dimensions from first source
  const dimensions = data[0]?.gaps.map((g) => g.dimension) ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-surface-raised px-3 py-2 text-left text-[11px] text-text-muted">
              {t("dataExplorer.ares.feasibility.table.source")}
            </th>
            {dimensions.map((dim) => (
              <th key={dim} className="px-2 py-2 text-center text-[10px] text-text-ghost">
                {dim}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((source) => (
            <tr key={source.source_id} className="border-t border-border-subtle">
              <td className="sticky left-0 bg-surface-raised px-3 py-1.5 text-text-secondary">
                {source.source_name}
              </td>
              {source.gaps.map((gap) => (
                <td key={gap.dimension} className="px-1 py-1">
                  <div
                    className={`rounded px-2 py-1.5 text-center text-[10px] font-mono ${STATUS_STYLES[gap.status]}`}
                    title={t("dataExplorer.ares.diversity.dap.tooltip", {
                      actual: formatNumber(gap.source_value, { maximumFractionDigits: 1 }),
                      target: formatNumber(gap.benchmark_value, { maximumFractionDigits: 1 }),
                      gap: `${gap.gap > 0 ? "+" : ""}${formatNumber(gap.gap, { maximumFractionDigits: 1 })}`,
                    })}
                  >
                    {t("dataExplorer.ares.diversity.percentValue", {
                      value: formatNumber(gap.source_value, { maximumFractionDigits: 1 }),
                    })}
                    <span className="ml-1 text-[8px] opacity-70">
                      ({gap.gap > 0 ? "+" : ""}
                      {formatNumber(gap.gap, { maximumFractionDigits: 1 })})
                    </span>
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex gap-4 text-[10px] text-text-ghost">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-success" />
          {t("dataExplorer.ares.diversity.dap.status.met")}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          {t("dataExplorer.ares.diversity.dap.status.gap")}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          {t("dataExplorer.ares.diversity.dap.status.critical")}
        </span>
      </div>
    </div>
  );
}
