import type { MorpheusDiagnosis } from '../api';
import { useTranslation } from 'react-i18next';

interface DiagnosisListProps {
  diagnoses: MorpheusDiagnosis[];
}

export default function DiagnosisList({ diagnoses }: DiagnosisListProps) {
  const { t } = useTranslation('app');

  if (!diagnoses.length) {
    return (
      <div className="text-text-ghost text-sm p-5">
        {t('morpheus.common.data.noDiagnosesRecorded')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-darkest/70">
      <table className="min-w-full divide-y divide-border-default text-left text-sm text-text-secondary">
        <thead className="bg-surface-base/70 text-xs uppercase tracking-wide text-text-ghost">
          <tr>
            <th className="px-3 py-2 font-semibold w-8">#</th>
            <th className="px-3 py-2 font-semibold w-24">{t('morpheus.diagnoses.icdCode')}</th>
            <th className="px-3 py-2 font-semibold">{t('morpheus.diagnoses.description')}</th>
            <th className="px-3 py-2 font-semibold">{t('morpheus.diagnoses.standardConcept')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default">
          {diagnoses.map((dx) => (
            <tr key={`${dx.hadm_id}-${dx.seq_num}`} className="hover:bg-surface-base/50">
              <td className="px-3 py-2 align-top text-text-ghost">{dx.seq_num}</td>
              <td className="px-3 py-2 align-top">
                <span className="font-mono text-accent">{dx.icd_code}</span>
                <span className="text-text-ghost ml-1">v{dx.icd_version}</span>
              </td>
              <td className="px-3 py-2 align-top text-text-secondary">{dx.description || '\u2014'}</td>
              <td className="px-3 py-2 align-top">
                {dx.concept_id ? (
                  <span className="text-success">{dx.standard_concept_name}</span>
                ) : (
                  <span className="text-text-ghost">{t('morpheus.common.values.unmapped')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
