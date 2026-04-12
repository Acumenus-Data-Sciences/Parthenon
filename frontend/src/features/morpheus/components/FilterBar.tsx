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
          <span className="text-text-muted mr-1">ICU:</span>
          {(['all', 'yes', 'no'] as const).map(opt => (
            <button key={opt} onClick={() => update({ icu: opt === 'all' ? undefined : opt === 'yes' })}
              className={`px-2 py-1 rounded text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-[#9B1B30]/30 ${
                (opt === 'all' && filters.icu === undefined) ||
                (opt === 'yes' && filters.icu === true) ||
                (opt === 'no' && filters.icu === false)
                  ? 'bg-primary text-text-primary font-medium'
                  : 'border border-border-default bg-surface-base/50 text-text-muted hover:text-text-secondary'
              }`}>{opt === 'all' ? 'All' : opt === 'yes' ? 'Yes' : 'No'}</button>
          ))}
        </div>

        {/* Mortality toggle */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-text-muted mr-1">Mortality:</span>
          {(['all', 'survived', 'deceased'] as const).map(opt => (
            <button key={opt} onClick={() => update({ deceased: opt === 'all' ? undefined : opt === 'deceased' })}
              className={`px-2 py-1 rounded text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-[#9B1B30]/30 ${
                (opt === 'all' && filters.deceased === undefined) ||
                (opt === 'survived' && filters.deceased === false) ||
                (opt === 'deceased' && filters.deceased === true)
                  ? 'bg-primary text-text-primary font-medium'
                  : 'border border-border-default bg-surface-base/50 text-text-muted hover:text-text-secondary'
              }`}>{opt === 'all' ? 'All' : opt === 'survived' ? 'Survived' : 'Deceased'}</button>
          ))}
        </div>

        {/* LOS inputs */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-text-muted">LOS:</span>
          <input type="number" placeholder="Min" min={0} step={1}
            value={filters.min_los ?? ''}
            onChange={e => update({ min_los: e.target.value ? Number(e.target.value) : undefined })}
            className="w-14 px-1.5 py-1 rounded bg-surface-base border border-border-default text-text-secondary text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-[#9B1B30]/30 transition-colors" />
          <span className="text-text-ghost">&mdash;</span>
          <input type="number" placeholder="Max" min={0} step={1}
            value={filters.max_los ?? ''}
            onChange={e => update({ max_los: e.target.value ? Number(e.target.value) : undefined })}
            className="w-14 px-1.5 py-1 rounded bg-surface-base border border-border-default text-text-secondary text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-[#9B1B30]/30 transition-colors" />
          <span className="text-text-ghost text-[10px]">days</span>
        </div>

        {/* Clinical filter toggle */}
        <button onClick={() => setShowClinical(!showClinical)}
          className="text-xs text-text-ghost hover:text-text-secondary transition-colors">
          {showClinical ? '\u25BE Clinical' : '\u25B8 Clinical'}
        </button>

        {/* Active filter count + clear */}
        {activeCount > 0 && (
          <>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-critical">{activeCount} active</span>
            <button onClick={clearAll} className="text-[10px] text-text-ghost hover:text-text-secondary underline">Clear all</button>
          </>
        )}

        {/* Result count */}
        <span className="ml-auto text-[11px] text-text-ghost">
          Showing {totalShown} of {totalAll} patients
        </span>
      </div>

      {/* Clinical filters (collapsed) */}
      {showClinical && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Diagnosis:</span>
          <input type="text" placeholder="Search ICD code or description..."
            value={dxInput}
            onChange={e => setDxInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') update({ diagnosis: dxInput || undefined }); }}
            onBlur={() => update({ diagnosis: dxInput || undefined })}
            className="w-64 px-2 py-1 rounded bg-surface-base border border-border-default text-text-secondary text-xs placeholder:text-text-ghost focus:border-primary focus:outline-none focus:ring-1 focus:ring-[#9B1B30]/30 transition-colors" />
        </div>
      )}
    </div>
  );
}
