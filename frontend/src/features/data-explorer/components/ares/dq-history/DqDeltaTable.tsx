import { useTranslation } from "react-i18next";
import { formatNumber } from "@/i18n/format";
import type { DqDelta } from "../../../types/ares";

interface DqDeltaTableProps {
  deltas: DqDelta[];
  releaseName: string;
}

const STATUS_CONFIG: Record<
  DqDelta["delta_status"],
  { labelKey: string; bg: string; text: string }
> = {
  new: { labelKey: "new", bg: "bg-primary/20", text: "text-critical" },
  existing: { labelKey: "existing", bg: "bg-accent/20", text: "text-accent" },
  resolved: { labelKey: "resolved", bg: "bg-success/20", text: "text-success" },
  stable: { labelKey: "stable", bg: "bg-surface-highlight/30", text: "text-text-muted" },
};

export default function DqDeltaTable({ deltas, releaseName }: DqDeltaTableProps) {
  const { t } = useTranslation("app");

  if (deltas.length === 0) {
    return (
      <div className="py-8 text-center text-text-ghost">
        {t("dataExplorer.ares.dqHistory.messages.noDeltaData")}
      </div>
    );
  }

  const grouped = {
    new: deltas.filter((d) => d.delta_status === "new"),
    existing: deltas.filter((d) => d.delta_status === "existing"),
    resolved: deltas.filter((d) => d.delta_status === "resolved"),
    stable: deltas.filter((d) => d.delta_status === "stable"),
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">
          {t("dataExplorer.ares.dqHistory.deltaReportTitle", {
            release: releaseName,
          })}
        </h3>
        <div className="flex gap-3 text-[11px]">
          <span className="text-critical">
            {t("dataExplorer.ares.dqHistory.statusSummary.new", { count: formatNumber(grouped.new.length) })}
          </span>
          <span className="text-accent">
            {t("dataExplorer.ares.dqHistory.statusSummary.existing", { count: formatNumber(grouped.existing.length) })}
          </span>
          <span className="text-success">
            {t("dataExplorer.ares.dqHistory.statusSummary.resolved", { count: formatNumber(grouped.resolved.length) })}
          </span>
          <span className="text-text-muted">
            {t("dataExplorer.ares.dqHistory.statusSummary.stable", { count: formatNumber(grouped.stable.length) })}
          </span>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-lg border border-border-subtle">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-overlay">
            <tr className="border-b border-border-subtle">
              <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-text-muted">
                {t("dataExplorer.ares.dqHistory.table.status")}
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-text-muted">
                {t("dataExplorer.ares.dqHistory.table.checkId")}
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-text-muted">
                {t("dataExplorer.ares.dqHistory.table.current")}
              </th>
              <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-text-muted">
                {t("dataExplorer.ares.dqHistory.table.previous")}
              </th>
            </tr>
          </thead>
          <tbody>
            {deltas.map((delta) => {
              const config = STATUS_CONFIG[delta.delta_status];
              return (
                <tr key={delta.id} className="border-b border-border-subtle hover:bg-surface-raised">
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${config.bg} ${config.text}`}>
                      {t(`dataExplorer.ares.dqHistory.status.${config.labelKey}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-text-secondary">{delta.check_id}</td>
                  <td className="px-3 py-2">
                    <span className={delta.current_passed ? "text-success" : "text-critical"}>
                      {delta.current_passed
                        ? t("dataExplorer.ares.dqHistory.result.pass")
                        : t("dataExplorer.ares.dqHistory.result.fail")}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {delta.previous_passed === null ? (
                      <span className="text-text-ghost">N/A</span>
                    ) : (
                      <span className={delta.previous_passed ? "text-success" : "text-critical"}>
                        {delta.previous_passed
                          ? t("dataExplorer.ares.dqHistory.result.pass")
                          : t("dataExplorer.ares.dqHistory.result.fail")}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
