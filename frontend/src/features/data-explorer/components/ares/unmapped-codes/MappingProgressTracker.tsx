import { useTranslation } from "react-i18next";
import { formatNumber } from "@/i18n/format";

interface MappingProgressProps {
  total: number;
  mapped: number;
  deferred: number;
  excluded: number;
  pending: number;
}

const SEGMENTS = [
  { key: "mapped" as const, labelKey: "mapped", color: "var(--success)" },
  { key: "deferred" as const, labelKey: "deferred", color: "var(--accent)" },
  { key: "excluded" as const, labelKey: "excluded", color: "var(--text-ghost)" },
  { key: "pending" as const, labelKey: "pending", color: "var(--primary)" },
];

export default function MappingProgressTracker({
  total,
  mapped,
  deferred,
  excluded,
  pending,
}: MappingProgressProps) {
  const { t } = useTranslation("app");
  const values: Record<string, number> = { mapped, deferred, excluded, pending };

  if (total === 0) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface-raised p-4 text-center text-sm text-text-ghost">
        {t("dataExplorer.ares.unmapped.progress.noCodes")}
      </div>
    );
  }

  const completionPct = total > 0 ? ((mapped + deferred + excluded) / total) * 100 : 0;

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium text-text-primary">
          {t("dataExplorer.ares.unmapped.progress.title")}
        </h4>
        <span className="text-xs text-text-muted">
          {t("dataExplorer.ares.unmapped.progress.reviewed", {
            percent: formatNumber(completionPct, { maximumFractionDigits: 1 }),
          })}
        </span>
      </div>

      {/* Stacked progress bar */}
      <div className="mb-3 flex h-4 w-full overflow-hidden rounded-full bg-surface-overlay">
        {SEGMENTS.map((seg) => {
          const pct = total > 0 ? (values[seg.key] / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={seg.key}
              className="transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: seg.color }}
              title={t("dataExplorer.ares.unmapped.progress.segmentTitle", {
                label: t(`dataExplorer.ares.unmapped.progress.status.${seg.labelKey}`),
                count: formatNumber(values[seg.key]),
                percent: formatNumber(pct, { maximumFractionDigits: 1 }),
              })}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {SEGMENTS.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1.5 text-xs">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
            <span className="text-text-muted">
              {t("dataExplorer.ares.unmapped.progress.label", {
                label: t(`dataExplorer.ares.unmapped.progress.status.${seg.labelKey}`),
              })}
            </span>
            <span className="font-medium text-text-primary">{formatNumber(values[seg.key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
