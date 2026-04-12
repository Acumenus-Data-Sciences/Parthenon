import { useState, useMemo, useEffect } from "react";
import { Search, ChevronRight, ChevronDown, Check } from "lucide-react";
import { useAllAnalyses } from "../hooks/useAnalysisPicker";
import { useStudiesForPublish } from "../api/publishApi";
import type { AnalysisPickerItem } from "../api/publishApi";
import type { SelectedExecution } from "../types/publish";
import AnalysisPickerCart from "./AnalysisPickerCart";

const TYPE_LABELS: Record<string, string> = {
  characterizations: "Characterization",
  estimations: "Estimation",
  predictions: "Prediction",
  incidence_rates: "Incidence Rate",
  sccs: "SCCS",
  evidence_synthesis: "Evidence Synthesis",
  pathways: "Pathway",
};

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "characterizations", label: "Characterization" },
  { value: "estimations", label: "Estimation" },
  { value: "predictions", label: "Prediction" },
  { value: "incidence_rates", label: "Incidence Rate" },
  { value: "sccs", label: "SCCS" },
  { value: "evidence_synthesis", label: "Evidence Synthesis" },
  { value: "pathways", label: "Pathway" },
];

interface UnifiedAnalysisPickerProps {
  selections: SelectedExecution[];
  onSelectionsChange: (selections: SelectedExecution[]) => void;
  onNext: () => void;
  initialStudyId?: number;
}

function isSelected(
  selections: SelectedExecution[],
  executionId: number
): boolean {
  return selections.some((s) => s.executionId === executionId);
}

function toSelectedExecution(
  item: AnalysisPickerItem,
  studyId?: number,
  studyTitle?: string
): SelectedExecution {
  return {
    executionId: item.latest_execution!.id,
    analysisId: item.id,
    analysisType: item.type,
    analysisName: item.name,
    studyId,
    studyTitle,
    resultJson: item.latest_execution!.result_json,
    designJson: item.design_json,
  };
}

export default function UnifiedAnalysisPicker({
  selections,
  onSelectionsChange,
  onNext,
  initialStudyId,
}: UnifiedAnalysisPickerProps) {
  const [activeTab, setActiveTab] = useState<"all" | "studies">(initialStudyId ? "studies" : "all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [expandedStudies, setExpandedStudies] = useState<Set<number>>(
    new Set()
  );

  const { data: analyses = [], isLoading: loadingAnalyses } = useAllAnalyses();
  const { data: studies = [], isLoading: loadingStudies } =
    useStudiesForPublish();

  const completedAnalyses = useMemo(
    () =>
      analyses.filter(
        (a) => a.latest_execution?.status === "completed"
      ),
    [analyses]
  );

  const filteredAnalyses = useMemo(() => {
    let result = completedAnalyses;
    if (typeFilter) {
      result = result.filter((a) => a.type === typeFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) => a.name.toLowerCase().includes(q));
    }
    return result;
  }, [completedAnalyses, typeFilter, search]);

  // Filter studies by search term (title or analysis name) and type filter
  const filteredStudies = useMemo(() => {
    return studies
      .map((study) => {
        let studyAnalyses = (study.analyses ?? []).filter(
          (sa) => sa.analysis?.latest_execution?.status === "completed"
        );

        // Filter by analysis type
        if (typeFilter) {
          studyAnalyses = studyAnalyses.filter((sa) => sa.analysis_type === typeFilter);
        }

        // Filter by search (match study title OR analysis name)
        if (search) {
          const q = search.toLowerCase();
          const titleMatch = study.title.toLowerCase().includes(q);
          if (!titleMatch) {
            studyAnalyses = studyAnalyses.filter((sa) =>
              sa.analysis?.name?.toLowerCase().includes(q)
            );
          }
        }

        return { study, studyAnalyses };
      })
      .filter(({ studyAnalyses }) => studyAnalyses.length > 0);
  }, [studies, typeFilter, search]);

  useEffect(() => {
    if (!initialStudyId || studies.length === 0 || selections.length > 0) return;

    const study = studies.find((s) => s.id === initialStudyId);
    if (!study) return;

    setExpandedStudies(new Set([initialStudyId]));

    const studyAnalyses = (study.analyses ?? []).filter(
      (sa) => sa.analysis?.latest_execution?.status === "completed"
    );

    const autoSelections: SelectedExecution[] = studyAnalyses.map((sa) => ({
      executionId: sa.analysis!.latest_execution!.id,
      analysisId: sa.analysis!.id,
      analysisType: sa.analysis_type,
      analysisName: sa.analysis!.name,
      studyId: study.id,
      studyTitle: study.title,
      resultJson: sa.analysis!.latest_execution!.result_json,
      designJson: (sa.analysis as Record<string, unknown>)?.design_json as Record<string, unknown> | null ?? {},
    }));

    if (autoSelections.length > 0) {
      onSelectionsChange(autoSelections);
    }
  }, [initialStudyId, studies, selections.length, onSelectionsChange]);

  const handleToggle = (item: AnalysisPickerItem, studyId?: number, studyTitle?: string) => {
    const execId = item.latest_execution!.id;
    if (isSelected(selections, execId)) {
      onSelectionsChange(selections.filter((s) => s.executionId !== execId));
    } else {
      onSelectionsChange([
        ...selections,
        toSelectedExecution(item, studyId, studyTitle),
      ]);
    }
  };

  const handleRemove = (executionId: number) => {
    onSelectionsChange(selections.filter((s) => s.executionId !== executionId));
  };

  const toggleStudy = (studyId: number) => {
    setExpandedStudies((prev) => {
      const next = new Set(prev);
      if (next.has(studyId)) {
        next.delete(studyId);
      } else {
        next.add(studyId);
      }
      return next;
    });
  };

  const handleSelectAllFromStudy = (study: typeof studies[number]) => {
    const studyAnalyses = (study.analyses ?? []).filter(
      (sa) => sa.analysis?.latest_execution?.status === "completed"
    );

    const studyExecIds = new Set(
      studyAnalyses.map((sa) => sa.analysis!.latest_execution!.id)
    );

    const allSelected = studyAnalyses.every((sa) =>
      isSelected(selections, sa.analysis!.latest_execution!.id)
    );

    if (allSelected) {
      onSelectionsChange(
        selections.filter((s) => !studyExecIds.has(s.executionId))
      );
    } else {
      const existingIds = new Set(selections.map((s) => s.executionId));
      const newSelections = studyAnalyses
        .filter((sa) => !existingIds.has(sa.analysis!.latest_execution!.id))
        .map((sa) => ({
          executionId: sa.analysis!.latest_execution!.id,
          analysisId: sa.analysis!.id,
          analysisType: sa.analysis_type,
          analysisName: sa.analysis!.name,
          studyId: study.id,
          studyTitle: study.title,
          resultJson: sa.analysis!.latest_execution!.result_json,
          designJson: (sa.analysis as Record<string, unknown>)?.design_json as Record<string, unknown> | null ?? {},
        }));
      onSelectionsChange([...selections, ...newSelections]);
    }
  };

  return (
    <div className="flex gap-4 h-full">
      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search & filter — shared across both tabs */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5650]" />
            <input
              type="text"
              placeholder={activeTab === "all" ? "Search analyses..." : "Search studies..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#151518] border border-[#232328] rounded-lg text-sm text-[#F0EDE8] placeholder-[#5A5650] focus:outline-none focus:border-[#C9A227]"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#151518] border border-[#232328] rounded-lg px-3 py-2 text-sm text-[#F0EDE8] focus:outline-none focus:border-[#C9A227]"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#232328] mb-4">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "all"
                ? "border-[#C9A227] text-[#C9A227]"
                : "border-transparent text-[#5A5650] hover:text-[#F0EDE8]"
            }`}
          >
            All Analyses
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("studies")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "studies"
                ? "border-[#C9A227] text-[#C9A227]"
                : "border-transparent text-[#5A5650] hover:text-[#F0EDE8]"
            }`}
          >
            From Studies
          </button>
        </div>

        {activeTab === "all" && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Analysis list — cap visible height at ~12 items */}
            <div className="overflow-y-auto space-y-1" style={{ maxHeight: "540px" }}>
              {loadingAnalyses ? (
                <p className="text-sm text-[#5A5650] text-center py-8">
                  Loading analyses...
                </p>
              ) : filteredAnalyses.length === 0 ? (
                <p className="text-sm text-[#5A5650] text-center py-8">
                  No completed analyses found
                </p>
              ) : (
                filteredAnalyses.map((item) => {
                  const selected = isSelected(
                    selections,
                    item.latest_execution!.id
                  );
                  return (
                    <button
                      key={`${item.type}-${item.latest_execution?.id ?? item.id}`}
                      type="button"
                      onClick={() => handleToggle(item)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        selected
                          ? "bg-[#151518] border border-[#C9A227]"
                          : "bg-[#151518] border border-[#232328] hover:border-[#5A5650]"
                      }`}
                    >
                      <div
                        className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center ${
                          selected
                            ? "bg-[#C9A227] border-[#C9A227]"
                            : "border-[#5A5650]"
                        }`}
                      >
                        {selected && (
                          <Check className="w-3.5 h-3.5 text-[#0E0E11]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#F0EDE8] truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-[#5A5650]">
                          {TYPE_LABELS[item.type] ?? item.type}
                          {item.latest_execution?.completed_at &&
                            ` \u00B7 ${new Date(
                              item.latest_execution.completed_at
                            ).toLocaleDateString()}`}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === "studies" && (
          <div className="overflow-y-auto space-y-2" style={{ maxHeight: "540px" }}>
            {loadingStudies ? (
              <p className="text-sm text-[#5A5650] text-center py-8">
                Loading studies...
              </p>
            ) : filteredStudies.length === 0 ? (
              <p className="text-sm text-[#5A5650] text-center py-8">
                {search || typeFilter ? "No studies match your filters" : "No studies found"}
              </p>
            ) : (
              filteredStudies.map(({ study, studyAnalyses }) => {
                const expanded = expandedStudies.has(study.id);

                return (
                  <div
                    key={study.id}
                    className="bg-[#151518] border border-[#232328] rounded-lg"
                  >
                    <button
                      type="button"
                      onClick={() => toggleStudy(study.id)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                    >
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 text-[#5A5650]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#5A5650]" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#F0EDE8] truncate">
                          {study.title}
                        </p>
                      </div>
                    </button>
                    {studyAnalyses.length > 0 && (
                      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#232328]">
                        <span className="text-xs text-[#5A5650]">
                          {studyAnalyses.length} completed{" "}
                          {studyAnalyses.length === 1 ? "analysis" : "analyses"}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectAllFromStudy(study);
                          }}
                          className="text-xs font-medium text-[#C9A227] hover:text-[#d4ad2f] transition-colors"
                        >
                          {studyAnalyses.every((sa) =>
                            isSelected(selections, sa.analysis!.latest_execution!.id)
                          )
                            ? "Deselect All"
                            : "Select All"}
                        </button>
                      </div>
                    )}
                    {expanded && studyAnalyses.length > 0 && (
                      <div className="border-t border-[#232328] px-3 py-2 space-y-1">
                        {studyAnalyses.map((sa) => {
                          const exec = sa.analysis!.latest_execution!;
                          const selected = isSelected(selections, exec.id);
                          const pickerItem: AnalysisPickerItem = {
                            id: sa.analysis!.id,
                            name: sa.analysis!.name,
                            type: sa.analysis_type,
                            description: null,
                            design_json: {},
                            latest_execution: {
                              id: exec.id,
                              status: exec.status,
                              result_json: exec.result_json,
                              completed_at: exec.completed_at,
                            },
                          };
                          return (
                            <button
                              key={`${study.id}-${sa.analysis_type}-${exec.id}`}
                              type="button"
                              onClick={() =>
                                handleToggle(
                                  pickerItem,
                                  study.id,
                                  study.title
                                )
                              }
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                                selected
                                  ? "border border-[#C9A227] bg-[#0E0E11]"
                                  : "border border-transparent hover:bg-[#0E0E11]"
                              }`}
                            >
                              <div
                                className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center ${
                                  selected
                                    ? "bg-[#C9A227] border-[#C9A227]"
                                    : "border-[#5A5650]"
                                }`}
                              >
                                {selected && (
                                  <Check className="w-3.5 h-3.5 text-[#0E0E11]" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-[#F0EDE8] truncate">
                                  {sa.analysis!.name}
                                </p>
                                <p className="text-xs text-[#5A5650]">
                                  {TYPE_LABELS[sa.analysis_type] ??
                                    sa.analysis_type}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="w-64 shrink-0 flex flex-col border-l border-[#232328]">
        <div className="flex-1 overflow-hidden">
          <AnalysisPickerCart
            selections={selections}
            onRemove={handleRemove}
          />
        </div>
        {selections.length > 0 && (
          <div className="p-3 border-t border-[#232328]">
            <button
              type="button"
              onClick={onNext}
              className="w-full px-4 py-2 bg-[#C9A227] text-[#0E0E11] font-medium text-sm rounded-lg hover:bg-[#d4ad2f] transition-colors"
            >
              Configure Document &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
