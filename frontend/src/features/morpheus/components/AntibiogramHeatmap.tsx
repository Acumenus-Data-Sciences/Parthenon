import { useMemo, useState } from 'react';
import type { MorpheusMicrobiology } from '../api';
import { getAntibioticClass, sortAntibioticsByClass } from '../constants/antibioticClasses';
import type { DrawerEvent } from './ConceptDetailDrawer';

interface AntibiogramHeatmapProps {
  data: MorpheusMicrobiology[];
  onOrganismClick: (event: DrawerEvent) => void;
}

// Parthenon theme colors — accessible for deuteranopia (teal vs crimson has strong luminance contrast)
const INTERP_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  S: { bg: 'rgba(45,212,191,0.20)', text: '#2DD4BF', label: 'Susceptible' },
  I: { bg: 'rgba(201,162,39,0.20)', text: '#C9A227', label: 'Intermediate' },
  R: { bg: 'rgba(155,27,48,0.25)', text: '#E85A6B', label: 'Resistant' },
};

// Common antibiotic abbreviations
const AB_ABBREV: Record<string, string> = {
  'ampicillin': 'AMP', 'ampicillin/sulbactam': 'AMP/S', 'piperacillin/tazobactam': 'PIP/T',
  'oxacillin': 'OXA', 'penicillin g': 'PEN', 'penicillin': 'PEN',
  'cefazolin': 'CFZ', 'ceftriaxone': 'CRO', 'ceftazidime': 'CAZ', 'cefepime': 'FEP', 'cefoxitin': 'FOX',
  'meropenem': 'MEM', 'imipenem': 'IPM', 'ertapenem': 'ETP', 'doripenem': 'DOR',
  'ciprofloxacin': 'CIP', 'levofloxacin': 'LVX', 'moxifloxacin': 'MXF',
  'gentamicin': 'GEN', 'tobramycin': 'TOB', 'amikacin': 'AMK',
  'vancomycin': 'VAN', 'erythromycin': 'ERY', 'azithromycin': 'AZM', 'clindamycin': 'CLI',
  'tetracycline': 'TCY', 'doxycycline': 'DOX',
  'trimethoprim/sulfa': 'SXT', 'trimethoprim/sulfamethoxazole': 'SXT',
  'nitrofurantoin': 'NIT', 'linezolid': 'LZD', 'daptomycin': 'DAP',
  'colistin': 'CST', 'metronidazole': 'MTZ', 'rifampin': 'RIF',
};

function abbreviate(name: string): string {
  return AB_ABBREV[name.toLowerCase()] ?? name.slice(0, 4).toUpperCase();
}

interface CellData {
  interpretation: string;
  mic: string | null;
  specimen: string;
  date: string;
}

interface DrugClassGroup {
  name: string;
  antibiotics: string[];
}

export default function AntibiogramHeatmap({ data, onOrganismClick }: AntibiogramHeatmapProps) {
  const [specimenFilter, setSpecimenFilter] = useState('');
  const [showTestedOnly, setShowTestedOnly] = useState(true);
  const [hoverCol, setHoverCol] = useState<string | null>(null);
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; org: string; ab: string; cell: CellData } | null>(null);

  const specimens = useMemo(() => {
    const set = new Set<string>();
    for (const d of data) set.add(d.spec_type_desc);
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!specimenFilter) return data;
    return data.filter((d) => d.spec_type_desc === specimenFilter);
  }, [data, specimenFilter]);

  const { organisms, orgCounts, drugClassGroups, antibiotics, matrix } = useMemo(() => {
    const orgCount = new Map<string, number>();
    const abSet = new Set<string>();
    const cellMap = new Map<string, CellData>();

    for (const d of filtered) {
      if (!d.org_name || !d.ab_name || !d.interpretation) continue;
      orgCount.set(d.org_name, (orgCount.get(d.org_name) ?? 0) + 1);
      abSet.add(d.ab_name);
      const key = `${d.org_name}::${d.ab_name}`;
      cellMap.set(key, {
        interpretation: d.interpretation,
        mic: d.dilution_comparison && d.dilution_value ? `${d.dilution_comparison}${d.dilution_value}` : null,
        specimen: d.spec_type_desc,
        date: d.chartdate,
      });
    }

    const orgs = Array.from(orgCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const sortedAbs = sortAntibioticsByClass(Array.from(abSet));

    // Build drug class groups for header
    const groups: DrugClassGroup[] = [];
    let currentClass = '';
    for (const ab of sortedAbs) {
      const cls = getAntibioticClass(ab).name;
      if (cls !== currentClass) {
        groups.push({ name: cls, antibiotics: [ab] });
        currentClass = cls;
      } else {
        groups[groups.length - 1].antibiotics.push(ab);
      }
    }

    return { organisms: orgs, orgCounts: orgCount, drugClassGroups: groups, antibiotics: sortedAbs, matrix: cellMap };
  }, [filtered]);

  if (organisms.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-surface-highlight bg-surface-raised">
        <p className="text-sm text-text-muted">No antibiogram data available</p>
      </div>
    );
  }

  const makeDrawerEvent = (org: string): DrawerEvent => ({
    domain: 'microbiology',
    concept_id: null,
    concept_name: org,
    source_code: null,
    source_vocabulary: 'MIMIC-IV microbiologyevents',
    standard_concept_name: null,
    start_date: null, end_date: null,
    value: null, unit: null, ref_range_lower: null, ref_range_upper: null,
    route: null, dose: null, days_supply: null, seq_num: null, hadm_id: null,
    occurrenceCount: filtered.filter((d) => d.org_name === org).length,
    sparklineValues: [],
  });

  return (
    <div className="space-y-3">
      {/* Toolbar: filters + legend */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <select
            value={specimenFilter}
            onChange={(e) => setSpecimenFilter(e.target.value)}
            className="rounded-lg border border-border-default bg-surface-base px-2.5 py-1.5 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30"
          >
            <option value="">All specimens</option>
            {specimens.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer select-none">
            <input type="checkbox" checked={showTestedOnly} onChange={() => setShowTestedOnly(!showTestedOnly)}
              className="w-3 h-3 rounded accent-[#2DD4BF]" />
            Tested only
          </label>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px]">
          {Object.entries(INTERP_STYLE).map(([key, style]) => (
            <span key={key} className="flex items-center gap-1">
              <span className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold"
                style={{ backgroundColor: style.bg, color: style.text }}>{key}</span>
              <span className="text-text-muted">{style.label}</span>
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded bg-surface-overlay flex items-center justify-center text-[9px] text-text-ghost">—</span>
            <span className="text-text-muted">Not tested</span>
          </span>
        </div>
      </div>

      {/* Antibiogram matrix */}
      <div className="overflow-x-auto rounded-xl border border-border-default/60 bg-surface-base">
        <table className="border-collapse" style={{ minWidth: 'max-content' }}>
          <thead>
            {/* Drug class group header row */}
            <tr className="sticky top-0 z-30 bg-surface-base">
              <th className="sticky left-0 z-40 bg-surface-base min-w-[200px]" />
              {drugClassGroups.map((group) => (
                <th
                  key={group.name}
                  colSpan={group.antibiotics.length}
                  className="px-1 pt-2 pb-1 text-center text-[9px] font-semibold uppercase tracking-wider text-text-ghost border-b border-surface-highlight"
                  style={{ borderLeft: '2px solid #1E1E24' }}
                >
                  {group.name}
                </th>
              ))}
            </tr>
            {/* Antibiotic name header row */}
            <tr className="sticky top-[28px] z-30 bg-surface-base">
              <th className="sticky left-0 z-40 bg-surface-base px-3 py-1 text-left text-[10px] font-semibold text-text-muted min-w-[200px] border-b border-surface-highlight">
                Organism
              </th>
              {antibiotics.map((ab, abIdx) => {
                const isFirstInClass = abIdx === 0 || getAntibioticClass(ab).name !== getAntibioticClass(antibiotics[abIdx - 1]).name;
                return (
                  <th
                    key={ab}
                    className={`py-1 text-center border-b border-surface-highlight cursor-default ${hoverCol === ab ? 'bg-surface-overlay' : ''}`}
                    style={{
                      width: 36,
                      minWidth: 36,
                      ...(isFirstInClass ? { borderLeft: '2px solid #1E1E24' } : {}),
                    }}
                    onMouseEnter={() => setHoverCol(ab)}
                    onMouseLeave={() => setHoverCol(null)}
                    title={ab}
                  >
                    <span className="text-[10px] font-medium text-text-muted">{abbreviate(ab)}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {organisms.map((org) => {
              const count = orgCounts.get(org) ?? 0;
              const isLowCount = count < 30;
              return (
                <tr
                  key={org}
                  className={`transition-colors ${hoverRow === org ? 'bg-surface-overlay' : ''}`}
                  onMouseEnter={() => setHoverRow(org)}
                  onMouseLeave={() => setHoverRow(null)}
                >
                  <td className="sticky left-0 z-10 bg-surface-base px-3 py-1.5 border-b border-border-subtle"
                    style={hoverRow === org ? { backgroundColor: '#1A1A1E' } : {}}
                  >
                    <button
                      type="button"
                      onClick={() => onOrganismClick(makeDrawerEvent(org))}
                      className="text-left group max-w-[190px] block"
                    >
                      <span className="text-[11px] text-text-secondary group-hover:text-success transition-colors italic truncate block">
                        {org}
                      </span>
                      <span className={`text-[9px] ${isLowCount ? 'text-accent' : 'text-text-ghost'}`}>
                        n={count}{isLowCount ? '*' : ''}
                      </span>
                    </button>
                  </td>
                  {antibiotics.map((ab, abIdx) => {
                    const key = `${org}::${ab}`;
                    const cell = matrix.get(key);
                    const isFirstInClass = abIdx === 0 || getAntibioticClass(ab).name !== getAntibioticClass(antibiotics[abIdx - 1]).name;
                    const isColHover = hoverCol === ab;

                    if (!cell) {
                      if (showTestedOnly) {
                        return (
                          <td key={ab} className="border-b border-border-subtle"
                            style={{
                              width: 36, minWidth: 36,
                              ...(isFirstInClass ? { borderLeft: '2px solid #1E1E24' } : {}),
                              ...(isColHover ? { backgroundColor: '#151518' } : {}),
                            }}
                          />
                        );
                      }
                      return (
                        <td key={ab} className="text-center border-b border-border-subtle"
                          style={{
                            width: 36, minWidth: 36,
                            backgroundColor: isColHover ? '#151518' : '#0E0E11',
                            ...(isFirstInClass ? { borderLeft: '2px solid #1E1E24' } : {}),
                          }}
                        >
                          <span className="text-[9px] text-surface-overlay">&mdash;</span>
                        </td>
                      );
                    }

                    const style = INTERP_STYLE[cell.interpretation];
                    return (
                      <td
                        key={ab}
                        className="text-center border-b border-border-subtle cursor-default"
                        style={{
                          width: 36, minWidth: 36,
                          ...(isFirstInClass ? { borderLeft: '2px solid #1E1E24' } : {}),
                          ...(isColHover ? { backgroundColor: '#1A1A1E' } : {}),
                        }}
                        onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, org, ab, cell })}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <span
                          className="inline-flex items-center justify-center w-7 h-6 rounded text-[10px] font-bold"
                          style={{
                            backgroundColor: style?.bg ?? 'transparent',
                            color: style?.text ?? '#5A5650',
                          }}
                        >
                          {cell.interpretation}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Low isolate count footnote */}
      {organisms.some((org) => (orgCounts.get(org) ?? 0) < 30) && (
        <p className="text-[10px] text-accent">
          * Organisms with &lt;30 isolates — interpret with caution (CLSI M39)
        </p>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 rounded-lg border border-surface-highlight bg-surface-overlay px-3 py-2 text-xs text-text-secondary shadow-xl pointer-events-none max-w-[240px]"
          style={{ top: tooltip.y - 80, left: tooltip.x + 16 }}
        >
          <div className="font-medium text-text-primary italic">{tooltip.org}</div>
          <div className="mt-1">
            <span className="text-text-muted">{tooltip.ab}:</span>{' '}
            <span className="font-bold" style={{ color: INTERP_STYLE[tooltip.cell.interpretation]?.text }}>
              {INTERP_STYLE[tooltip.cell.interpretation]?.label ?? tooltip.cell.interpretation}
            </span>
          </div>
          {tooltip.cell.mic && <div className="text-text-muted">MIC: <span className="font-mono text-text-secondary">{tooltip.cell.mic}</span></div>}
          <div className="text-text-ghost mt-0.5">{tooltip.cell.specimen} &bull; {tooltip.cell.date}</div>
        </div>
      )}
    </div>
  );
}
