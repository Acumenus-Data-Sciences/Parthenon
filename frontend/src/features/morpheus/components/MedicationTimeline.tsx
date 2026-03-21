import { useMemo, useState, useCallback } from 'react';
import type { MorpheusMedication } from '../api';
import HoverCard from './HoverCard';

interface MedicationTimelineProps {
  medications: MorpheusMedication[];
  onDrugClick?: (med: MorpheusMedication) => void;
}

export default function MedicationTimeline({ medications, onDrugClick }: MedicationTimelineProps) {
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

    // Group by drug name, show top 20 by count
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

  const [panOffset, setPanOffset] = useState(0);
  const [zoom, setZoom] = useState(1);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setPanOffset((p) => p - 20); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setPanOffset((p) => p + 20); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom((z) => Math.min(z * 1.2, 5)); }
    else if (e.key === '-') { e.preventDefault(); setZoom((z) => Math.max(z / 1.2, 0.5)); }
  }, []);

  if (!lanes.length) {
    return <div className="text-zinc-500 text-sm p-5">No medication data available</div>;
  }

  const span = maxTime - minTime || 1;

  return (
    <div
      className="rounded-xl border border-zinc-800 bg-[#151518] p-5 focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="img"
      aria-label="Medication timeline"
    >
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">
        Medications (top {lanes.length} by frequency)
      </h3>
      <div className="space-y-1" style={{ transform: `scaleX(${zoom}) translateX(${panOffset}px)`, transformOrigin: 'left center' }}>
        {lanes.map(({ drug, meds }) => (
          <div key={drug} className="flex items-center gap-2 h-5">
            <div className="w-32 truncate text-[10px] text-zinc-400 text-right shrink-0" title={drug}>
              {drug}
            </div>
            <div className="flex-1 relative h-3 bg-[#0E0E11] rounded-sm overflow-hidden">
              {meds.map((med, i) => {
                const start = new Date(med.starttime).getTime();
                const end = med.stoptime ? new Date(med.stoptime).getTime() : start + 86400000;
                const left = ((start - minTime) / span) * 100;
                const width = Math.max(0.5, ((end - start) / span) * 100);
                return (
                  <HoverCard
                    key={i}
                    content={
                      <div>
                        <div className="font-medium text-[#F0EDE8]">{drug}</div>
                        {med.route && <div>Route: {med.route}</div>}
                        {(med.dose_val_rx || med.dose_unit_rx) && <div>Dose: {med.dose_val_rx} {med.dose_unit_rx}</div>}
                        <div>{new Date(med.starttime).toLocaleString()}{med.stoptime ? ` \u2014 ${new Date(med.stoptime).toLocaleString()}` : ''}</div>
                      </div>
                    }
                  >
                    <div
                      className={`absolute top-0 h-full rounded-sm bg-[#22C55E] opacity-70 hover:opacity-100 ${onDrugClick ? 'cursor-pointer' : ''}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      onClick={() => onDrugClick?.(med)}
                      role={onDrugClick ? 'button' : undefined}
                    />
                  </HoverCard>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
