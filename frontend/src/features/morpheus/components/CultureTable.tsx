// frontend/src/features/morpheus/components/CultureTable.tsx
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MorpheusMicrobiology } from '../api';
import type { DrawerEvent } from './ConceptDetailDrawer';

interface CultureTableProps {
  data: MorpheusMicrobiology[];
  onOrganismClick: (event: DrawerEvent) => void;
}

const INTERP_COLORS: Record<string, { bg: string; text: string }> = {
  S: { bg: 'bg-green-500/10', text: 'text-green-400' },
  I: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  R: { bg: 'bg-red-500/10', text: 'text-red-400' },
};

interface CultureGroup {
  key: string;
  specimen: string;
  date: string;
  organism: string | null;
  sensitivities: MorpheusMicrobiology[];
}

export default function CultureTable({ data, onOrganismClick }: CultureTableProps) {
  const { t } = useTranslation('app');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, CultureGroup>();
    for (const d of data) {
      const key = `${d.chartdate}-${d.spec_type_desc}-${d.org_name ?? 'no-org'}`;
      const existing = map.get(key);
      if (existing) {
        if (d.ab_name) existing.sensitivities.push(d);
      } else {
        map.set(key, {
          key,
          specimen: d.spec_type_desc,
          date: d.chartdate,
          organism: d.org_name,
          sensitivities: d.ab_name ? [d] : [],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-surface-highlight bg-surface-raised">
        <p className="text-sm text-text-muted">{t('morpheus.common.data.noCultureData')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-darkest/70 divide-y divide-border-default">
      {groups.map((g) => {
        const isExpanded = expandedKey === g.key;
        const sCount = g.sensitivities.filter((s) => s.interpretation === 'S').length;
        const iCount = g.sensitivities.filter((s) => s.interpretation === 'I').length;
        const rCount = g.sensitivities.filter((s) => s.interpretation === 'R').length;

        return (
          <div key={g.key}>
            <button
              type="button"
              onClick={() => setExpandedKey(isExpanded ? null : g.key)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-overlay transition-colors text-left focus:outline-none focus:ring-1 focus:ring-success/30"
            >
              <ChevronDown size={12} className={`text-text-ghost transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
              <span className="text-xs text-text-muted shrink-0 w-20">{g.date}</span>
              <span className="text-xs text-text-secondary shrink-0 w-32 truncate">{g.specimen}</span>
              {g.organism ? (
                <span
                  className="text-xs text-domain-procedure hover:underline cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOrganismClick({
                      domain: 'microbiology', concept_id: null, concept_name: g.organism!,
                      source_code: null, source_vocabulary: 'MIMIC-IV', standard_concept_name: null,
                      start_date: g.date, end_date: null, value: null, unit: null,
                      ref_range_lower: null, ref_range_upper: null, route: null, dose: null,
                      days_supply: null, seq_num: null, hadm_id: null,
                      occurrenceCount: data.filter((d) => d.org_name === g.organism).length,
                      sparklineValues: [],
                    });
                  }}
                >
                  {g.organism}
                </span>
              ) : (
                <span className="text-xs text-text-ghost">{t('morpheus.common.data.noGrowth')}</span>
              )}
              {g.sensitivities.length > 0 && (
                <div className="flex items-center gap-1.5 ml-auto text-[10px]">
                  {sCount > 0 && <span className="px-1.5 rounded bg-green-500/10 text-green-400">S:{sCount}</span>}
                  {iCount > 0 && <span className="px-1.5 rounded bg-yellow-500/10 text-yellow-400">I:{iCount}</span>}
                  {rCount > 0 && <span className="px-1.5 rounded bg-red-500/10 text-red-400">R:{rCount}</span>}
                </div>
              )}
            </button>

            {isExpanded && g.sensitivities.length > 0 && (
              <div className="px-8 pb-3">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-text-ghost uppercase tracking-wider">
                      <th className="text-left py-1">{t('morpheus.culture.antibiotic')}</th>
                      <th className="text-center py-1 w-16">{t('morpheus.culture.result')}</th>
                      <th className="text-left py-1">{t('morpheus.culture.mic')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/50">
                    {g.sensitivities.map((s, i) => {
                      const style = INTERP_COLORS[s.interpretation ?? ''];
                      return (
                        <tr key={i} className="hover:bg-surface-overlay">
                          <td className="py-1 text-text-secondary">{s.ab_name}</td>
                          <td className="py-1 text-center">
                            {s.interpretation && style ? (
                              <span className={`inline-block px-1.5 rounded text-[10px] font-bold ${style.bg} ${style.text}`}>
                                {s.interpretation}
                              </span>
                            ) : (
                              <span className="text-text-ghost">{'\u2014'}</span>
                            )}
                          </td>
                          <td className="py-1 text-text-muted font-mono">
                            {s.dilution_comparison && s.dilution_value
                              ? `${s.dilution_comparison}${s.dilution_value}`
                              : '\u2014'}
                          </td>
                        </tr>
                      );
                    })}
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
