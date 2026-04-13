import { useMemo } from "react";
import type { LandscapeResult } from "../types/patientSimilarity";
import { PatientLandscape } from "./PatientLandscape";
import { CLUSTER_PALETTE } from "@/features/administration/components/vector-explorer/constants";

const GENDER_LABELS: Record<number, string> = { 8507: "Male", 8532: "Female" };

interface LandscapePanelProps {
  result: LandscapeResult;
  onContinue: () => void;
}

export function LandscapePanel({ result, onContinue }: LandscapePanelProps) {
  const clusters = useMemo(() => result.clusters ?? [], [result.clusters]);
  const stats = result.stats ?? {
    n_patients: result.n_patients,
    dimensions: result.dimensions,
    n_clusters: result.n_clusters,
  };

  const clusterSummaries = useMemo(() => {
    if (clusters.length === 0) return [];
    return clusters.map((c) => {
      const members = result.points.filter((p) => p.cluster_id === c.id);
      const genderCounts: Record<string, number> = {};
      let ageSum = 0;
      let ageCount = 0;
      let cohortCount = 0;
      for (const p of members) {
        const g = GENDER_LABELS[p.gender_concept_id] ?? "Other";
        genderCounts[g] = (genderCounts[g] ?? 0) + 1;
        if (p.age_bucket != null) { ageSum += p.age_bucket * 5; ageCount++; }
        if (p.is_cohort_member) cohortCount++;
      }
      const topGender = Object.entries(genderCounts).sort((a, b) => b[1] - a[1])[0];
      return {
        id: c.id,
        label: c.label ?? `Cluster ${c.id}`,
        size: members.length,
        meanAge: ageCount > 0 ? Math.round(ageSum / ageCount) : null,
        topGender: topGender ? `${topGender[0]} (${Math.round(topGender[1] / members.length * 100)}%)` : "—",
        cohortPct: members.length > 0 ? Math.round(cohortCount / members.length * 100) : 0,
      };
    }).sort((a, b) => b.size - a.size);
  }, [clusters, result.points]);

  return (
    <div className="space-y-4 p-4">
      <PatientLandscape
        points={result.points}
        clusters={clusters}
        stats={stats}
      />

      {/* Cluster summary table */}
      {clusterSummaries.length > 0 && (
        <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--color-surface-overlay)]">
            <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">Cluster Summary</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--color-surface-raised)] border-b border-[var(--color-surface-overlay)]">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.5px]">Cluster</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.5px]">Size</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.5px]">Mean Age</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.5px]">Top Gender</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-[0.5px]">Cohort %</th>
                </tr>
              </thead>
              <tbody>
                {clusterSummaries.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--color-surface-overlay)]/50 hover:bg-[var(--color-surface-raised)]/50">
                    <td className="px-3 py-2 text-[var(--color-text-primary)]">
                      <span
                        className="inline-block h-2 w-2 rounded-full mr-1.5"
                        style={{ background: CLUSTER_PALETTE[c.id % CLUSTER_PALETTE.length] }}
                      />
                      {c.label}
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-primary)] tabular-nums">{c.size.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-primary)] tabular-nums">{c.meanAge != null ? `~${c.meanAge}y` : "—"}</td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">{c.topGender}</td>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: c.cohortPct > 50 ? "var(--color-primary)" : "var(--color-text-secondary)" }}>
                      {c.cohortPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-end gap-3 border-t border-[var(--color-surface-overlay)] pt-4">
        <button
          type="button"
          onClick={() => {
            const canvas = document.querySelector<HTMLCanvasElement>('canvas');
            if (!canvas) return;
            const link = document.createElement('a');
            link.download = 'patient-landscape.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
          }}
          className="rounded-md border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] px-4 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          Export Screenshot
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md bg-[var(--color-primary)]/10 px-4 py-2 text-sm font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/20"
        >
          Continue to Phenotype Discovery
        </button>
      </div>
    </div>
  );
}
