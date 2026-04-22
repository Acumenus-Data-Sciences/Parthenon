import type { MorpheusAdmission } from '../api';
import { useTranslation } from 'react-i18next';

interface AdmissionPickerProps {
  admissions: MorpheusAdmission[];
  selectedHadmId: string | null;
  onSelect: (hadmId: string | null) => void;
}

export default function AdmissionPicker({ admissions, selectedHadmId, onSelect }: AdmissionPickerProps) {
  const { t } = useTranslation('app');
  if (!admissions.length) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30 ${
          selectedHadmId === null
            ? 'bg-primary text-primary-foreground'
            : 'border border-border-default bg-surface-base/50 text-text-muted hover:text-text-secondary'
        }`}
      >
        {t('morpheus.journey.admissionPicker.allAdmissions', {
          count: admissions.length,
        })}
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
                ? 'bg-primary text-primary-foreground'
                : 'border border-border-default bg-surface-base/50 text-text-muted hover:text-text-secondary'
            }`}
          >
            {start.toLocaleDateString()} {'\u2014'} {adm.admission_type} ({los}
            {t('morpheus.common.values.daysShort')})
            {adm.hospital_expire_flag === '1' && (
              <span
                className="ml-1 text-critical"
                title={t('morpheus.common.tooltips.diedInHospital')}
              >
                {'\u2020'}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
