import type { LabStatus } from '../types/profile';

type LabStatusDotProps = {
  cx?: number;
  cy?: number;
  payload?: {
    status?: LabStatus;
    [key: string]: unknown;
  };
};

const STATUS_STYLES: Record<LabStatus, { fill: string; stroke: string; r: number; strokeWidth: number }> = {
  low:      { fill: '#3B82F6', stroke: '#3B82F6', r: 4, strokeWidth: 1 },
  normal:   { fill: '#A1A1AA', stroke: '#A1A1AA', r: 3, strokeWidth: 1 },
  high:     { fill: '#9B1B30', stroke: '#9B1B30', r: 4, strokeWidth: 1 },
  critical: { fill: '#9B1B30', stroke: '#C9A227', r: 5, strokeWidth: 3 },
  unknown:  { fill: 'transparent', stroke: '#71717a', r: 3, strokeWidth: 1 },
};

export const LabStatusDot = ({ cx, cy, payload }: LabStatusDotProps): React.ReactElement | null => {
  if (cx === undefined || cy === undefined) return null;
  const status: LabStatus = payload?.status ?? 'unknown';
  const style = STATUS_STYLES[status];

  return (
    <circle
      cx={cx}
      cy={cy}
      r={style.r}
      fill={style.fill}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
    />
  );
};
