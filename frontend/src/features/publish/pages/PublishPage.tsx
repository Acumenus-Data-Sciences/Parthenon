// ---------------------------------------------------------------------------
// PublishPage — 4-step publish & export wizard
// ---------------------------------------------------------------------------

import { useReducer, useCallback } from "react";
import { FileOutput, Check } from "lucide-react";
import UnifiedAnalysisPicker from "../components/UnifiedAnalysisPicker";
import DocumentConfigurator from "../components/DocumentConfigurator";
import DocumentPreview from "../components/DocumentPreview";
import ExportPanel from "../components/ExportPanel";
import { useGenerateNarrative } from "../hooks/useNarrativeGeneration";
import type {
  ReportSection,
  SelectedExecution,
  NarrativeState,
  DiagramType,
} from "../types/publish";

// ── Step labels ─────────────────────────────────────────────────────────────

const STEPS = [
  { num: 1 as const, label: "Select Analyses" },
  { num: 2 as const, label: "Configure" },
  { num: 3 as const, label: "Preview" },
  { num: 4 as const, label: "Export" },
];

// ── State & Reducer ─────────────────────────────────────────────────────────

interface WizardState {
  step: 1 | 2 | 3 | 4;
  selectedExecutions: SelectedExecution[];
  sections: ReportSection[];
  title: string;
  authors: string[];
  template: string;
}

type Action =
  | { type: "SET_STEP"; step: 1 | 2 | 3 | 4 }
  | { type: "SET_SELECTIONS"; selections: SelectedExecution[] }
  | { type: "SET_SECTIONS"; sections: ReportSection[] }
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_AUTHORS"; authors: string[] }
  | { type: "UPDATE_SECTION"; id: string; updates: Partial<ReportSection> };

function wizardReducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_SELECTIONS":
      return { ...state, selectedExecutions: action.selections };
    case "SET_SECTIONS":
      return { ...state, sections: action.sections };
    case "SET_TITLE":
      return { ...state, title: action.title };
    case "SET_AUTHORS":
      return { ...state, authors: action.authors };
    case "UPDATE_SECTION":
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.id === action.id ? { ...s, ...action.updates } : s,
        ),
      };
    default:
      return state;
  }
}

const initialState: WizardState = {
  step: 1,
  selectedExecutions: [],
  sections: [],
  title: "",
  authors: [],
  template: "generic-ohdsi",
};

// ── Section generation helpers ──────────────────────────────────────────────

function diagramTypeForAnalysis(analysisType: string): DiagramType | null {
  const normalized = analysisType.toLowerCase().replace(/[-_\s]/g, "");
  if (normalized.includes("estimation") || normalized.includes("sccs")) {
    return "forest_plot";
  }
  if (normalized.includes("prediction")) {
    return "kaplan_meier";
  }
  if (normalized.includes("characterization")) {
    return "attrition";
  }
  if (normalized.includes("evidencesynthesis")) {
    return "forest_plot";
  }
  return null;
}

function buildSectionsFromExecutions(
  executions: SelectedExecution[],
): ReportSection[] {
  const sections: ReportSection[] = [];

  // One "methods" section per unique analysis type
  const seenTypes = new Set<string>();
  for (const exec of executions) {
    if (!seenTypes.has(exec.analysisType)) {
      seenTypes.add(exec.analysisType);
      sections.push({
        id: `methods-${exec.analysisType}`,
        title: `Methods: ${exec.analysisType.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
        type: "methods",
        analysisType: exec.analysisType,
        included: true,
        content: "",
        narrativeState: "idle",
      });
    }
  }

  // One "results" section per execution + optional diagram
  for (const exec of executions) {
    sections.push({
      id: `results-${exec.executionId}`,
      title: `Results: ${exec.analysisName}`,
      type: "results",
      analysisType: exec.analysisType,
      executionId: exec.executionId,
      included: true,
      content: "",
      narrativeState: "idle",
    });

    const diagType = diagramTypeForAnalysis(exec.analysisType);
    if (diagType) {
      sections.push({
        id: `diagram-${exec.executionId}`,
        title: `${diagType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}: ${exec.analysisName}`,
        type: "diagram",
        analysisType: exec.analysisType,
        executionId: exec.executionId,
        diagramType: diagType,
        diagramData: (exec.resultJson as Record<string, unknown>) ?? undefined,
        included: true,
        content: "",
        narrativeState: "idle",
      });
    }
  }

  // Discussion section at the end
  sections.push({
    id: "discussion",
    title: "Discussion",
    type: "discussion",
    included: true,
    content: "",
    narrativeState: "idle",
  });

  return sections;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PublishPage() {
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  const narrativeMutation = useGenerateNarrative();

  // ── Step 1 handlers ─────────────────────────────────────────────────────
  const handleSelectionsChange = useCallback(
    (selections: SelectedExecution[]) => {
      dispatch({ type: "SET_SELECTIONS", selections });
    },
    [],
  );

  const handleStep1Next = useCallback(() => {
    const sections = buildSectionsFromExecutions(state.selectedExecutions);
    const defaultTitle =
      state.selectedExecutions.length > 0
        ? state.selectedExecutions[0].analysisName
        : "Untitled Document";

    dispatch({ type: "SET_SECTIONS", sections });
    dispatch({ type: "SET_TITLE", title: state.title || defaultTitle });
    dispatch({ type: "SET_STEP", step: 2 });
  }, [state.selectedExecutions, state.title]);

  // ── Step 2 handlers ─────────────────────────────────────────────────────
  const handleSectionsChange = useCallback((sections: ReportSection[]) => {
    dispatch({ type: "SET_SECTIONS", sections });
  }, []);

  const handleTitleChange = useCallback((title: string) => {
    dispatch({ type: "SET_TITLE", title });
  }, []);

  const handleAuthorsChange = useCallback((authors: string[]) => {
    dispatch({ type: "SET_AUTHORS", authors });
  }, []);

  // ── Narrative generation ────────────────────────────────────────────────
  const handleGenerateNarrative = useCallback(
    (section: ReportSection) => {
      // Find the matching execution for context
      const exec = state.selectedExecutions.find(
        (e) => e.executionId === section.executionId,
      );

      dispatch({
        type: "UPDATE_SECTION",
        id: section.id,
        updates: { narrativeState: "generating" as NarrativeState },
      });

      const sectionType = section.type === "diagram" ? "caption" : section.type;
      const validTypes = ["methods", "results", "discussion", "caption"] as const;
      const mappedType = validTypes.includes(sectionType as typeof validTypes[number])
        ? (sectionType as "methods" | "results" | "discussion" | "caption")
        : "results";

      narrativeMutation.mutate(
        {
          section_type: mappedType,
          analysis_id: exec?.analysisId,
          execution_id: exec?.executionId,
          context: {
            analysisType: section.analysisType,
            designJson: exec?.designJson ?? {},
            resultJson: exec?.resultJson ?? {},
          },
        },
        {
          onSuccess: (data) => {
            dispatch({
              type: "UPDATE_SECTION",
              id: section.id,
              updates: {
                content: data.text,
                narrativeState: "draft" as NarrativeState,
              },
            });
          },
          onError: () => {
            dispatch({
              type: "UPDATE_SECTION",
              id: section.id,
              updates: { narrativeState: "idle" as NarrativeState },
            });
          },
        },
      );
    },
    [state.selectedExecutions, narrativeMutation],
  );

  // Keep handleGenerateNarrative in scope for DocumentConfigurator
  void handleGenerateNarrative;

  // ── Navigation helpers ──────────────────────────────────────────────────
  const goToStep = useCallback((step: 1 | 2 | 3 | 4) => {
    dispatch({ type: "SET_STEP", step });
  }, []);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <FileOutput size={22} className="text-[#2DD4BF]" />
        <div>
          <h1 className="text-xl font-bold text-[#F0EDE8]">Publish</h1>
          <p className="text-sm text-[#F0EDE8]/50">
            Create publication-ready manuscripts from your analyses
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2" data-testid="step-indicator">
        {STEPS.map(({ num, label }, i) => {
          const isActive = state.step === num;
          const isCompleted = state.step > num;

          return (
            <div key={num} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`h-px w-8 ${
                    isCompleted ? "bg-[#C9A227]" : "bg-[#232328]"
                  }`}
                />
              )}
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[#C9A227]/15 text-[#C9A227]"
                    : isCompleted
                      ? "bg-[#C9A227]/5 text-[#C9A227]/60"
                      : "bg-[#151518] text-[#F0EDE8]/30"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    isActive
                      ? "bg-[#C9A227] text-[#0E0E11]"
                      : isCompleted
                        ? "bg-[#C9A227]/40 text-[#0E0E11]"
                        : "bg-[#232328] text-[#F0EDE8]/40"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    num
                  )}
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
          <UnifiedAnalysisPicker
            selections={state.selectedExecutions}
            onSelectionsChange={handleSelectionsChange}
            onNext={handleStep1Next}
          />
        )}

        {state.step === 2 && (
          <DocumentConfigurator
            sections={state.sections}
            title={state.title}
            authors={state.authors}
            onSectionsChange={handleSectionsChange}
            onTitleChange={handleTitleChange}
            onAuthorsChange={handleAuthorsChange}
            onNext={() => goToStep(3)}
            onBack={() => goToStep(1)}
          />
        )}

        {state.step === 3 && (
          <DocumentPreview
            sections={state.sections}
            title={state.title}
            authors={state.authors}
            onBack={() => goToStep(2)}
            onNext={() => goToStep(4)}
          />
        )}

        {state.step === 4 && (
          <ExportPanel
            sections={state.sections}
            title={state.title}
            authors={state.authors}
            template={state.template}
            onBack={() => goToStep(3)}
          />
        )}
      </div>
    </div>
  );
}
