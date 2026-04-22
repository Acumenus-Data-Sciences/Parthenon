import type { MorpheusEventCounts } from '../api';
import { useTranslation } from 'react-i18next';
import { getMorpheusEventDomainLabel } from '../lib/i18n';
import { DOMAIN_COLORS } from '../constants/domainColors';

interface EventCountBarProps {
  counts: MorpheusEventCounts;
  onDomainClick?: (domain: string) => void;
}

const DOMAIN_CONFIG = [
  { key: 'admissions', color: DOMAIN_COLORS.admission },
  { key: 'icu_stays', color: '#9B1B30' },
  { key: 'transfers', color: DOMAIN_COLORS.visit },
  { key: 'diagnoses', color: DOMAIN_COLORS.diagnosis },
  { key: 'procedures', color: DOMAIN_COLORS.procedure },
  { key: 'prescriptions', color: DOMAIN_COLORS.drug },
  { key: 'lab_results', color: DOMAIN_COLORS.lab },
  { key: 'vitals', color: DOMAIN_COLORS.vital },
  { key: 'input_events', color: '#06B6D4' },
  { key: 'output_events', color: '#A855F7' },
  { key: 'microbiology', color: DOMAIN_COLORS.microbiology },
] as const;

export default function EventCountBar({ counts, onDomainClick }: EventCountBarProps) {
  const { t } = useTranslation('app');

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {DOMAIN_CONFIG.map(({ key, color }) => {
        const count = counts[key] ?? 0;
        if (count === 0) return null;
        const isClickable = !!onDomainClick;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onDomainClick?.(key)}
            disabled={!isClickable}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border-default bg-surface-darkest/70 shrink-0 transition-colors
              ${isClickable ? 'cursor-pointer hover:bg-surface-overlay' : ''}
              focus:outline-none focus:ring-1 focus:ring-success/30`}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-text-muted">
              {getMorpheusEventDomainLabel(t, key)}
            </span>
            <span className="text-[11px] font-semibold text-text-primary">{count.toLocaleString()}</span>
          </button>
        );
      })}
    </div>
  );
}
