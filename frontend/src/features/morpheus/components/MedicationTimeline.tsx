import { useMemo } from 'react';
import type { MorpheusMedication } from '../api';

interface MedicationTimelineProps {
  medications: MorpheusMedication[];
}

export default function MedicationTimeline({ medications }: MedicationTimelineProps) {
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

  if (!lanes.length) {
    return <div className="text-gray-500 text-sm p-4">No medication data available</div>;
  }

  const span = maxTime - minTime || 1;

  return (
    <div className="rounded-lg border border-gray-800 bg-[#1A1A2E] p-4">
      <h3 className="text-sm font-medium text-gray-300 mb-3">
        Medications (top {lanes.length} by frequency)
      </h3>
      <div className="space-y-1">
        {lanes.map(({ drug, meds }) => (
          <div key={drug} className="flex items-center gap-2 h-5">
            <div className="w-32 truncate text-[10px] text-gray-400 text-right shrink-0" title={drug}>
              {drug}
            </div>
            <div className="flex-1 relative h-3 bg-[#0E0E11] rounded-sm overflow-hidden">
              {meds.map((med, i) => {
                const start = new Date(med.starttime).getTime();
                const end = med.stoptime ? new Date(med.stoptime).getTime() : start + 86400000;
                const left = ((start - minTime) / span) * 100;
                const width = Math.max(0.5, ((end - start) / span) * 100);
                return (
                  <div
                    key={i}
                    className="absolute top-0 h-full rounded-sm bg-[#22C55E] opacity-70 hover:opacity-100"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${drug}\n${med.route || ''} ${med.dose_val_rx || ''} ${med.dose_unit_rx || ''}\n${new Date(med.starttime).toLocaleString()}${med.stoptime ? ' \u2014 ' + new Date(med.stoptime).toLocaleString() : ''}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
