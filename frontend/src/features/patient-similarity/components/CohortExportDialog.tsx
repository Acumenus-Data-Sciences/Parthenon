import { useState } from "react";
import { X, Download, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExportCohort } from "../hooks/usePatientSimilarity";
import type { SimilarPatient } from "../types/patientSimilarity";

interface CohortExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cacheId: number;
  patients: SimilarPatient[];
}

export function CohortExportDialog({
  isOpen,
  onClose,
  cacheId,
  patients,
}: CohortExportDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [minScore, setMinScore] = useState(0.5);
  const [successId, setSuccessId] = useState<number | null>(null);

  const exportMutation = useExportCohort();

  const filteredCount = patients.filter((p) => p.overall_score >= minScore).length;

  const handleExport = () => {
    if (!name.trim()) return;
    exportMutation.mutate(
      {
        cache_id: cacheId,
        name: name.trim(),
        description: description.trim() || undefined,
        min_score: minScore,
      },
      {
        onSuccess: (result) => {
          setSuccessId(result.cohort_definition_id);
        },
      },
    );
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    setMinScore(0.5);
    setSuccessId(null);
    exportMutation.reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg border border-[#232328] bg-[#151518] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#232328] px-5 py-4">
          <h2 className="text-base font-semibold text-[#F0EDE8]">
            Export as Cohort
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-[#5A5650] hover:text-[#C5C0B8] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {successId !== null ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle size={40} className="text-[#2DD4BF] mb-3" />
              <p className="text-sm text-[#F0EDE8] font-medium">
                Cohort created successfully
              </p>
              <p className="text-xs text-[#8A857D] mt-1">
                Cohort Definition ID: {successId}
              </p>
            </div>
          ) : (
            <>
              {/* Cohort Name */}
              <div>
                <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
                  Cohort Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Similar to Patient 12345"
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-sm",
                    "bg-[#0E0E11] border border-[#232328]",
                    "text-[#F0EDE8] placeholder:text-[#5A5650]",
                    "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
                  )}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-sm resize-none",
                    "bg-[#0E0E11] border border-[#232328]",
                    "text-[#F0EDE8] placeholder:text-[#5A5650]",
                    "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
                  )}
                />
              </div>

              {/* Min Score Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] text-[#5A5650] uppercase tracking-wider">
                    Minimum Score
                  </label>
                  <span className="text-xs font-medium text-[#2DD4BF] tabular-nums">
                    {minScore.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={minScore}
                  onChange={(e) => setMinScore(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#232328] accent-[#2DD4BF]"
                />
              </div>

              {/* Patient Count Preview */}
              <div className="rounded-lg bg-[#0E0E11] border border-[#232328] px-3 py-2">
                <p className="text-xs text-[#8A857D]">
                  <span className="font-medium text-[#C5C0B8]">{filteredCount}</span>{" "}
                  of {patients.length} patients meet the minimum score threshold
                </p>
              </div>

              {/* Error */}
              {exportMutation.isError && (
                <p className="text-xs text-[#E85A6B]">
                  Export failed. Please try again.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[#232328] px-5 py-3">
          {successId !== null ? (
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                "bg-[#2DD4BF]/10 text-[#2DD4BF] hover:bg-[#2DD4BF]/20",
              )}
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[#8A857D] hover:text-[#C5C0B8] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={
                  !name.trim() ||
                  filteredCount === 0 ||
                  exportMutation.isPending
                }
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  "bg-[#9B1B30] text-white hover:bg-[#B22040]",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {exportMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Export ({filteredCount})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
