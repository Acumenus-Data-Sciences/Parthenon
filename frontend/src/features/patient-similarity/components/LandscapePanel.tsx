import type { LandscapeResult } from "../types/patientSimilarity";
import { PatientLandscape } from "./PatientLandscape";

interface LandscapePanelProps {
  result: LandscapeResult;
  onContinue: () => void;
}

export function LandscapePanel({ result, onContinue }: LandscapePanelProps) {
  const clusters = result.clusters ?? [];
  const stats = result.stats ?? {
    n_patients: result.n_patients,
    dimensions: result.dimensions,
    n_clusters: result.n_clusters,
  };

  return (
    <div className="space-y-4 p-4">
      <PatientLandscape
        points={result.points}
        clusters={clusters}
        stats={stats}
      />

      {/* Action bar */}
      <div className="flex items-center justify-end gap-3 border-t border-border-default pt-4">
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
          className="rounded-md border border-surface-highlight bg-surface-raised px-4 py-2 text-sm text-text-secondary transition-colors hover:border-text-ghost hover:text-text-primary"
        >
          Export Screenshot
        </button>
        <button
          type="button"
          className="rounded-md border border-surface-highlight bg-surface-raised px-4 py-2 text-sm text-text-secondary transition-colors hover:border-text-ghost hover:text-text-primary"
        >
          Select Cluster → New Cohort
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md bg-success px-4 py-2 text-sm font-medium text-surface-base transition-colors hover:bg-success-dark"
        >
          Continue to Phenotype Discovery →
        </button>
      </div>
    </div>
  );
}
