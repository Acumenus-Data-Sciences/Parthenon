import type { MorpheusAdmission } from '../api';

interface AdmissionPickerProps {
  admissions: MorpheusAdmission[];
  selectedHadmId: string | null;
  onSelect: (hadmId: string | null) => void;
}

export default function AdmissionPicker({ admissions, selectedHadmId, onSelect }: AdmissionPickerProps) {
  if (!admissions.length) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30 ${
          selectedHadmId === null
            ? 'bg-primary text-white'
            : 'border border-zinc-700 bg-zinc-900/50 text-text-muted hover:text-text-secondary'
        }`}
      >
        All Admissions ({admissions.length})
      </button>
      {admissions.map((adm) => {
        const start = new Date(adm.admittime);
        const los = Number(adm.los_days).toFixed(1);
        return (
          <button
            key={adm.hadm_id}
            onClick={() => onSelect(adm.hadm_id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30 ${
              selectedHadmId === adm.hadm_id
                ? 'bg-primary text-white'
                : 'border border-zinc-700 bg-zinc-900/50 text-text-muted hover:text-text-secondary'
            }`}
          >
            {start.toLocaleDateString()} &mdash; {adm.admission_type} ({los}d)
            {adm.hospital_expire_flag === '1' && (
              <span className="ml-1 text-critical" title="Died in hospital">&dagger;</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
