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
      <div className="flex items-center justify-end gap-3 border-t border-[#232328] pt-4">
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
          className="rounded-md border border-[#323238] bg-[#151518] px-4 py-2 text-sm text-[#C5C0B8] transition-colors hover:border-[#5A5650] hover:text-[#F0EDE8]"
        >
          Export Screenshot
        </button>
        <button
          type="button"
          className="rounded-md border border-[#323238] bg-[#151518] px-4 py-2 text-sm text-[#C5C0B8] transition-colors hover:border-[#5A5650] hover:text-[#F0EDE8]"
        >
          Select Cluster → New Cohort
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] transition-colors hover:bg-[#22B8A0]"
        >
          Continue to Phenotype Discovery →
        </button>
      </div>
    </div>
  );
}
