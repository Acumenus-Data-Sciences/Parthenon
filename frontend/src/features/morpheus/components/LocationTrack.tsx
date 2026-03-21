import { useMemo } from 'react';
import type { MorpheusTransfer, MorpheusIcuStay } from '../api';

interface LocationTrackProps {
  transfers: MorpheusTransfer[];
  icuStays: MorpheusIcuStay[];
}

// Color map for care unit types
const UNIT_COLORS: Record<string, string> = {
  'Emergency Department': '#E85A6B',
  'Medical Intensive Care Unit (MICU)': '#9B1B30',
  'Surgical Intensive Care Unit (SICU)': '#9B1B30',
  'Trauma SICU (TSICU)': '#9B1B30',
  'Cardiac Vascular Intensive Care Unit (CVICU)': '#9B1B30',
  'Coronary Care Unit (CCU)': '#9B1B30',
  'Medical/Surgical Intensive Care Unit (MICU/SICU)': '#9B1B30',
  'Neuro Intermediate': '#C9A227',
  'Neuro Stepdown': '#C9A227',
  'PACU': '#818CF8',
  'Discharge Lounge': '#6B7280',
};

function getUnitColor(careunit: string | null): string {
  if (!careunit) return '#374151';
  for (const [key, color] of Object.entries(UNIT_COLORS)) {
    if (careunit.includes(key) || key.includes(careunit)) return color;
  }
  // ICU units get crimson, others get teal
  if (careunit.toLowerCase().includes('icu') || careunit.toLowerCase().includes('intensive')) return '#9B1B30';
  return '#2DD4BF';
}

function isIcuUnit(careunit: string | null): boolean {
  if (!careunit) return false;
  const lower = careunit.toLowerCase();
  return lower.includes('icu') || lower.includes('intensive') || lower.includes('ccu');
}

export default function LocationTrack({ transfers, icuStays }: LocationTrackProps) {
  const segments = useMemo(() => {
    if (!transfers.length) return [];

    // Filter to admit/transfer events (skip discharge events without careunit)
    const events = transfers
      .filter(t => t.careunit || t.eventtype === 'discharge')
      .map(t => ({
        id: t.transfer_id,
        careunit: t.careunit || 'Discharged',
        eventtype: t.eventtype,
        start: new Date(t.intime),
        end: t.outtime ? new Date(t.outtime) : null,
        durationHours: t.duration_hours,
        isIcu: isIcuUnit(t.careunit),
        color: getUnitColor(t.careunit),
      }));

    // Calculate time span for scaling
    const minTime = Math.min(...events.map(e => e.start.getTime()));
    const maxTime = Math.max(...events.map(e => (e.end || e.start).getTime()));
    const span = maxTime - minTime || 1;

    return events.map(e => ({
      ...e,
      leftPct: ((e.start.getTime() - minTime) / span) * 100,
      widthPct: Math.max(1, (((e.end || e.start).getTime() - e.start.getTime()) / span) * 100),
    }));
  }, [transfers]);

  if (!segments.length) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-[#151518] p-5 text-zinc-500 text-sm">
        No transfer data available
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#151518] p-5">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">Location Track</h3>

      {/* Location bar */}
      <div className="relative h-10 bg-[#0E0E11] rounded-md overflow-hidden mb-2">
        {segments.map((seg) => (
          <div
            key={seg.id}
            className="absolute top-0 h-full flex items-center justify-center text-[10px] font-medium text-white overflow-hidden border-r border-[#0E0E11] group cursor-default"
            style={{
              left: `${seg.leftPct}%`,
              width: `${seg.widthPct}%`,
              backgroundColor: seg.color,
              opacity: seg.eventtype === 'discharge' ? 0.5 : 1,
            }}
            title={`${seg.careunit}\n${seg.start.toLocaleString()}${seg.end ? ' \u2014 ' + seg.end.toLocaleString() : ''}\n${seg.durationHours ? seg.durationHours.toFixed(1) + 'h' : ''}`}
          >
            <span className="truncate px-1">
              {seg.widthPct > 8 ? seg.careunit : ''}
            </span>
          </div>
        ))}
      </div>

      {/* ICU overlay indicators */}
      {icuStays.length > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">ICU Stays:</span>
          {icuStays.map((icu) => (
            <span
              key={icu.stay_id}
              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#9B1B30]/20 text-[#E85A6B] border border-zinc-800"
            >
              {icu.first_careunit} &mdash; {Number(icu.los_days).toFixed(1)}d
            </span>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#E85A6B]" /> ED</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#9B1B30]" /> ICU</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#C9A227]" /> Step-down</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2DD4BF]" /> Floor</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#818CF8]" /> PACU</span>
      </div>
    </div>
  );
}
