// ---------------------------------------------------------------------------
// StudySelector — Step 1: Select study and analysis executions
// ---------------------------------------------------------------------------

import { useState, useMemo, useCallback } from "react";
import {
  Briefcase,
  CheckSquare,
  Square,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useStudiesForPublish, useStudyWithAnalyses } from "../api/publishApi";
import type { Study } from "@/features/studies/types/study";
import type { AnalysisExecution } from "@/features/analyses/types/analysis";

interface StudySelectorProps {
  onSelect: (studyId: number, executionIds: number[]) => void;
}

/**
 * Fetches studies and displays them as selectable cards.
 * When a study is selected, shows its completed analysis executions
 * with checkboxes and "Select All" / "Deselect All" toggle.
 */
export function StudySelector({ onSelect }: StudySelectorProps) {
  const { data: studies, isLoading, error } = useStudiesForPublish();
  const [selectedStudyId, setSelectedStudyId] = useState<number | null>(null);
  const [checkedExecutionIds, setCheckedExecutionIds] = useState<Set<number>>(
    new Set(),
  );

  const {
    data: studyDetail,
    isLoading: isLoadingDetail,
  } = useStudyWithAnalyses(selectedStudyId);

  // Extract completed executions from the study's analyses
  const completedExecutions: AnalysisExecution[] = useMemo(() => {
    if (!studyDetail?.analyses) return [];
    return studyDetail.analyses
      .filter((a) => a.analysis?.latest_execution?.status === "completed")
      .map((a) => a.analysis!.latest_execution!)
      .filter(Boolean);
  }, [studyDetail]);

  const handleStudyClick = useCallback((study: Study) => {
    setSelectedStudyId(study.id);
    setCheckedExecutionIds(new Set());
  }, []);

  const toggleExecution = useCallback((executionId: number) => {
    setCheckedExecutionIds((prev) => {
      const next = new Set(prev);
      if (next.has(executionId)) {
        next.delete(executionId);
      } else {
        next.add(executionId);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (checkedExecutionIds.size === completedExecutions.length) {
      setCheckedExecutionIds(new Set());
    } else {
      setCheckedExecutionIds(new Set(completedExecutions.map((e) => e.id)));
    }
  }, [checkedExecutionIds.size, completedExecutions]);

  const handleNext = useCallback(() => {
    if (selectedStudyId !== null && checkedExecutionIds.size > 0) {
      onSelect(selectedStudyId, Array.from(checkedExecutionIds));
    }
  }, [selectedStudyId, checkedExecutionIds, onSelect]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-[#F0EDE8]/50">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading studies...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-[#E85A6B]">
        <AlertCircle size={18} className="mr-2" />
        Failed to load studies. Please try again.
      </div>
    );
  }

  const studyList = studies ?? [];

  return (
    <div data-testid="study-selector" className="space-y-6">
      {/* Study cards */}
      <div>
        <h3 className="text-sm font-semibold text-[#F0EDE8] mb-3">
          Select a Study
        </h3>
        {studyList.length === 0 ? (
          <p className="text-sm text-[#F0EDE8]/40">
            No studies found. Create a study first.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {studyList.map((study) => (
              <button
                key={study.id}
                type="button"
                onClick={() => handleStudyClick(study)}
                className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                  selectedStudyId === study.id
                    ? "border-[#2DD4BF] bg-[#2DD4BF]/10"
                    : "border-[#232328] bg-[#151518] hover:border-[#2DD4BF]/40"
                }`}
              >
                <Briefcase
                  size={18}
                  className={
                    selectedStudyId === study.id
                      ? "text-[#2DD4BF] mt-0.5"
                      : "text-[#F0EDE8]/40 mt-0.5"
                  }
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-medium text-[#F0EDE8] truncate">
                    {study.title}
                  </h4>
                  <p className="text-xs text-[#F0EDE8]/40 mt-0.5">
                    {study.study_type} | {study.status}
                  </p>
                  {study.description && (
                    <p className="text-xs text-[#F0EDE8]/30 mt-1 line-clamp-2">
                      {study.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Execution selection */}
      {selectedStudyId !== null && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#F0EDE8]">
              Completed Executions
            </h3>
            {completedExecutions.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-[#2DD4BF] hover:text-[#2DD4BF]/80"
              >
                {checkedExecutionIds.size === completedExecutions.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            )}
          </div>

          {isLoadingDetail ? (
            <div className="flex items-center py-4 text-[#F0EDE8]/50 text-sm">
              <Loader2 size={16} className="animate-spin mr-2" />
              Loading executions...
            </div>
          ) : completedExecutions.length === 0 ? (
            <p className="text-sm text-[#F0EDE8]/40">
              No completed executions found for this study.
            </p>
          ) : (
            <div className="space-y-2">
              {completedExecutions.map((exec) => {
                const checked = checkedExecutionIds.has(exec.id);
                return (
                  <button
                    key={exec.id}
                    type="button"
                    onClick={() => toggleExecution(exec.id)}
                    className={`flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                      checked
                        ? "border-[#2DD4BF]/50 bg-[#2DD4BF]/5"
                        : "border-[#232328] bg-[#151518] hover:border-[#232328]/80"
                    }`}
                  >
                    {checked ? (
                      <CheckSquare size={16} className="text-[#2DD4BF] shrink-0" />
                    ) : (
                      <Square size={16} className="text-[#F0EDE8]/30 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-[#F0EDE8]">
                        {exec.analysis_type} #{exec.analysis_id}
                      </span>
                      <span className="text-xs text-[#F0EDE8]/40 ml-2">
                        Execution #{exec.id}
                      </span>
                    </div>
                    <span className="text-xs text-[#2DD4BF]/60">
                      {exec.completed_at
                        ? new Date(exec.completed_at).toLocaleDateString()
                        : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Next button */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleNext}
          disabled={checkedExecutionIds.size === 0}
          className="flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-5 py-2.5 text-sm font-semibold text-[#0E0E11] hover:bg-[#2DD4BF]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
