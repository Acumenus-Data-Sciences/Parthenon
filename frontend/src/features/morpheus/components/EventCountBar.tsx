import type { MorpheusEventCounts } from '../api';

interface EventCountBarProps {
  counts: MorpheusEventCounts;
}

const DOMAIN_CONFIG = [
  { key: 'admissions', label: 'Admissions', color: '#2DD4BF' },
  { key: 'icu_stays', label: 'ICU Stays', color: '#9B1B30' },
  { key: 'transfers', label: 'Transfers', color: '#818CF8' },
  { key: 'diagnoses', label: 'Diagnoses', color: '#E85A6B' },
  { key: 'procedures', label: 'Procedures', color: '#C9A227' },
  { key: 'prescriptions', label: 'Medications', color: '#22C55E' },
  { key: 'lab_results', label: 'Labs', color: '#3B82F6' },
  { key: 'vitals', label: 'Vitals', color: '#F97316' },
  { key: 'input_events', label: 'Inputs', color: '#06B6D4' },
  { key: 'output_events', label: 'Outputs', color: '#A855F7' },
  { key: 'microbiology', label: 'Micro', color: '#EC4899' },
] as const;

export default function EventCountBar({ counts }: EventCountBarProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {DOMAIN_CONFIG.map(({ key, label, color }) => {
        const count = counts[key] ?? 0;
        if (count === 0) return null;
        return (
          <div
            key={key}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1A1A2E] border border-gray-800 shrink-0"
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-gray-400">{label}</span>
            <span className="text-[11px] font-semibold text-gray-200">{count.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}
