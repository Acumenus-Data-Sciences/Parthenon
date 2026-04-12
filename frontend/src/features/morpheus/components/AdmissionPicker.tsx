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
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-[#9B1B30]/30 ${
          selectedHadmId === null
            ? 'bg-[#9B1B30] text-white'
            : 'border border-border-default bg-surface-base/50 text-[#8A857D] hover:text-[#C5C0B8]'
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
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-[#9B1B30]/30 ${
              selectedHadmId === adm.hadm_id
                ? 'bg-[#9B1B30] text-white'
                : 'border border-border-default bg-surface-base/50 text-[#8A857D] hover:text-[#C5C0B8]'
            }`}
          >
            {start.toLocaleDateString()} &mdash; {adm.admission_type} ({los}d)
            {adm.hospital_expire_flag === '1' && (
              <span className="ml-1 text-[#E85A6B]" title="Died in hospital">&dagger;</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
