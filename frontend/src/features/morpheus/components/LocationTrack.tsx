import { useMemo, useState, useCallback } from 'react';
import type { MorpheusTransfer, MorpheusIcuStay } from '../api';

interface LocationTrackProps {
  transfers: MorpheusTransfer[];
  icuStays: MorpheusIcuStay[];
}

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
  if (careunit.toLowerCase().includes('icu') || careunit.toLowerCase().includes('intensive')) return '#9B1B30';
  return '#2DD4BF';
}

function isIcuUnit(careunit: string | null): boolean {
  if (!careunit) return false;
  const lower = careunit.toLowerCase();
  return lower.includes('icu') || lower.includes('intensive') || lower.includes('ccu');
}

interface Segment {
  id: string;
  careunit: string;
  eventtype: string;
  start: Date;
  end: Date | null;
  durationHours: number | null;
  isIcu: boolean;
  color: string;
  leftPct: number;
  widthPct: number;
}

export default function LocationTrack({ transfers, icuStays }: LocationTrackProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; seg: Segment } | null>(null);
  const [panOffset, setPanOffset] = useState(0);
  const [zoom, setZoom] = useState(1);

  const segments = useMemo<Segment[]>(() => {
    if (!transfers.length) return [];

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

    const minTime = Math.min(...events.map(e => e.start.getTime()));
    const maxTime = Math.max(...events.map(e => (e.end || e.start).getTime()));
    const span = maxTime - minTime || 1;

    return events.map(e => ({
      ...e,
      leftPct: ((e.start.getTime() - minTime) / span) * 100,
      widthPct: Math.max(1, (((e.end || e.start).getTime() - e.start.getTime()) / span) * 100),
    }));
  }, [transfers]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setPanOffset((p) => p - 20); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setPanOffset((p) => p + 20); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom((z) => Math.min(z * 1.2, 5)); }
    else if (e.key === '-') { e.preventDefault(); setZoom((z) => Math.max(z / 1.2, 0.5)); }
  }, []);

  if (!segments.length) {
    return (
      <div className="flex items-center justify-center h-20 rounded-lg border border-dashed border-[#323238] bg-[#151518]">
        <p className="text-sm text-[#8A857D]">No transfer data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default/60 bg-[#111114] p-4">
      <h3 className="text-xs font-semibold text-[#C5C0B8] mb-3">Location Track</h3>

      {/* Timeline bar */}
      <div
        className="relative h-10 bg-[#0E0E11] rounded-md overflow-hidden mb-2 focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="img"
        aria-label="Patient location track timeline"
        style={{ transform: `scaleX(${zoom}) translateX(${panOffset}px)`, transformOrigin: 'left center' }}
      >
        {segments.map((seg) => (
          <div
            key={seg.id}
            className="absolute top-0 h-full flex items-center justify-center text-[10px] font-medium text-white overflow-hidden border-r border-[#0E0E11] cursor-default transition-opacity hover:opacity-100"
            style={{
              left: `${seg.leftPct}%`,
              width: `${seg.widthPct}%`,
              backgroundColor: seg.color,
              opacity: seg.eventtype === 'discharge' ? 0.5 : 0.85,
            }}
            onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, seg })}
            onMouseMove={(e) => setTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
            onMouseLeave={() => setTooltip(null)}
          >
            <span className="truncate px-1">{seg.widthPct > 8 ? seg.careunit : ''}</span>
          </div>
        ))}
      </div>

      {/* ICU stays badges */}
      {icuStays.length > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[9px] text-[#5A5650] uppercase tracking-wider">ICU:</span>
          {icuStays.map((icu) => (
            <span key={icu.stay_id}
              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#9B1B30]/15 text-[#E85A6B] border border-[#9B1B30]/30">
              {icu.first_careunit} — {Number(icu.los_days).toFixed(1)}d
            </span>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-[#8A857D]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#E85A6B]" /> ED</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#9B1B30]" /> ICU</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#C9A227]" /> Step-down</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2DD4BF]" /> Floor</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#818CF8]" /> PACU</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 rounded-lg border border-[#323238] bg-[#1A1A1E] px-3 py-2 text-xs text-[#C5C0B8] shadow-xl pointer-events-none max-w-[280px]"
          style={{ top: tooltip.y - 80, left: tooltip.x + 16 }}
        >
          <div className="font-medium text-[#F0EDE8]">{tooltip.seg.careunit}</div>
          <div className="text-[#8A857D] mt-0.5">
            {tooltip.seg.start.toLocaleString()}{tooltip.seg.end ? ` — ${tooltip.seg.end.toLocaleString()}` : ''}
          </div>
          {tooltip.seg.durationHours && (
            <div className="text-[#8A857D]">Duration: {Number(tooltip.seg.durationHours).toFixed(1)}h</div>
          )}
          {tooltip.seg.isIcu && <div className="text-[#E85A6B] font-medium mt-0.5">ICU Stay</div>}
        </div>
      )}
    </div>
  );
}
