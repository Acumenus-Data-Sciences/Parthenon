import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MorpheusMedication } from '../api';

interface MedicationTimelineProps {
  medications: MorpheusMedication[];
  onDrugClick?: (med: MorpheusMedication) => void;
}

export default function MedicationTimeline({ medications, onDrugClick }: MedicationTimelineProps) {
  const { t } = useTranslation('app');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; med: MorpheusMedication; drug: string } | null>(null);
  const [panOffset, setPanOffset] = useState(0);
  const [zoom, setZoom] = useState(1);

  const { lanes, minTime, maxTime } = useMemo(() => {
    if (!medications.length) return { lanes: [] as { drug: string; meds: MorpheusMedication[] }[], minTime: 0, maxTime: 0 };

    const sorted = [...medications]
      .filter(m => m.starttime)
      .sort((a, b) => new Date(a.starttime).getTime() - new Date(b.starttime).getTime());

    if (!sorted.length) return { lanes: [] as { drug: string; meds: MorpheusMedication[] }[], minTime: 0, maxTime: 0 };

    const min = new Date(sorted[0].starttime).getTime();
    const max = Math.max(
      ...sorted.map(m => (m.stoptime ? new Date(m.stoptime).getTime() : new Date(m.starttime).getTime() + 86400000))
    );

    const drugCounts = new Map<string, MorpheusMedication[]>();
    for (const med of sorted) {
      const group = drugCounts.get(med.drug) || [];
      group.push(med);
      drugCounts.set(med.drug, group);
    }

    const topDrugs = [...drugCounts.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 20);

    return {
      lanes: topDrugs.map(([drug, meds]) => ({ drug, meds })),
      minTime: min,
      maxTime: max,
    };
  }, [medications]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setPanOffset((p) => p - 20); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setPanOffset((p) => p + 20); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom((z) => Math.min(z * 1.2, 5)); }
    else if (e.key === '-') { e.preventDefault(); setZoom((z) => Math.max(z / 1.2, 0.5)); }
  }, []);

  if (!lanes.length) {
    return (
      <div className="flex items-center justify-center h-20 rounded-lg border border-dashed border-surface-highlight bg-surface-raised">
        <p className="text-sm text-text-muted">{t('morpheus.common.data.noMedicationData')}</p>
      </div>
    );
  }

  const span = maxTime - minTime || 1;

  return (
    <div
      className="rounded-xl border border-border-default/60 bg-surface-base p-4 focus:outline-none focus:ring-1 focus:ring-success/30"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="img"
      aria-label={t('morpheus.medications.ariaLabel')}
    >
      <h3 className="text-xs font-semibold text-text-secondary mb-3">
        {t('morpheus.medications.title', { count: lanes.length })}
      </h3>
      <div className="space-y-1" style={{ transform: `scaleX(${zoom}) translateX(${panOffset}px)`, transformOrigin: 'left center' }}>
        {lanes.map(({ drug, meds }) => (
          <div key={drug} className="flex items-center gap-2 h-5">
            <div className="w-32 truncate text-[10px] text-text-muted text-right shrink-0" title={drug}>
              {drug}
            </div>
            <div className="flex-1 relative h-3 bg-surface-base rounded-sm overflow-hidden">
              {meds.map((med, i) => {
                const start = new Date(med.starttime).getTime();
                const end = med.stoptime ? new Date(med.stoptime).getTime() : start + 86400000;
                const left = ((start - minTime) / span) * 100;
                const width = Math.max(0.5, ((end - start) / span) * 100);
                return (
                  <div
                    key={i}
                    className={`absolute top-0 h-full rounded-sm bg-success transition-opacity hover:opacity-100 ${onDrugClick ? 'cursor-pointer' : 'cursor-default'}`}
                    style={{ left: `${left}%`, width: `${width}%`, opacity: 0.65 }}
                    onClick={() => onDrugClick?.(med)}
                    onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, med, drug })}
                    onMouseMove={(e) => setTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                    onMouseLeave={() => setTooltip(null)}
                    role={onDrugClick ? 'button' : undefined}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 rounded-lg border border-surface-highlight bg-surface-overlay px-3 py-2 text-xs text-text-secondary shadow-xl pointer-events-none max-w-[280px]"
          style={{ top: tooltip.y - 80, left: tooltip.x + 16 }}
        >
          <div className="font-medium text-text-primary">{tooltip.drug}</div>
          {tooltip.med.route && (
            <div className="text-text-muted">
              {t('morpheus.medications.route')} {tooltip.med.route}
            </div>
          )}
          {(tooltip.med.dose_val_rx || tooltip.med.dose_unit_rx) && (
            <div className="text-text-muted">
              {t('morpheus.medications.dose')} {tooltip.med.dose_val_rx} {tooltip.med.dose_unit_rx}
            </div>
          )}
          <div className="text-text-ghost mt-0.5">
            {new Date(tooltip.med.starttime).toLocaleString()}
            {tooltip.med.stoptime ? ` \u2014 ${new Date(tooltip.med.stoptime).toLocaleString()}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
