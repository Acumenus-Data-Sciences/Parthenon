// frontend/src/features/morpheus/components/AntibiogramHeatmap.tsx
import { useMemo, useState } from 'react';
import type { MorpheusMicrobiology } from '../api';
import { sortAntibioticsByClass } from '../constants/antibioticClasses';
import HoverCard from './HoverCard';
import type { DrawerEvent } from './ConceptDetailDrawer';

interface AntibiogramHeatmapProps {
  data: MorpheusMicrobiology[];
  onOrganismClick: (event: DrawerEvent) => void;
}

const INTERP_COLORS: Record<string, string> = {
  S: '#22C55E',
  I: '#EAB308',
  R: '#E85A6B',
};

interface CellData {
  interpretation: string;
  mic: string | null;
  specimen: string;
  date: string;
}

export default function AntibiogramHeatmap({ data, onOrganismClick }: AntibiogramHeatmapProps) {
  const [specimenFilter, setSpecimenFilter] = useState<string>('');
  const [showTestedOnly, setShowTestedOnly] = useState(true);

  const specimens = useMemo(() => {
    const set = new Set<string>();
    for (const d of data) set.add(d.spec_type_desc);
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!specimenFilter) return data;
    return data.filter((d) => d.spec_type_desc === specimenFilter);
  }, [data, specimenFilter]);

  const { organisms, antibiotics, matrix } = useMemo(() => {
    // Count organisms by frequency
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

    const abs = sortAntibioticsByClass(Array.from(abSet));

    return { organisms: orgs, antibiotics: abs, matrix: cellMap };
  }, [filtered]);

  if (organisms.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-[#323238] bg-[#151518]">
        <p className="text-sm text-[#8A857D]">No antibiogram data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={specimenFilter}
          onChange={(e) => setSpecimenFilter(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-[#C5C0B8] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30"
        >
          <option value="">All specimens</option>
          {specimens.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-[#8A857D] cursor-pointer">
          <input
            type="checkbox"
            checked={showTestedOnly}
            onChange={() => setShowTestedOnly(!showTestedOnly)}
            className="w-3 h-3 rounded"
          />
          Show tested only
        </label>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/70">
        <table className="text-[10px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-zinc-900 px-2 py-1 text-left text-[#8A857D] font-semibold min-w-[160px]">Organism</th>
              {antibiotics.map((ab) => (
                <th key={ab} className="px-1 py-1 font-normal text-[#8A857D] whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 80 }}>
                  {ab}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {organisms.map((org) => (
              <tr key={org} className="hover:bg-[#1A1A1E]">
                <td className="sticky left-0 bg-zinc-950/70 px-2 py-1">
                  <button
                    type="button"
                    onClick={() => onOrganismClick({
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
                    })}
                    className="text-left text-[#C5C0B8] hover:text-[#2DD4BF] transition-colors truncate max-w-[160px] block"
                  >
                    {org}
                  </button>
                </td>
                {antibiotics.map((ab) => {
                  const key = `${org}::${ab}`;
                  const cell = matrix.get(key);
                  if (!cell && showTestedOnly) {
                    return <td key={ab} />;
                  }
                  if (!cell) {
                    return <td key={ab} className="px-1 py-1 text-center text-[#323238]">&mdash;</td>;
                  }
                  const color = INTERP_COLORS[cell.interpretation] ?? '#5A5650';
                  return (
                    <td key={ab} className="px-1 py-1 text-center">
                      <HoverCard content={
                        <div className="space-y-1">
                          <div className="font-semibold text-[#F0EDE8]">{org}</div>
                          <div>{ab}: <strong style={{ color }}>{cell.interpretation}</strong></div>
                          {cell.mic && <div>MIC: {cell.mic}</div>}
                          <div>{cell.specimen} &bull; {cell.date}</div>
                        </div>
                      }>
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold cursor-default"
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          {cell.interpretation}
                        </span>
                      </HoverCard>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
