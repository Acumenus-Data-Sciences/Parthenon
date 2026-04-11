import type { MorpheusEventCounts } from '../api';
import { DOMAIN_COLORS } from '../constants/domainColors';

interface EventCountBarProps {
  counts: MorpheusEventCounts;
  onDomainClick?: (domain: string) => void;
}

const DOMAIN_CONFIG = [
  { key: 'admissions', label: 'Admissions', color: DOMAIN_COLORS.admission },
  { key: 'icu_stays', label: 'ICU Stays', color: "var(--primary)" },
  { key: 'transfers', label: 'Transfers', color: DOMAIN_COLORS.visit },
  { key: 'diagnoses', label: 'Diagnoses', color: DOMAIN_COLORS.diagnosis },
  { key: 'procedures', label: 'Procedures', color: DOMAIN_COLORS.procedure },
  { key: 'prescriptions', label: 'Medications', color: DOMAIN_COLORS.drug },
  { key: 'lab_results', label: 'Labs', color: DOMAIN_COLORS.lab },
  { key: 'vitals', label: 'Vitals', color: DOMAIN_COLORS.vital },
  { key: 'input_events', label: 'Inputs', color: '#06B6D4' },
  { key: 'output_events', label: 'Outputs', color: '#A855F7' },
  { key: 'microbiology', label: 'Micro', color: DOMAIN_COLORS.microbiology },
] as const;

export default function EventCountBar({ counts, onDomainClick }: EventCountBarProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {DOMAIN_CONFIG.map(({ key, label, color }) => {
        const count = counts[key] ?? 0;
        if (count === 0) return null;
        const isClickable = !!onDomainClick;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onDomainClick?.(key)}
            disabled={!isClickable}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-950/70 shrink-0 transition-colors
              ${isClickable ? 'cursor-pointer hover:bg-surface-overlay' : ''}
              focus:outline-none focus:ring-1 focus:ring-success/30`}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-text-muted">{label}</span>
            <span className="text-[11px] font-semibold text-text-primary">{count.toLocaleString()}</span>
          </button>
        );
      })}
    </div>
  );
}
