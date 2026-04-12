// frontend/src/features/morpheus/components/LabPanelDashboard.tsx
import { useMemo, useState } from 'react';
import { ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MorpheusLabResult } from '../api';
import { LAB_PANELS, findLabPanel, type LabPanelConfig } from '../constants/labPanels';
import LabSparkline from './LabSparkline';
import LabTimeSeriesChart from './LabTimeSeriesChart';
import type { DrawerEvent } from './ConceptDetailDrawer';

interface LabPanelDashboardProps {
  labs: MorpheusLabResult[];
  onConceptClick: (event: DrawerEvent) => void;
}

interface LabGroup {
  itemid: string;
  label: string;
  values: { date: string; value: number }[];
  rangeLow: number | null;
  rangeHigh: number | null;
  latest: number;
  latestDate: string;
  unit: string;
  count: number;
}

function getSeverity(value: number, low: number | null, high: number | null): 'normal' | 'mild' | 'moderate' | 'critical' {
  if (low == null && high == null) return 'normal';
  if (low != null && value < low) {
    const pct = low > 0 ? ((low - value) / low) * 100 : 0;
    if (pct > 50) return 'critical';
    if (pct > 25) return 'moderate';
    return 'mild';
  }
  if (high != null && value > high) {
    const pct = high > 0 ? ((value - high) / high) * 100 : 0;
    if (pct > 50) return 'critical';
    if (pct > 25) return 'moderate';
    return 'mild';
  }
  return 'normal';
}

const SEVERITY_COLORS = {
  normal: '#22C55E',
  mild: '#EAB308',
  moderate: '#F97316',
  critical: 'var(--critical)',
};

function TrendIcon({ values }: { values: number[] }) {
  if (values.length < 2) return <Minus size={12} className="text-text-ghost" />;
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (last > prev * 1.05) return <TrendingUp size={12} className="text-critical" />;
  if (last < prev * 0.95) return <TrendingDown size={12} className="text-info" />;
  return <Minus size={12} className="text-success" />;
}

export default function LabPanelDashboard({ labs, onConceptClick }: LabPanelDashboardProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, LabGroup>();
    for (const lab of labs) {
      const num = lab.valuenum != null ? Number(lab.valuenum) : null;
      if (num == null || isNaN(num)) continue;

      const existing = map.get(lab.itemid);
      if (existing) {
        existing.values.push({ date: lab.charttime, value: num });
        existing.count++;
        if (new Date(lab.charttime) > new Date(existing.latestDate)) {
          existing.latest = num;
          existing.latestDate = lab.charttime;
        }
        if (lab.ref_range_lower != null) existing.rangeLow = Number(lab.ref_range_lower);
        if (lab.ref_range_upper != null) existing.rangeHigh = Number(lab.ref_range_upper);
      } else {
        map.set(lab.itemid, {
          itemid: lab.itemid,
          label: lab.label,
          values: [{ date: lab.charttime, value: num }],
          rangeLow: lab.ref_range_lower != null ? Number(lab.ref_range_lower) : null,
          rangeHigh: lab.ref_range_upper != null ? Number(lab.ref_range_upper) : null,
          latest: num,
          latestDate: lab.charttime,
          unit: lab.valueuom ?? '',
          count: 1,
        });
      }
    }
    // Sort values chronologically within each group
    for (const g of map.values()) {
      g.values.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return map;
  }, [labs]);

  // Organize into panels
  const panels = useMemo(() => {
    const result: { panel: LabPanelConfig; tests: LabGroup[] }[] = [];
    const ungrouped: LabGroup[] = [];

    for (const panel of LAB_PANELS) {
      const tests: LabGroup[] = [];
      for (const g of groups.values()) {
        if (findLabPanel(g.label)?.name === panel.name) {
          tests.push(g);
        }
      }
      if (tests.length > 0) {
        tests.sort((a, b) => a.label.localeCompare(b.label));
        result.push({ panel, tests });
      }
    }

    // Collect ungrouped
    for (const g of groups.values()) {
      if (!findLabPanel(g.label)) ungrouped.push(g);
    }
    if (ungrouped.length > 0) {
      ungrouped.sort((a, b) => a.label.localeCompare(b.label));
      result.push({
        panel: { name: 'Other', color: "var(--text-muted)", tests: [] },
        tests: ungrouped,
      });
    }

    return result;
  }, [groups]);

  if (panels.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-surface-highlight bg-surface-raised">
        <p className="text-sm text-text-muted">No numeric lab results available</p>
      </div>
    );
  }

  const handleConceptClick = (g: LabGroup) => {
    onConceptClick({
      domain: 'lab',
      concept_id: Number(g.itemid) || null,
      concept_name: g.label,
      source_code: g.itemid,
      source_vocabulary: 'MIMIC-IV d_labitems',
      standard_concept_name: null,
      start_date: g.latestDate,
      end_date: null,
      value: g.latest,
      unit: g.unit,
      ref_range_lower: g.rangeLow,
      ref_range_upper: g.rangeHigh,
      route: null,
      dose: null,
      days_supply: null,
      seq_num: null,
      hadm_id: null,
      occurrenceCount: g.count,
      sparklineValues: g.values.map((v) => v.value),
    });
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-text-muted">
        {groups.size} tests · {labs.filter((l) => l.valuenum != null).length} numeric values
      </div>

      {/* Masonry two-column layout — panels pack tightly with no wasted vertical space */}
      <div className="columns-2 gap-3 [column-fill:balance]">
        {panels.map(({ panel, tests }) => {
          const isOpen = expandedPanel === panel.name || expandedPanel === null;

          return (
            <div key={panel.name} className="rounded-xl border border-zinc-800/60 bg-surface-base overflow-hidden mb-3 break-inside-avoid">
              <button
                type="button"
                onClick={() => setExpandedPanel(expandedPanel === panel.name ? null : panel.name)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-overlay transition-colors focus:outline-none focus:ring-1 focus:ring-success/30"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: panel.color }} />
                  <span className="text-xs font-semibold text-text-primary">{panel.name}</span>
                  <span className="text-[10px] text-text-ghost">{tests.length} tests</span>
                </div>
                <ChevronDown size={12} className={`text-text-ghost transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="divide-y divide-zinc-800/30">
                  {tests.map((g) => {
                    const severity = getSeverity(g.latest, g.rangeLow, g.rangeHigh);
                    const isExpanded = expandedRow === g.itemid;
                    const vals = g.values.map((v) => v.value);

                    return (
                      <div key={g.itemid}>
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-overlay transition-colors cursor-pointer"
                          onClick={() => setExpandedRow(isExpanded ? null : g.itemid)}
                        >
                          <ChevronDown size={10} className={`text-text-ghost transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleConceptClick(g); }}
                            className="text-[11px] text-text-secondary hover:text-success truncate w-[120px] shrink-0 text-left transition-colors"
                          >
                            {g.label}
                          </button>
                          <span className="text-[9px] text-text-ghost shrink-0 w-6 text-right">×{g.count}</span>
                          {/* Sparkline stretches to fill remaining space */}
                          <div className="flex-1 min-w-0">
                            <LabSparkline values={vals} rangeLow={g.rangeLow} rangeHigh={g.rangeHigh} width={999} height={24} />
                          </div>
                          <span className="text-xs font-semibold text-text-primary shrink-0 tabular-nums text-right" style={{ minWidth: 52 }}>
                            {g.latest.toFixed(1)}
                            <span className="text-[9px] text-text-ghost ml-0.5">{g.unit}</span>
                          </span>
                          <TrendIcon values={vals} />
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SEVERITY_COLORS[severity] }} title={severity} />
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-3">
                            <LabTimeSeriesChart data={g.values} rangeLow={g.rangeLow} rangeHigh={g.rangeHigh} unit={g.unit} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
