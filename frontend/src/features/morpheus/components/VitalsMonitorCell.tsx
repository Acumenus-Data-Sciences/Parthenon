// frontend/src/features/morpheus/components/VitalsMonitorCell.tsx
import LabSparkline from './LabSparkline';

interface VitalsMonitorCellProps {
  label: string;
  value: number | null;
  unit: string;
  color: string;
  sparklineValues: number[];
  normalRange: [number, number];
  criticalRange: [number, number];
  minValue?: number;
  maxValue?: number;
}

function getSeverityBorder(value: number | null, normal: [number, number], critical: [number, number]): string {
  if (value == null) return 'border-[#323238]';
  if (value < critical[0] || value > critical[1]) return 'border-[#E85A6B]';
  if (value < normal[0] || value > normal[1]) return 'border-yellow-500';
  return 'border-[#323238]';
}

export default function VitalsMonitorCell({
  label, value, unit, color, sparklineValues, normalRange, criticalRange, minValue, maxValue,
}: VitalsMonitorCellProps) {
  const borderClass = getSeverityBorder(value, normalRange, criticalRange);

  return (
    <div className={`rounded-xl border-2 ${borderClass} bg-surface-darkest/70 p-3 flex flex-col gap-1 transition-colors`}>
      <div className="text-[10px] uppercase tracking-wider" style={{ color }}>{label}</div>

      {value != null ? (
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold" style={{ color }}>{value.toFixed(1)}</span>
          <span className="text-[10px] text-[#5A5650]">{unit}</span>
        </div>
      ) : (
        <div className="text-sm text-[#5A5650]">No data</div>
      )}

      {sparklineValues.length > 1 && (
        <LabSparkline
          values={sparklineValues}
          rangeLow={normalRange[0]}
          rangeHigh={normalRange[1]}
          width={120}
          height={24}
        />
      )}

      {minValue != null && maxValue != null && (
        <div className="flex justify-between text-[9px] text-[#5A5650]">
          <span>Lo: {minValue.toFixed(1)}</span>
          <span>Hi: {maxValue.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}
