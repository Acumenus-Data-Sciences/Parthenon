// ---------------------------------------------------------------------------
// PublishPage — 4-step publish & export wizard
// ---------------------------------------------------------------------------

import { useReducer, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FileOutput, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import UnifiedAnalysisPicker from "../components/UnifiedAnalysisPicker";
import DocumentConfigurator from "../components/DocumentConfigurator";
import DocumentPreview from "../components/DocumentPreview";
import ExportPanel from "../components/ExportPanel";
import { useGenerateNarrative } from "../hooks/useNarrativeGeneration";
import { buildTableFromResults } from "../lib/tableBuilders";
import { buildDiagramData } from "../lib/diagramBuilders";
import {
  getPublishResultSectionTitle,
  getPublishTemplateSectionTitle,
} from "../lib/i18n";
import { SECTION_CONFIG } from "../lib/sectionConfig";
import type {
  ReportSection,
  SelectedExecution,
  NarrativeState,
} from "../types/publish";
import { TEMPLATES } from "../templates/index";
import type { TemplateSectionDef } from "../templates/index";

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
  | { type: "UPDATE_SECTION"; id: string; updates: Partial<ReportSection> }
  | { type: "SET_TEMPLATE"; template: string };

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
    case "SET_TEMPLATE":
      return { ...state, template: action.template };
    default:
      return state;
  }
}

const STORAGE_KEY = "parthenon:publish-wizard";

const defaultState: WizardState = {
  step: 1,
  selectedExecutions: [],
  sections: [],
  title: "",
  authors: [],
  template: "generic-ohdsi",
};

function loadPersistedState(): WizardState {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as WizardState;
      // Validate shape
      if (parsed.step && parsed.sections && parsed.selectedExecutions) {
        return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }
  return defaultState;
}

function persistState(state: WizardState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function persistingReducer(state: WizardState, action: Action): WizardState {
  const next = wizardReducer(state, action);
  persistState(next);
  return next;
}

// ── Research-question section config ────────────────────────────────────────

function sectionDefToReportSection(
  def: TemplateSectionDef,
  t: TFunction,
): ReportSection {
  return {
    id: def.id,
    title: getPublishTemplateSectionTitle(t, def),
    type: def.type,
    included: true,
    content: "",
    narrativeState: "idle",
    tableIncluded: def.tableIncluded ?? false,
    narrativeIncluded: def.narrativeIncluded ?? true,
    diagramIncluded: def.diagramType !== undefined,
    diagramType: def.diagramType,
  };
}

function buildResultsSections(
  executions: SelectedExecution[],
  t: TFunction,
  preferredAnalysisTypes?: string[],
): ReportSection[] {
  const resultSections: ReportSection[] = [];

  // Filter executions by preferred analysis types if specified
  let filteredExecs = executions;
  if (preferredAnalysisTypes && preferredAnalysisTypes.length > 0) {
    const preferred = executions.filter((e) =>
      preferredAnalysisTypes.includes(e.analysisType),
    );
    // Graceful fallback: use all executions if no matches
    if (preferred.length > 0) {
      filteredExecs = preferred;
    }
  }

  const groupedByType = new Map<string, SelectedExecution[]>();
  for (const exec of filteredExecs) {
    const group = groupedByType.get(exec.analysisType) ?? [];
    group.push(exec);
    groupedByType.set(exec.analysisType, group);
  }

  const typeOrder = [
    "characterizations", "characterization",
    "incidence_rates", "incidence_rate",
    "pathways", "pathway",
    "estimations", "estimation",
    "sccs",
    "predictions", "prediction",
    "evidence_synthesis",
  ];

  for (const analysisType of typeOrder) {
    const groupExecs = groupedByType.get(analysisType);
    if (!groupExecs || groupExecs.length === 0) continue;

    const config = SECTION_CONFIG[analysisType] ?? {
      titleKey: "",
      diagramType: null,
    };

    const tableData = buildTableFromResults(analysisType, groupExecs);

    resultSections.push({
      id: `results-${analysisType}`,
      title: config.titleKey
        ? t(config.titleKey)
        : getPublishResultSectionTitle(t, analysisType),
      type: "results",
      analysisType,
      included: true,
      content: "",
      narrativeState: "idle",
      tableData,
      tableIncluded: tableData !== undefined,
      narrativeIncluded: true,
      diagramIncluded: config.diagramType !== null,
      diagramType: config.diagramType ?? undefined,
      diagramData: config.diagramType
        ? buildDiagramData(config.diagramType, groupExecs)
        : undefined,
    });
  }

  // Catch-all: any analysis types not in typeOrder
  for (const [analysisType, groupExecs] of groupedByType) {
    if (typeOrder.includes(analysisType)) continue;

    const config = SECTION_CONFIG[analysisType] ?? {
      titleKey: "",
      diagramType: null,
    };

    const tableData = buildTableFromResults(analysisType, groupExecs);

    resultSections.push({
      id: `results-${analysisType}`,
      title: config.titleKey
        ? t(config.titleKey)
        : getPublishResultSectionTitle(t, analysisType),
      type: "results",
      analysisType,
      included: true,
      content: "",
      narrativeState: "idle",
      tableData,
      tableIncluded: tableData !== undefined,
      narrativeIncluded: true,
      diagramIncluded: config.diagramType !== null,
      diagramType: config.diagramType ?? undefined,
      diagramData: config.diagramType
        ? buildDiagramData(config.diagramType, groupExecs)
        : undefined,
    });
  }

  return resultSections;
}

function buildManuscriptSections(
  executions: SelectedExecution[],
  t: TFunction,
  templateId: string = "generic-ohdsi",
): ReportSection[] {
  const template = TEMPLATES[templateId] ?? TEMPLATES["generic-ohdsi"];

  // Split template sections into methods (before results) and discussion (after results)
  const methodsSections = template.sections.filter((s) => s.type !== "discussion");
  const discussionSections = template.sections.filter((s) => s.type === "discussion");

  const sections: ReportSection[] = [];

  // 1. Fixed sections before results (methods-type)
  for (const def of methodsSections) {
    sections.push(sectionDefToReportSection(def, t));
  }

  // 2. Dynamic results sections (only if template uses results)
  if (template.usesResults) {
    const resultSections = buildResultsSections(
      executions,
      t,
      template.preferredAnalysisTypes,
    );
    sections.push(...resultSections);
  }

  // 3. Fixed sections after results (discussion-type)
  for (const def of discussionSections) {
    sections.push(sectionDefToReportSection(def, t));
  }

  return sections;
}

function serializeSectionSvg(sectionId: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const el = document.getElementById(`diagram-${sectionId}`);
  if (!el) return undefined;
  const svg = el.querySelector("[data-diagram-canvas] svg");
  if (!svg) return undefined;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  return new XMLSerializer().serializeToString(clone);
}

function captureDiagramSvgMarkup(sections: ReportSection[]): ReportSection[] {
  return sections.map((section) =>
    section.diagramType
      ? { ...section, svgMarkup: section.svgMarkup ?? serializeSectionSvg(section.id) }
      : section,
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PublishPage() {
  const { t } = useTranslation("app");
  const [searchParams] = useSearchParams();
  const initialStudyId = searchParams.get("studyId")
    ? Number(searchParams.get("studyId"))
    : undefined;

  const [state, dispatch] = useReducer(persistingReducer, undefined, loadPersistedState);
  const steps = [
    { num: 1 as const, label: t("publish.steps.selectAnalyses") },
    { num: 2 as const, label: t("publish.steps.configure") },
    { num: 3 as const, label: t("publish.steps.preview") },
    { num: 4 as const, label: t("publish.steps.export") },
  ];

  // When navigating via ?studyId, reset if it's a different study than what's persisted
  useEffect(() => {
    if (
      initialStudyId &&
      state.selectedExecutions.length > 0 &&
      state.selectedExecutions[0].studyId !== initialStudyId
    ) {
      sessionStorage.removeItem(STORAGE_KEY);
      dispatch({ type: "SET_SELECTIONS", selections: [] });
      dispatch({ type: "SET_SECTIONS", sections: [] });
      dispatch({ type: "SET_STEP", step: 1 });
    }
  }, [initialStudyId, state.selectedExecutions]);
  const narrativeMutation = useGenerateNarrative();

  // ── Step 1 handlers ─────────────────────────────────────────────────────
  const handleSelectionsChange = useCallback(
    (selections: SelectedExecution[]) => {
      dispatch({ type: "SET_SELECTIONS", selections });
    },
    [],
  );

  const handleStep1Next = useCallback(() => {
    const sections = buildManuscriptSections(
      state.selectedExecutions,
      t,
      state.template,
    );
    const defaultTitle =
      state.selectedExecutions.length > 0
        ? state.selectedExecutions[0].studyTitle ?? state.selectedExecutions[0].analysisName
        : t("publish.page.untitledDocument");

    dispatch({ type: "SET_SECTIONS", sections });
    dispatch({ type: "SET_TITLE", title: state.title || defaultTitle });
    dispatch({ type: "SET_STEP", step: 2 });
  }, [state.selectedExecutions, state.title, state.template, t]);

  const handleTemplateChange = useCallback(
    (templateId: string) => {
      dispatch({ type: "SET_TEMPLATE", template: templateId });
      // Rebuild sections if executions are already selected
      if (state.selectedExecutions.length > 0) {
        const sections = buildManuscriptSections(
          state.selectedExecutions,
          t,
          templateId,
        );
        dispatch({ type: "SET_SECTIONS", sections });
      }
    },
    [state.selectedExecutions, t],
  );

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
      // Find matching execution(s) for context — grouped sections use analysisType
      const exec = section.executionId
        ? state.selectedExecutions.find((e) => e.executionId === section.executionId)
        : state.selectedExecutions.find((e) => e.analysisType === section.analysisType);

      // For grouped results sections, collect all result_json for richer context
      // For introduction/methods/discussion (no analysisType), include ALL results
      const groupedResults = section.analysisType
        ? state.selectedExecutions
            .filter((e) => e.analysisType === section.analysisType && e.resultJson)
            .map((e) => e.resultJson)
        : state.selectedExecutions
            .filter((e) => e.resultJson)
            .map((e) => ({
              analysisType: e.analysisType,
              analysisName: e.analysisName,
              designJson: e.designJson,
              resultJson: e.resultJson,
            }));

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
            studyTitle: state.selectedExecutions[0]?.studyTitle ?? state.title,
            analysisType: section.analysisType,
            designJson: exec?.designJson ?? {},
            resultJson: exec?.resultJson ?? {},
            groupedResults,
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
    [state.selectedExecutions, state.title, narrativeMutation],
  );

  // ── Navigation helpers ──────────────────────────────────────────────────
  const goToStep = useCallback((step: 1 | 2 | 3 | 4) => {
    dispatch({ type: "SET_STEP", step });
  }, []);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileOutput size={22} className="text-success" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              {t("publish.page.title")}
            </h1>
            <p className="text-sm text-text-primary/50">
              {t("publish.page.subtitle")}
            </p>
          </div>
        </div>
        {state.step > 1 && (
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem(STORAGE_KEY);
              dispatch({ type: "SET_SELECTIONS", selections: [] });
              dispatch({ type: "SET_SECTIONS", sections: [] });
              dispatch({ type: "SET_TITLE", title: "" });
              dispatch({ type: "SET_AUTHORS", authors: [] });
              dispatch({ type: "SET_STEP", step: 1 });
            }}
            className="text-xs text-text-ghost hover:text-text-primary transition-colors"
          >
            {t("publish.page.startNewDocument")}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2" data-testid="step-indicator">
        {steps.map(({ num, label }, i) => {
          const isActive = state.step === num;
          const isCompleted = state.step > num;

          return (
            <div key={num} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`h-px w-8 ${
                    isCompleted ? "bg-accent" : "bg-surface-elevated"
                  }`}
                />
              )}
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-accent/15 text-accent"
                    : isCompleted
                      ? "bg-accent/5 text-accent/60"
                      : "bg-surface-raised text-text-primary/30"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    isActive
                      ? "bg-accent text-surface-base"
                      : isCompleted
                        ? "bg-accent/40 text-surface-base"
                        : "bg-surface-elevated text-text-primary/40"
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
      <div className="rounded-xl border border-border-default bg-surface-raised p-6">
        {state.step === 1 && (
          <UnifiedAnalysisPicker
            selections={state.selectedExecutions}
            onSelectionsChange={handleSelectionsChange}
            onNext={handleStep1Next}
            initialStudyId={initialStudyId}
          />
        )}

        {state.step === 2 && (
          <DocumentConfigurator
            sections={state.sections}
            title={state.title}
            authors={state.authors}
            template={state.template}
            onSectionsChange={handleSectionsChange}
            onTitleChange={handleTitleChange}
            onAuthorsChange={handleAuthorsChange}
            onTemplateChange={handleTemplateChange}
            onGenerateNarrative={handleGenerateNarrative}
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
            onNext={() => {
              dispatch({
                type: "SET_SECTIONS",
                sections: captureDiagramSvgMarkup(state.sections),
              });
              goToStep(4);
            }}
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
