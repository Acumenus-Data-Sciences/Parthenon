import { useMorpheusDatasets } from '../api';
import { useTranslation } from 'react-i18next';

interface DatasetSelectorProps {
  selectedSchema: string;
  onSelect: (schema: string) => void;
}

export default function DatasetSelector({ selectedSchema, onSelect }: DatasetSelectorProps) {
  const { t } = useTranslation('app');
  const { data: datasets, isLoading } = useMorpheusDatasets();

  if (isLoading || !datasets?.length) return null;

  if (datasets.length === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border-default bg-surface-base/50 text-xs text-text-secondary">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        {datasets[0].name}
        {datasets[0].patient_count != null && (
          <span className="text-text-ghost">
            {t('morpheus.dataset.patientsSuffix', {
              count: Number(datasets[0].patient_count).toLocaleString(),
            })}
          </span>
        )}
      </span>
    );
  }

  return (
    <select
      value={selectedSchema}
      onChange={(e) => onSelect(e.target.value)}
      className="rounded-lg border border-border-default bg-surface-base/50 px-3 py-1.5 text-xs text-text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
    >
      {datasets.map((ds) => (
        <option key={ds.schema_name} value={ds.schema_name}>
          {ds.name} {ds.patient_count != null
            ? t('morpheus.dataset.patientsShortSuffix', {
                count: Number(ds.patient_count).toLocaleString(),
              })
            : ''}
        </option>
      ))}
    </select>
  );
}
