// ---------------------------------------------------------------------------
// PublishPage — 3-step publish & export flow
// ---------------------------------------------------------------------------

import { useState, useCallback } from "react";
import { FileOutput, ChevronLeft } from "lucide-react";
import { StudySelector } from "../components/StudySelector";
import { ReportPreview } from "../components/ReportPreview";
import { ExportControls } from "../components/ExportControls";
import {
  exportAsPdf,
  exportAsImageBundle,
  exportPlaceholder,
  useStudyWithAnalyses,
} from "../api/publishApi";
import type {
  ExportFormat,
  PublishState,
  ReportSection,
} from "../types/publish";

const STEP_LABELS = ["Select Study", "Build Report", "Export"] as const;

/**
 * Main publish page with a 3-step wizard:
 * 1. Study & execution selector
 * 2. Report builder / preview
 * 3. Export controls
 */
export default function PublishPage() {
  const [state, setState] = useState<PublishState>({
    step: 1,
    studyId: null,
    selectedExecutionIds: [],
    sections: [],
    exportFormat: "pdf",
  });

  const { data: studyDetail } = useStudyWithAnalyses(state.studyId);

  // ── Step 1 → Step 2 ─────────────────────────────────────────────────────
  const handleStudySelect = useCallback(
    (studyId: number, executionIds: number[]) => {
      // Build report sections from selected executions
      const sections: ReportSection[] = [];

      // Methods section (always first)
      sections.push({
        id: "methods",
        title: "Methods",
        type: "methods",
        included: true,
        content: studyDetail
          ? {
              study_design: studyDetail.study_design,
              hypothesis: studyDetail.hypothesis,
              primary_objective: studyDetail.primary_objective,
              scientific_rationale: studyDetail.scientific_rationale,
            }
          : null,
      });

      // Results sections (one per selected execution)
      const analyses = studyDetail?.analyses ?? [];
      for (const execId of executionIds) {
        const entry = analyses.find(
          (a) => a.analysis?.latest_execution?.id === execId,
        );
        const execution = entry?.analysis?.latest_execution;

        sections.push({
          id: `results-${execId}`,
          title: entry
            ? `${entry.analysis_type} — ${entry.analysis?.name ?? `#${entry.analysis_id}`}`
            : `Execution #${execId}`,
          type: "results",
          analysisType: entry?.analysis_type,
          executionId: execId,
          included: true,
          content: execution?.result_json ?? null,
        });
      }

      // Diagnostics section (off by default)
      sections.push({
        id: "diagnostics",
        title: "Diagnostics",
        type: "diagnostics",
        included: false,
        content: null,
      });

      setState({
        step: 2,
        studyId: studyId,
        selectedExecutionIds: executionIds,
        sections,
        exportFormat: "pdf",
      });
    },
    [studyDetail],
  );

  // ── Section toggle ───────────────────────────────────────────────────────
  const handleToggle = useCallback((sectionId: string) => {
    setState((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, included: !s.included } : s,
      ),
    }));
  }, []);

  // ── Section reorder ──────────────────────────────────────────────────────
  const handleReorder = useCallback(
    (sectionId: string, direction: "up" | "down") => {
      setState((prev) => {
        const idx = prev.sections.findIndex((s) => s.id === sectionId);
        if (idx < 0) return prev;

        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= prev.sections.length) return prev;

        const next = [...prev.sections];
        const temp = next[idx];
        next[idx] = next[swapIdx];
        next[swapIdx] = temp;

        return { ...prev, sections: next };
      });
    },
    [],
  );

  // ── Export ───────────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback((format: ExportFormat) => {
    setIsExporting(true);

    try {
      switch (format) {
        case "pdf":
          exportAsPdf("publish-report-preview");
          break;
        case "png":
          exportAsImageBundle("publish-report-preview", "png");
          break;
        case "svg":
          exportAsImageBundle("publish-report-preview", "svg");
          break;
        case "docx":
          exportPlaceholder("docx");
          break;
        case "xlsx":
          exportPlaceholder("xlsx");
          break;
      }
    } finally {
      setTimeout(() => setIsExporting(false), 1000);
    }
  }, []);

  // ── Navigation ───────────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.max(1, prev.step - 1) as 1 | 2 | 3,
    }));
  }, []);

  const goToExport = useCallback(() => {
    setState((prev) => ({ ...prev, step: 3 }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <FileOutput size={22} className="text-[#2DD4BF]" />
        <div>
          <h1 className="text-xl font-bold text-[#F0EDE8]">
            Publish & Export
          </h1>
          <p className="text-sm text-[#F0EDE8]/50">
            Generate publication-ready reports from study results
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2" data-testid="step-indicator">
        {STEP_LABELS.map((label, i) => {
          const stepNum = (i + 1) as 1 | 2 | 3;
          const isActive = state.step === stepNum;
          const isCompleted = state.step > stepNum;

          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`h-px w-8 ${
                    isCompleted ? "bg-[#2DD4BF]" : "bg-[#232328]"
                  }`}
                />
              )}
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
                    : isCompleted
                      ? "bg-[#2DD4BF]/5 text-[#2DD4BF]/60"
                      : "bg-[#151518] text-[#F0EDE8]/30"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    isActive
                      ? "bg-[#2DD4BF] text-[#0E0E11]"
                      : isCompleted
                        ? "bg-[#2DD4BF]/40 text-[#0E0E11]"
                        : "bg-[#232328] text-[#F0EDE8]/40"
                  }`}
                >
                  {stepNum}
                </span>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-[#232328] bg-[#151518] p-6">
        {state.step === 1 && (
          <StudySelector onSelect={handleStudySelect} />
        )}

        {state.step === 2 && (
          <div className="space-y-6">
            <ReportPreview
              sections={state.sections}
              onToggle={handleToggle}
              onReorder={handleReorder}
            />

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1.5 text-sm text-[#F0EDE8]/50 hover:text-[#F0EDE8] transition-colors"
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <button
                type="button"
                onClick={goToExport}
                disabled={state.sections.filter((s) => s.included).length === 0}
                className="flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-5 py-2.5 text-sm font-semibold text-[#0E0E11] hover:bg-[#2DD4BF]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Export
              </button>
            </div>
          </div>
        )}

        {state.step === 3 && (
          <div className="space-y-6">
            <ExportControls onExport={handleExport} isExporting={isExporting} />

            <div className="pt-2">
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1.5 text-sm text-[#F0EDE8]/50 hover:text-[#F0EDE8] transition-colors"
              >
                <ChevronLeft size={16} />
                Back to Preview
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
