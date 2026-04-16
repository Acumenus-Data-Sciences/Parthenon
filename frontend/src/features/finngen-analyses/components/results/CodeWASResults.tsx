// frontend/src/features/finngen-analyses/components/results/CodeWASResults.tsx
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CodeWASDisplay, CodeWASSignal } from "../../types";
import { Download } from "lucide-react";

// Domain color palette
const DOMAIN_COLORS: Record<string, string> = {
  Condition: "#9B1B30",
  Drug: "#C9A227",
  Procedure: "#2DD4BF",
  Measurement: "#6366F1",
  Observation: "#EC4899",
  Device: "#F97316",
  Visit: "#8B5CF6",
};

type SortKey = "p_value" | "beta" | "concept_name";

interface CodeWASResultsProps {
  display: CodeWASDisplay;
}

export function CodeWASResults({ display }: CodeWASResultsProps) {
  const [sortKey, setSortKey] = useState<SortKey>("p_value");
  const [sortAsc, setSortAsc] = useState(true);

  // Prepare Manhattan data: assign x position based on domain grouping
  const manhattanData = useMemo(() => {
    const domains = Array.from(new Set(display.signals.map((s) => s.domain_id))).sort();
    let xOffset = 0;
    const points: { x: number; y: number; signal: CodeWASSignal; domain: string }[] = [];

    for (const domain of domains) {
      const domainSignals = display.signals.filter((s) => s.domain_id === domain);
      for (let i = 0; i < domainSignals.length; i++) {
        const s = domainSignals[i];
        const negLog10 = s.p_value > 0 ? -Math.log10(s.p_value) : 0;
        points.push({
          x: xOffset + i,
          y: negLog10,
          signal: s,
          domain,
        });
      }
      xOffset += domainSignals.length + 5; // gap between domains
    }
    return points;
  }, [display.signals]);

  // Sort signals for table
  const sortedSignals = useMemo(() => {
    const sorted = [...display.signals].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return sorted;
  }, [display.signals, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "p_value");
    }
  }

  // Threshold lines (in -log10 space)
  const bonferroniLine = display.thresholds.bonferroni > 0
    ? -Math.log10(display.thresholds.bonferroni)
    : null;
  const suggestiveLine = display.thresholds.suggestive > 0
    ? -Math.log10(display.thresholds.suggestive)
    : null;

  function exportCsv() {
    const header = "concept_id,concept_name,domain_id,p_value,beta,se,n_cases,n_controls\n";
    const rows = display.signals
      .map((s) =>
        [s.concept_id, `"${s.concept_name}"`, s.domain_id, s.p_value, s.beta, s.se, s.n_cases, s.n_controls].join(","),
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "codewas_signals.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex gap-4 text-xs text-text-muted">
        <span>{display.summary.total_codes_tested} codes tested</span>
        <span>{display.summary.significant_count} significant</span>
      </div>

      {/* Manhattan plot */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4">
        <h3 className="text-xs font-semibold text-text-secondary mb-3">Manhattan Plot</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
            <XAxis
              type="number"
              dataKey="x"
              tick={false}
              label={{ value: "Concepts (grouped by domain)", position: "insideBottom", offset: -10, fontSize: 10, fill: "var(--text-ghost)" }}
            />
            <YAxis
              type="number"
              dataKey="y"
              label={{ value: "-log10(p)", angle: -90, position: "insideLeft", fontSize: 10, fill: "var(--text-ghost)" }}
              tick={{ fontSize: 10, fill: "var(--text-ghost)" }}
            />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const pt = payload[0].payload as (typeof manhattanData)[number];
                return (
                  <div className="rounded border border-border-default bg-surface-overlay px-3 py-2 text-xs shadow">
                    <p className="font-medium text-text-primary">{pt.signal.concept_name}</p>
                    <p className="text-text-muted">Domain: {pt.signal.domain_id}</p>
                    <p className="text-text-muted">p = {pt.signal.p_value.toExponential(2)}</p>
                    <p className="text-text-muted">beta = {pt.signal.beta.toFixed(3)}</p>
                    <p className="text-text-muted">N cases: {pt.signal.n_cases}</p>
                  </div>
                );
              }}
            />
            {bonferroniLine !== null && (
              <ReferenceLine y={bonferroniLine} stroke="#9B1B30" strokeDasharray="5 5" label={{ value: "Bonferroni", fontSize: 9, fill: "#9B1B30" }} />
            )}
            {suggestiveLine !== null && (
              <ReferenceLine y={suggestiveLine} stroke="#C9A227" strokeDasharray="3 3" label={{ value: "Suggestive", fontSize: 9, fill: "#C9A227" }} />
            )}
            <Scatter
              data={manhattanData}
              fill="#2DD4BF"
              fillOpacity={0.7}
              r={3}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Signal table */}
      <div className="rounded-lg border border-border-default bg-surface-raised">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <h3 className="text-xs font-semibold text-text-secondary">Signal Table</h3>
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1 text-xs text-text-ghost hover:text-success transition-colors"
          >
            <Download size={12} />
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default text-text-ghost">
                {(
                  [
                    ["concept_name", "Concept"],
                    ["domain_id", "Domain"],
                    ["p_value", "p-value"],
                    ["beta", "Beta"],
                    ["se", "SE"],
                    ["n_cases", "Cases"],
                    ["n_controls", "Controls"],
                  ] as const
                ).map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key as SortKey)}
                    className="cursor-pointer px-3 py-2 text-left font-medium hover:text-text-secondary"
                  >
                    {label}
                    {sortKey === key && (sortAsc ? " \u2191" : " \u2193")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedSignals.slice(0, 200).map((s) => (
                <tr key={s.concept_id} className="border-b border-border-default/50 hover:bg-surface-overlay/30">
                  <td className="px-3 py-1.5 text-text-primary">{s.concept_name}</td>
                  <td className="px-3 py-1.5">
                    <span
                      className="inline-block rounded px-1.5 py-0.5 text-[10px]"
                      style={{
                        backgroundColor: `${DOMAIN_COLORS[s.domain_id] ?? "#666"}20`,
                        color: DOMAIN_COLORS[s.domain_id] ?? "#666",
                      }}
                    >
                      {s.domain_id}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-text-muted font-mono">{s.p_value.toExponential(2)}</td>
                  <td className="px-3 py-1.5 text-text-muted font-mono">{s.beta.toFixed(3)}</td>
                  <td className="px-3 py-1.5 text-text-muted font-mono">{s.se.toFixed(3)}</td>
                  <td className="px-3 py-1.5 text-text-muted">{s.n_cases}</td>
                  <td className="px-3 py-1.5 text-text-muted">{s.n_controls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
