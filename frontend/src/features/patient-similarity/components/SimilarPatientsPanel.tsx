import { useState } from "react";
import { ArrowRight, Download } from "lucide-react";
import { SimilarPatientTable } from "./SimilarPatientTable";
import { CohortExportDialog } from "./CohortExportDialog";
import type { SimilaritySearchResult } from "../types/patientSimilarity";

interface SimilarPatientsPanelProps {
  result: SimilaritySearchResult;
  sourceId: number;
  onContinue: () => void;
}

export function SimilarPatientsPanel({
  result,
  sourceId,
  onContinue,
}: SimilarPatientsPanelProps) {
  const [exportOpen, setExportOpen] = useState(false);

  const cacheId = result.metadata.cache_id ?? 0;
  const patients = result.similar_patients;

  return (
    <div className="space-y-4">
      <SimilarPatientTable
        patients={patients}
        showPersonId={false}
        sourceId={sourceId}
      />

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          disabled={cacheId === 0 || patients.length === 0}
          className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-success/40 hover:text-success disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download size={14} />
          Export as New Cohort
        </button>

        <button
          type="button"
          onClick={onContinue}
          className="flex items-center gap-2 rounded-lg bg-success/10 px-4 py-2 text-sm font-medium text-success transition-colors hover:bg-success/20"
        >
          Continue to Landscape
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Export modal */}
      <CohortExportDialog
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        cacheId={cacheId}
        patients={patients}
      />
    </div>
  );
}
