// frontend/src/features/morpheus/components/VitalsMonitorGrid.tsx
import { useMemo, useState } from 'react';
import type { MorpheusVital } from '../api';
import { classifyVital, VITAL_TYPE_CONFIGS, type VitalCategory } from '../constants/vitalTypes';
import { VITAL_COLORS } from '../constants/domainColors';
import VitalsMonitorCell from './VitalsMonitorCell';
import LabTimeSeriesChart from './LabTimeSeriesChart';

interface VitalsMonitorGridProps {
  vitals: MorpheusVital[];
}

interface VitalSeries {
  category: VitalCategory;
  values: { date: string; value: number }[];
  latest: number;
  min: number;
  max: number;
}

const GRID_ORDER: VitalCategory[] = [
  'heart_rate', 'blood_pressure_systolic', 'spo2',
  'respiratory_rate', 'temperature', 'gcs',
];

const GRID_COLORS: Record<string, string> = {
  heart_rate: VITAL_COLORS.heart_rate,
  blood_pressure_systolic: VITAL_COLORS.blood_pressure,
  blood_pressure_diastolic: VITAL_COLORS.blood_pressure,
  spo2: VITAL_COLORS.spo2,
  respiratory_rate: VITAL_COLORS.respiratory_rate,
  temperature: VITAL_COLORS.temperature,
  gcs: VITAL_COLORS.gcs,
  pain: VITAL_COLORS.gcs,
};

export default function VitalsMonitorGrid({ vitals }: VitalsMonitorGridProps) {
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(new Set(GRID_ORDER));

  const series = useMemo(() => {
    const map = new Map<VitalCategory, VitalSeries>();

    for (const v of vitals) {
      const cat = classifyVital(v.label);
      if (!cat) continue;
      const num = v.valuenum != null ? Number(v.valuenum) : null;
      if (num == null || isNaN(num)) continue;

      const existing = map.get(cat);
      if (existing) {
        existing.values.push({ date: v.charttime, value: num });
        if (num < existing.min) existing.min = num;
        if (num > existing.max) existing.max = num;
        if (new Date(v.charttime) > new Date(existing.values[existing.values.length - 1]?.date ?? '')) {
          existing.latest = num;
        }
      } else {
        map.set(cat, {
          category: cat,
          values: [{ date: v.charttime, value: num }],
          latest: num,
          min: num,
          max: num,
        });
      }
    }

    for (const s of map.values()) {
      s.values.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      s.latest = s.values[s.values.length - 1]?.value ?? s.latest;
    }

    return map;
  }, [vitals]);

  if (series.size === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-surface-highlight bg-surface-raised">
        <p className="text-sm text-text-muted">No vital signs data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Monitor Grid */}
      <div className="grid grid-cols-3 gap-3">
        {GRID_ORDER.map((cat) => {
          const s = series.get(cat);
          const config = VITAL_TYPE_CONFIGS[cat];
          if (!config) return null;

          return (
            <VitalsMonitorCell
              key={cat}
              label={config.label}
              value={s?.latest ?? null}
              unit={config.unit}
              color={GRID_COLORS[cat] ?? '#8A857D'}
              sparklineValues={s?.values.map((v) => v.value) ?? []}
              normalRange={config.normalRange}
              criticalRange={config.criticalRange}
              minValue={s?.min}
              maxValue={s?.max}
            />
          );
        })}
      </div>

      {/* Timeline Chart */}
      <div className="rounded-xl border border-border-default bg-surface-darkest/70 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-text-primary">Vital Signs Timeline</span>
          <div className="flex items-center gap-3">
            {GRID_ORDER.map((cat) => {
              const config = VITAL_TYPE_CONFIGS[cat];
              if (!config || !series.has(cat)) return null;
              const isVisible = visibleSeries.has(cat);
              return (
                <label key={cat} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => {
                      const next = new Set(visibleSeries);
                      if (isVisible) next.delete(cat);
                      else next.add(cat);
                      setVisibleSeries(next);
                    }}
                    className="w-3 h-3 rounded"
                  />
                  <span className="text-[10px]" style={{ color: GRID_COLORS[cat] }}>{config.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Render primary visible series chart */}
        {(() => {
          const visible = GRID_ORDER.filter((c) => visibleSeries.has(c) && series.has(c));
          if (visible.length === 0) return <div className="text-xs text-text-ghost text-center py-4">Select a vital to display</div>;
          const primary = visible[0];
          const pSeries = series.get(primary);
          const pConfig = VITAL_TYPE_CONFIGS[primary];
          if (!pSeries || !pConfig) return null;

          const overlay = visible.length > 1 ? series.get(visible[1]) : undefined;
          const overlayConfig = visible.length > 1 ? VITAL_TYPE_CONFIGS[visible[1]] : undefined;

          return (
            <LabTimeSeriesChart
              data={pSeries.values}
              rangeLow={pConfig.normalRange[0]}
              rangeHigh={pConfig.normalRange[1]}
              unit={pConfig.unit}
              color={GRID_COLORS[primary]}
              overlayData={overlay?.values}
              overlayLabel={overlayConfig?.label}
              overlayColor={GRID_COLORS[visible[1]] ?? '#8A857D'}
            />
          );
        })()}
      </div>
    </div>
  );
}
