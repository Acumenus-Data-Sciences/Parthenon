// frontend/src/features/morpheus/components/GroupedDiagnosisList.tsx
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MorpheusDiagnosis } from '../api';
import type { DrawerEvent } from './ConceptDetailDrawer';

interface GroupedDiagnosisListProps {
  diagnoses: MorpheusDiagnosis[];
  onConceptClick: (event: DrawerEvent) => void;
}

interface DiagnosisGroup {
  icd_code: string;
  icd_version: string;
  description: string;
  concept_id: number | null;
  standard_concept_name: string | null;
  occurrences: MorpheusDiagnosis[];
}

export default function GroupedDiagnosisList({ diagnoses, onConceptClick }: GroupedDiagnosisListProps) {
  const { t } = useTranslation('app');
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, DiagnosisGroup>();
    for (const dx of diagnoses) {
      const key = `${dx.icd_code}-${dx.icd_version}`;
      const existing = map.get(key);
      if (existing) {
        existing.occurrences.push(dx);
      } else {
        map.set(key, {
          icd_code: dx.icd_code,
          icd_version: dx.icd_version,
          description: dx.description || '\u2014',
          concept_id: dx.concept_id ?? null,
          standard_concept_name: dx.standard_concept_name ?? null,
          occurrences: [dx],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.occurrences.length - a.occurrences.length);
  }, [diagnoses]);

  if (groups.length === 0) {
        return (
          <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-surface-highlight bg-surface-raised">
        <p className="text-sm text-text-muted">{t('morpheus.common.data.noDiagnosesRecorded')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-darkest/70 divide-y divide-border-default">
      {groups.map((g) => {
        const key = `${g.icd_code}-${g.icd_version}`;
        const isExpanded = expandedCode === key;
        const count = g.occurrences.length;

        return (
          <div key={key}>
            <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-overlay transition-colors">
              {count > 1 && (
                <button type="button" onClick={() => setExpandedCode(isExpanded ? null : key)}
                  className="focus:outline-none focus:ring-1 focus:ring-success/30 rounded">
                  <ChevronDown size={12} className={`text-text-ghost transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
              {count === 1 && <span className="w-3" />}

              <button
                type="button"
                onClick={() => onConceptClick({
                  domain: 'diagnosis',
                  concept_id: g.concept_id,
                  concept_name: g.description,
                  source_code: g.icd_code,
                  source_vocabulary: `ICD${g.icd_version}`,
                  standard_concept_name: g.standard_concept_name,
                  start_date: null, end_date: null,
                  value: null, unit: null, ref_range_lower: null, ref_range_upper: null,
                  route: null, dose: null, days_supply: null,
                  seq_num: g.occurrences[0]?.seq_num != null ? Number(g.occurrences[0].seq_num) : null,
                  hadm_id: g.occurrences[0]?.hadm_id ?? null,
                  occurrenceCount: count,
                  sparklineValues: [],
                })}
                className="font-mono text-xs text-accent hover:text-text-primary transition-colors focus:outline-none focus:ring-1 focus:ring-accent/30 rounded"
              >
                {g.icd_code}
              </button>
              <span className="text-xs text-text-ghost">v{g.icd_version}</span>
              <span className="text-xs text-text-secondary truncate flex-1">{g.description}</span>

              {g.concept_id ? (
                <span className="text-xs text-success shrink-0">{g.standard_concept_name}</span>
              ) : (
                <span className="text-[10px] text-text-ghost shrink-0">
                  {t('morpheus.common.values.unmapped')}
                </span>
              )}

              {count > 1 && (
                <span className="text-[10px] font-semibold text-text-muted shrink-0">
                  {'\u00d7'}
                  {count}
                </span>
              )}
            </div>

            {isExpanded && count > 1 && (
              <div className="px-8 pb-2">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-text-ghost uppercase tracking-wider">
                      <th className="text-left py-1">{t('morpheus.diagnoses.admission')}</th>
                      <th className="text-left py-1">{t('morpheus.diagnoses.sequence')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/50">
                    {g.occurrences.map((dx, i) => (
                      <tr key={i} className="hover:bg-surface-overlay">
                        <td className="py-1 font-mono text-success">{dx.hadm_id}</td>
                        <td className="py-1 text-text-muted">#{dx.seq_num}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
