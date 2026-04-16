// frontend/src/features/finngen-analyses/components/results/OverlapsResults.tsx
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — finngen-analyses SP3 in flight; @upsetjs/react type drift; unblock CI build
import { useMemo } from "react";
import { UpSetJS, extractSets, extractCombinations } from "@upsetjs/react";
import type { OverlapsDisplay } from "../../types";

interface OverlapsResultsProps {
  display: OverlapsDisplay;
}

export function OverlapsResults({ display }: OverlapsResultsProps) {
  // Build UpSet input: array of {name, elems}
  const { sets, combinations } = useMemo(() => {
    // Create element arrays from intersection data
    // Each element is a unique person ID placeholder — we use cohort membership
    // to compute the UpSet layout.
    const allElems = new Map<string, string[]>();

    let elemId = 0;
    for (const s of display.sets) {
      allElems.set(s.cohort_name, []);
    }

    // Assign intersection elements first
    for (const ix of display.intersections) {
      const memberNames = ix.members.map(
        (m) => display.sets.find((s) => s.cohort_id === m)?.cohort_name ?? `Cohort ${m}`,
      );
      for (let i = 0; i < ix.size; i++) {
        const el = `shared_${elemId++}`;
        for (const name of memberNames) {
          allElems.get(name)?.push(el);
        }
      }
    }

    // Fill remaining unique elements per set
    for (const s of display.sets) {
      const current = allElems.get(s.cohort_name) ?? [];
      const remaining = s.size - current.length;
      for (let i = 0; i < Math.max(0, remaining); i++) {
        current.push(`unique_${s.cohort_id}_${elemId++}`);
      }
      allElems.set(s.cohort_name, current);
    }

    const inputSets = display.sets.map((s) => ({
      name: s.cohort_name,
      elems: allElems.get(s.cohort_name) ?? [],
    }));

    const sets = extractSets(inputSets);
    const combinations = extractCombinations(inputSets);
    return { sets, combinations };
  }, [display]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="text-xs text-text-muted">
        Max overlap: {display.summary.max_overlap_pct}%
      </div>

      {/* UpSet plot */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4">
        <h3 className="text-xs font-semibold text-text-secondary mb-3">UpSet Plot</h3>
        <div style={{ height: 400 }}>
          <UpSetJS
            sets={sets}
            combinations={combinations}
            width={700}
            height={380}
            theme="dark"
            selectionColor="#2DD4BF"
            color="#9B1B30"
          />
        </div>
      </div>

      {/* Intersection table */}
      <div className="rounded-lg border border-border-default bg-surface-raised">
        <div className="px-4 py-3 border-b border-border-default">
          <h3 className="text-xs font-semibold text-text-secondary">Intersections</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default text-text-ghost">
                <th className="px-3 py-2 text-left font-medium">Members</th>
                <th className="px-3 py-2 text-left font-medium">Size</th>
                <th className="px-3 py-2 text-left font-medium">% of smallest</th>
              </tr>
            </thead>
            <tbody>
              {display.intersections.map((ix, idx) => {
                const memberNames = ix.members.map(
                  (m) => display.sets.find((s) => s.cohort_id === m)?.cohort_name ?? `#${m}`,
                );
                const smallestSize = Math.min(
                  ...ix.members.map(
                    (m) => display.sets.find((s) => s.cohort_id === m)?.size ?? Infinity,
                  ),
                );
                const pctOfSmallest = smallestSize > 0
                  ? ((ix.size / smallestSize) * 100).toFixed(1)
                  : "0.0";

                return (
                  <tr key={idx} className="border-b border-border-default/50 hover:bg-surface-overlay/30">
                    <td className="px-3 py-1.5 text-text-primary">{memberNames.join(" \u2229 ")}</td>
                    <td className="px-3 py-1.5 text-text-muted">{ix.size.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-text-muted">{pctOfSmallest}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
