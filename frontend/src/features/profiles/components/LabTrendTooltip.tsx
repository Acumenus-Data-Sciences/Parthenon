import { useTranslation } from "react-i18next";
import type { LabRange, LabStatus } from '../types/profile';
import { formatDate as formatAppDate } from "@/i18n/format";
import { getLabStatusLabel } from "../lib/i18n";

type LabTrendTooltipPayload = {
  payload: {
    ts: number;
    value: number;
    status: LabStatus;
  };
};

type LabTrendTooltipProps = {
  active?: boolean;
  payload?: LabTrendTooltipPayload[];
  range?: LabRange | null;
  unitName: string;
};

const STATUS_META: Record<LabStatus, { arrow: string; color: string }> = {
  low:      { arrow: '\u2193', color: 'text-blue-400' },
  normal:   { arrow: '',        color: 'text-text-muted' },
  high:     { arrow: '\u2191', color: 'text-red-400' },
  critical: { arrow: '\u203C', color: 'text-amber-400' },
  unknown:  { arrow: '',        color: 'text-text-ghost' },
};

export const LabTrendTooltip = ({ active, payload, range, unitName }: LabTrendTooltipProps): React.ReactElement | null => {
  const { t } = useTranslation("app");
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;
  const statusStyle = STATUS_META[point.status];
  const bound =
    point.status === 'low' && range ? ` ${t("profiles.labs.tooltip.below", { value: range.low })}` :
    point.status === 'high' && range ? ` ${t("profiles.labs.tooltip.above", { value: range.high })}` :
    '';

  return (
    <div className="rounded-md border border-amber-600/40 bg-surface-base/95 px-3 py-2 text-xs text-text-primary shadow-lg">
      <div className="text-text-muted">
        {formatAppDate(point.ts, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </div>
      <div className="font-medium">
        {point.value} {unitName}
      </div>
      {point.status !== 'unknown' && (
        <div className={statusStyle.color}>
          {statusStyle.arrow} {getLabStatusLabel(t, point.status)}{bound}
        </div>
      )}
    </div>
  );
};
