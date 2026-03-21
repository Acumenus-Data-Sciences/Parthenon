import { useState } from 'react';
import type { PatientFilters } from '../api';

interface FilterBarProps {
  filters: PatientFilters;
  onChange: (filters: PatientFilters) => void;
  totalShown: number;
  totalAll: number;
}

export default function FilterBar({ filters, onChange, totalShown, totalAll }: FilterBarProps) {
  const [showClinical, setShowClinical] = useState(false);
  const [dxInput, setDxInput] = useState(filters.diagnosis || '');

  const update = (partial: Partial<PatientFilters>) => {
    onChange({ ...filters, ...partial });
  };

  const clearAll = () => {
    setDxInput('');
    onChange({});
  };

  const activeCount = Object.values(filters).filter(v => v !== undefined && v !== '').length;

  return (
    <div className="space-y-2">
      {/* Primary filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* ICU toggle */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-[#8A857D] mr-1">ICU:</span>
          {(['all', 'yes', 'no'] as const).map(opt => (
            <button key={opt} onClick={() => update({ icu: opt === 'all' ? undefined : opt === 'yes' })}
              className={`px-2 py-1 rounded text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-[#9B1B30]/30 ${
                (opt === 'all' && filters.icu === undefined) ||
                (opt === 'yes' && filters.icu === true) ||
                (opt === 'no' && filters.icu === false)
                  ? 'bg-[#9B1B30] text-white font-medium'
                  : 'border border-zinc-700 bg-zinc-900/50 text-[#8A857D] hover:text-[#C5C0B8]'
              }`}>{opt === 'all' ? 'All' : opt === 'yes' ? 'Yes' : 'No'}</button>
          ))}
        </div>

        {/* Mortality toggle */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-[#8A857D] mr-1">Mortality:</span>
          {(['all', 'survived', 'deceased'] as const).map(opt => (
            <button key={opt} onClick={() => update({ deceased: opt === 'all' ? undefined : opt === 'deceased' })}
              className={`px-2 py-1 rounded text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-[#9B1B30]/30 ${
                (opt === 'all' && filters.deceased === undefined) ||
                (opt === 'survived' && filters.deceased === false) ||
                (opt === 'deceased' && filters.deceased === true)
                  ? 'bg-[#9B1B30] text-white font-medium'
                  : 'border border-zinc-700 bg-zinc-900/50 text-[#8A857D] hover:text-[#C5C0B8]'
              }`}>{opt === 'all' ? 'All' : opt === 'survived' ? 'Survived' : 'Deceased'}</button>
          ))}
        </div>

        {/* LOS inputs */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-[#8A857D]">LOS:</span>
          <input type="number" placeholder="Min" min={0} step={1}
            value={filters.min_los ?? ''}
            onChange={e => update({ min_los: e.target.value ? Number(e.target.value) : undefined })}
            className="w-14 px-1.5 py-1 rounded bg-[#0E0E11] border border-zinc-800 text-[#C5C0B8] text-xs focus:border-[#9B1B30] focus:outline-none focus:ring-1 focus:ring-[#9B1B30]/30 transition-colors" />
          <span className="text-[#5A5650]">&mdash;</span>
          <input type="number" placeholder="Max" min={0} step={1}
            value={filters.max_los ?? ''}
            onChange={e => update({ max_los: e.target.value ? Number(e.target.value) : undefined })}
            className="w-14 px-1.5 py-1 rounded bg-[#0E0E11] border border-zinc-800 text-[#C5C0B8] text-xs focus:border-[#9B1B30] focus:outline-none focus:ring-1 focus:ring-[#9B1B30]/30 transition-colors" />
          <span className="text-[#5A5650] text-[10px]">days</span>
        </div>

        {/* Clinical filter toggle */}
        <button onClick={() => setShowClinical(!showClinical)}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          {showClinical ? '\u25BE Clinical' : '\u25B8 Clinical'}
        </button>

        {/* Active filter count + clear */}
        {activeCount > 0 && (
          <>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#9B1B30]/20 text-[#E85A6B]">{activeCount} active</span>
            <button onClick={clearAll} className="text-[10px] text-zinc-500 hover:text-zinc-300 underline">Clear all</button>
          </>
        )}

        {/* Result count */}
        <span className="ml-auto text-[11px] text-zinc-500">
          Showing {totalShown} of {totalAll} patients
        </span>
      </div>

      {/* Clinical filters (collapsed) */}
      {showClinical && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8A857D]">Diagnosis:</span>
          <input type="text" placeholder="Search ICD code or description..."
            value={dxInput}
            onChange={e => setDxInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') update({ diagnosis: dxInput || undefined }); }}
            onBlur={() => update({ diagnosis: dxInput || undefined })}
            className="w-64 px-2 py-1 rounded bg-[#0E0E11] border border-zinc-800 text-[#C5C0B8] text-xs placeholder:text-[#5A5650] focus:border-[#9B1B30] focus:outline-none focus:ring-1 focus:ring-[#9B1B30]/30 transition-colors" />
        </div>
      )}
    </div>
  );
}
