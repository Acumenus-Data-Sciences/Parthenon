import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PatientFilters } from '../api';

interface FilterBarProps {
  filters: PatientFilters;
  onChange: (filters: PatientFilters) => void;
  totalShown: number;
  totalAll: number;
}

export default function FilterBar({ filters, onChange, totalShown, totalAll }: FilterBarProps) {
  const { t } = useTranslation('app');
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
          <span className="text-text-muted mr-1">{t('morpheus.common.filters.icu')}</span>
          {(['all', 'yes', 'no'] as const).map(opt => (
            <button key={opt} onClick={() => update({ icu: opt === 'all' ? undefined : opt === 'yes' })}
              className={`px-2 py-1 rounded text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30 ${
                (opt === 'all' && filters.icu === undefined) ||
                (opt === 'yes' && filters.icu === true) ||
                (opt === 'no' && filters.icu === false)
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'border border-border-default bg-surface-base/50 text-text-muted hover:text-text-secondary'
              }`}>{opt === 'all' ? t('morpheus.common.filters.all') : opt === 'yes' ? t('morpheus.common.values.yes') : t('morpheus.common.values.no')}</button>
          ))}
        </div>

        {/* Mortality toggle */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-text-muted mr-1">{t('morpheus.common.filters.mortality')}</span>
          {(['all', 'survived', 'deceased'] as const).map(opt => (
            <button key={opt} onClick={() => update({ deceased: opt === 'all' ? undefined : opt === 'deceased' })}
              className={`px-2 py-1 rounded text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30 ${
                (opt === 'all' && filters.deceased === undefined) ||
                (opt === 'survived' && filters.deceased === false) ||
                (opt === 'deceased' && filters.deceased === true)
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'border border-border-default bg-surface-base/50 text-text-muted hover:text-text-secondary'
              }`}>{opt === 'all' ? t('morpheus.common.filters.all') : opt === 'survived' ? t('morpheus.common.filters.survived') : t('morpheus.common.filters.deceased')}</button>
          ))}
        </div>

        {/* LOS inputs */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-text-muted">{t('morpheus.common.filters.los')}</span>
          <input type="number" placeholder={t('morpheus.common.filters.min')} min={0} step={1}
            value={filters.min_los ?? ''}
            onChange={e => update({ min_los: e.target.value ? Number(e.target.value) : undefined })}
            className="w-14 px-1.5 py-1 rounded bg-surface-base border border-border-default text-text-secondary text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors" />
          <span className="text-text-ghost">{'\u2014'}</span>
          <input type="number" placeholder={t('morpheus.common.filters.max')} min={0} step={1}
            value={filters.max_los ?? ''}
            onChange={e => update({ max_los: e.target.value ? Number(e.target.value) : undefined })}
            className="w-14 px-1.5 py-1 rounded bg-surface-base border border-border-default text-text-secondary text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors" />
          <span className="text-text-ghost text-[10px]">{t('morpheus.common.filters.days')}</span>
        </div>

        {/* Clinical filter toggle */}
        <button onClick={() => setShowClinical(!showClinical)}
          className="text-xs text-text-ghost hover:text-text-secondary transition-colors">
          {showClinical
            ? t('morpheus.common.filters.clinicalExpanded')
            : t('morpheus.common.filters.clinicalCollapsed')}
        </button>

        {/* Active filter count + clear */}
        {activeCount > 0 && (
          <>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-critical">
              {t('morpheus.common.filters.activeCount', { count: activeCount })}
            </span>
            <button onClick={clearAll} className="text-[10px] text-text-ghost hover:text-text-secondary underline">
              {t('morpheus.common.actions.clearAll')}
            </button>
          </>
        )}

        {/* Result count */}
        <span className="ml-auto text-[11px] text-text-ghost">
          {t('morpheus.common.counts.showingPatients', {
            shown: totalShown,
            total: totalAll,
          })}
        </span>
      </div>

      {/* Clinical filters (collapsed) */}
      {showClinical && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">{t('morpheus.common.filters.diagnosis')}</span>
          <input type="text" placeholder={t('morpheus.common.filters.diagnosisPlaceholder')}
            value={dxInput}
            onChange={e => setDxInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') update({ diagnosis: dxInput || undefined }); }}
            onBlur={() => update({ diagnosis: dxInput || undefined })}
            className="w-64 px-2 py-1 rounded bg-surface-base border border-border-default text-text-secondary text-xs placeholder:text-text-ghost focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors" />
        </div>
      )}
    </div>
  );
}
