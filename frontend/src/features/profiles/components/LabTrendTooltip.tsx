import { format } from 'date-fns';
import type { LabRange, LabStatus } from '../types/profile';

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

const STATUS_LABELS: Record<LabStatus, { label: string; arrow: string; color: string }> = {
  low:      { label: 'Low',      arrow: '\u2193', color: 'text-blue-400' },
  normal:   { label: 'Normal',   arrow: '',        color: 'text-text-muted' },
  high:     { label: 'High',     arrow: '\u2191', color: 'text-red-400' },
  critical: { label: 'Critical', arrow: '\u203C', color: 'text-amber-400' },
  unknown:  { label: 'Unknown',  arrow: '',        color: 'text-text-ghost' },
};

export const LabTrendTooltip = ({ active, payload, range, unitName }: LabTrendTooltipProps): React.ReactElement | null => {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;
  const statusStyle = STATUS_LABELS[point.status];
  const bound =
    point.status === 'low' && range ? ` (below ${range.low})` :
    point.status === 'high' && range ? ` (above ${range.high})` :
    '';

  return (
    <div className="rounded-md border border-amber-600/40 bg-surface-base/95 px-3 py-2 text-xs text-text-primary shadow-lg">
      <div className="text-text-muted">{format(new Date(point.ts), 'MMM d, yyyy')}</div>
      <div className="font-medium">
        {point.value} {unitName}
      </div>
      {point.status !== 'unknown' && (
        <div className={statusStyle.color}>
          {statusStyle.arrow} {statusStyle.label}{bound}
        </div>
      )}
    </div>
  );
};
