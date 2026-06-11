// ---------------------------------------------------------------------------
// PublishPage — 4-step publish & export wizard
// ---------------------------------------------------------------------------

import { useReducer, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { FileOutput, Check } from "lucide-react";
import { HelpButton } from "@/features/help";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import UnifiedAnalysisPicker from "../components/UnifiedAnalysisPicker";
import DocumentConfigurator from "../components/DocumentConfigurator";
import DocumentPreview from "../components/DocumentPreview";
import ExportPanel from "../components/ExportPanel";
import { HybridPromptModal } from "../components/PublishPage/HybridPromptModal";
import { AgentCopilotPanel } from "../components/agent/AgentCopilotPanel";
import { ShareDropdown } from "../components/PublishPage/ShareDropdown";
import { SaveDraftButton } from "../components/library/SaveDraftButton";
import { SaveStatusIndicator } from "../components/PublishPage/SaveStatusIndicator";
import { SnapshotsPanel } from "../components/library/SnapshotsPanel";
import { useAutosave } from "../hooks/useAutosave";
import { useGenerateNarrative } from "../hooks/useNarrativeGeneration";
import { useDraft, useCreateDraft, useUpdateDraftById } from "../hooks/useDrafts";
import { useAuthStore } from "@/stores/authStore";
import { useFlag } from "@/stores/featureFlagsStore";
import { buildTableFromResults } from "../lib/tableBuilders";
import { buildDiagramData } from "../lib/diagramBuilders";
import { getDiagramSvgMarkup } from "../lib/svgExport";
import { captureSnapshots } from "../lib/snapshotCapture";
import { serializeForSave, deserializeFromLoad } from "../lib/draftSerialization";
import {
  getPublishResultSectionTitle,
  getPublishTemplateSectionTitle,
} from "../lib/i18n";
import { SECTION_CONFIG } from "../lib/sectionConfig";
import type {
  ReportSection,
  SelectedExecution,
  NarrativeState,
  DraftSection,
  PublicationDraftVisibility,
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
  hasMeaningfulEdit: boolean;
}

type Action =
  | { type: "SET_STEP"; step: 1 | 2 | 3 | 4 }
  | { type: "SET_SELECTIONS"; selections: SelectedExecution[] }
  | { type: "SET_SECTIONS"; sections: ReportSection[] }
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_AUTHORS"; authors: string[] }
  | { type: "UPDATE_SECTION"; id: string; updates: Partial<ReportSection> }
  | { type: "SET_TEMPLATE"; template: string }
  | { type: "REHYDRATE"; state: WizardState };

function wizardReducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_SELECTIONS":
      return {
        ...state,
        selectedExecutions: action.selections,
        hasMeaningfulEdit:
          state.hasMeaningfulEdit || action.selections.length > 0,
      };
    case "SET_SECTIONS":
      return {
        ...state,
        sections: action.sections,
        hasMeaningfulEdit: state.hasMeaningfulEdit || action.sections.length > 0,
      };
    case "SET_TITLE":
      return { ...state, title: action.title, hasMeaningfulEdit: true };
    case "SET_AUTHORS":
      return { ...state, authors: action.authors, hasMeaningfulEdit: true };
    case "UPDATE_SECTION":
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.id === action.id ? { ...s, ...action.updates } : s,
        ),
        hasMeaningfulEdit: true,
      };
    case "SET_TEMPLATE":
      return { ...state, template: action.template, hasMeaningfulEdit: true };
    case "REHYDRATE":
      return { ...action.state, hasMeaningfulEdit: false };
    default:
      return state;
  }
}

const STORAGE_KEY = "parthenon:publish-wizard";
const PROMPT_SHOWN_KEY = "parthenon:publish-prompt-shown";

const defaultState: WizardState = {
  step: 1,
  selectedExecutions: [],
  sections: [],
  title: "",
  authors: [],
  template: "generic-ohdsi",
  hasMeaningfulEdit: false,
};

function loadPersistedState(): WizardState {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as WizardState;
      // Validate shape
      if (parsed.step && parsed.sections && parsed.selectedExecutions) {
        return { ...parsed, hasMeaningfulEdit: parsed.hasMeaningfulEdit ?? false };
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

function captureDiagramSvgMarkup(sections: ReportSection[]): ReportSection[] {
  return sections.map((section) =>
    section.diagramType
      ? { ...section, svgMarkup: section.svgMarkup ?? getDiagramSvgMarkup(section.id) }
      : section,
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PublishPage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const { draftId: draftIdParam } = useParams<{ draftId: string }>();
  const draftId =
    draftIdParam && /^\d+$/.test(draftIdParam) ? Number(draftIdParam) : null;
  // Ships dark: the AI publication copilot only renders when the deployment flag
  // is enabled (PUBLISH_AGENT_ENABLED) — keeps it off prod until credit is added.
  const publishAgentEnabled = useFlag("ai.agents");

  const [searchParams] = useSearchParams();
  const initialStudyId = searchParams.get("studyId")
    ? Number(searchParams.get("studyId"))
    : undefined;

  const [state, dispatch] = useReducer(persistingReducer, undefined, loadPersistedState);

  // Server-side draft hooks
  const draftQuery = useDraft(draftId);
  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraftById();
  const hydratedRef = useRef(false);

  // ── Read-only detection (Task 39) ───────────────────────────────────────
  // A loaded draft is read-only when (a) it belongs to a different user and
  // (b) the current user lacks `studies.edit`. The check defaults to editable
  // until the draft data arrives to avoid flashing a read-only banner. The
  // backend (Task 35 PublicationDraftPolicy) is the source of truth — this is
  // purely a UX surface that disables save affordances + offers a duplicate.
  const currentUser = useAuthStore((s) => s.user);
  const isOwner =
    currentUser?.id != null && draftQuery.data?.user_id === currentUser.id;
  const hasStudiesEdit = (currentUser?.permissions ?? []).includes(
    "studies.edit",
  );
  const readOnly =
    draftId !== null &&
    draftQuery.data !== undefined &&
    !isOwner &&
    !hasStudiesEdit;

  // Hybrid prompt state
  const [promptOpen, setPromptOpen] = useState(false);

  // ── Autosave wiring (Task 30) ──────────────────────────────────────────
  // buildDocumentJson is defined below; we declare a forward ref to it via
  // useMemo over `state` so the autosave hook only re-evaluates on state
  // changes. The hook internally hashes the payload to avoid redundant PATCHes.

  const steps = [
    { num: 1 as const, label: t("publish.steps.selectAnalyses") },
    { num: 2 as const, label: t("publish.steps.configure") },
    { num: 3 as const, label: t("publish.steps.preview") },
    { num: 4 as const, label: t("publish.steps.export") },
  ];

  // ── Hydrate from server-side draft when :draftId is present ─────────────
  useEffect(() => {
    if (draftId === null) return;
    if (!draftQuery.data || hydratedRef.current) return;
    const d = draftQuery.data;
    const w = deserializeFromLoad(d.document_json);
    dispatch({
      type: "REHYDRATE",
      state: {
        step: w.step,
        selectedExecutions: w.selectedExecutions as SelectedExecution[],
        sections: w.sections as unknown as ReportSection[],
        title: d.title,
        authors: w.authors,
        template: d.template,
        hasMeaningfulEdit: false,
      },
    });
    hydratedRef.current = true;
  }, [draftId, draftQuery.data]);

  // ── When navigating via ?studyId on a new (no-draftId) flow, reset ──────
  useEffect(() => {
    if (draftId !== null) return; // never reset when loading an explicit draft
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
  }, [draftId, initialStudyId, state.selectedExecutions]);

  // ── Hybrid prompt: show once on first meaningful edit (new draft only) ─
  useEffect(() => {
    if (draftId !== null) return;
    if (
      state.hasMeaningfulEdit &&
      !promptOpen &&
      !sessionStorage.getItem(PROMPT_SHOWN_KEY)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot modal trigger from reducer-driven edit signal
      setPromptOpen(true);
      sessionStorage.setItem(PROMPT_SHOWN_KEY, "1");
    }
  }, [draftId, state.hasMeaningfulEdit, promptOpen]);

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

  // ── Save helpers ────────────────────────────────────────────────────────
  const buildDocumentJson = useCallback(() => {
    // Capture live SVG markup first, then capture snapshots via DOM lookup.
    // ReportSection and DraftSection share enough shape for the persistence
    // layer (id, title, type, content, included, diagram/table fields) —
    // documented cast.
    const withSvg = captureDiagramSvgMarkup(state.sections);
    const sectionsWithSnapshots = captureSnapshots(
      withSvg as unknown as DraftSection[],
    );
    return serializeForSave({
      title: state.title,
      authors: state.authors,
      template: state.template,
      step: state.step,
      selectedExecutions: state.selectedExecutions as unknown as Parameters<
        typeof serializeForSave
      >[0]["selectedExecutions"],
      sections: sectionsWithSnapshots,
    });
  }, [state]);

  // ── Autosave (Task 30) ──────────────────────────────────────────────────
  // Memoize the document payload so captureSnapshots (DOM query) only runs
  // when reducer state changes — not on every PublishPage render. The
  // autosave hook still hashes + debounces internally to avoid extra PATCHes.
  const ifUnmodifiedSince = draftQuery.data?.updated_at ?? null;
  const documentJsonForSave = useMemo(
    () => buildDocumentJson(),
    [buildDocumentJson],
  );
  const autosave = useAutosave({
    // Pass null when read-only so the hook short-circuits and never PATCHes.
    // (Backend would 403 anyway via PublicationDraftPolicy::update.)
    draftId: readOnly ? null : draftId,
    title: state.title,
    document: documentJsonForSave,
    ifUnmodifiedSince,
    onStaleConflict: () => {
      if (
        window.confirm(
          "This draft was changed in another tab. Reload to see latest changes?",
        )
      ) {
        window.location.reload();
      }
    },
  });

  const handlePromptSave = useCallback(
    async (title: string) => {
      dispatch({ type: "SET_TITLE", title });
      const documentJson = serializeForSave({
        title,
        authors: state.authors,
        template: state.template,
        step: state.step,
        selectedExecutions: state.selectedExecutions as unknown as Parameters<
          typeof serializeForSave
        >[0]["selectedExecutions"],
        sections: state.sections as unknown as DraftSection[],
      });
      const draft = await createDraft.mutateAsync({
        title,
        template: state.template,
        document_json: documentJson,
        study_id: state.selectedExecutions[0]?.studyId ?? null,
      });
      setPromptOpen(false);
      sessionStorage.removeItem(STORAGE_KEY);
      navigate(`/publish/library/${draft.id}`, { replace: true });
    },
    [state, createDraft, navigate],
  );

  // ── Visibility / Share wiring (Task 38) ─────────────────────────────────
  const visibility: PublicationDraftVisibility =
    draftQuery.data?.visibility ?? "private";
  const studyIdForShare =
    state.selectedExecutions[0]?.studyId ?? draftQuery.data?.study_id ?? null;
  const studyTitle = state.selectedExecutions[0]?.studyTitle ?? undefined;

  const handleVisibilityChange = (next: PublicationDraftVisibility) => {
    if (draftId === null) return;
    updateDraft.mutate({
      id: draftId,
      payload: { visibility: next, study_id: studyIdForShare },
    });
  };

  // ── Duplicate-to-my-drafts (Task 39) ────────────────────────────────────
  // Viewers who cannot edit can still fork a private copy attributed to
  // themselves. The new draft starts unlinked (study_id: null, default
  // visibility = "private") so it lives in the viewer's personal drafts.
  const handleDuplicateToMyDrafts = useCallback(async () => {
    const documentJson = buildDocumentJson();
    const draft = await createDraft.mutateAsync({
      title: `${state.title || "Untitled manuscript"} (copy)`,
      template: state.template,
      document_json: documentJson,
      study_id: null,
    });
    sessionStorage.removeItem(STORAGE_KEY);
    navigate(`/publish/library/${draft.id}`, { replace: true });
  }, [state.title, state.template, buildDocumentJson, createDraft, navigate]);

  const handleSaveButton = useCallback(async () => {
    const documentJson = buildDocumentJson();
    if (draftId === null) {
      const title = state.title || "Untitled manuscript";
      const draft = await createDraft.mutateAsync({
        title,
        template: state.template,
        document_json: documentJson,
        study_id: state.selectedExecutions[0]?.studyId ?? null,
      });
      sessionStorage.removeItem(STORAGE_KEY);
      navigate(`/publish/library/${draft.id}`, { replace: true });
    } else {
      await updateDraft.mutateAsync({
        id: draftId,
        payload: { title: state.title, document_json: documentJson },
      });
    }
  }, [
    draftId,
    state.title,
    state.template,
    state.selectedExecutions,
    buildDocumentJson,
    createDraft,
    updateDraft,
    navigate,
  ]);

  return (
    <div className="flex gap-0">
      <div className="min-w-0 flex-1 space-y-6">
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
        <div className="flex items-center gap-2">
          <HelpButton helpKey="publish" />
          {readOnly ? (
            <>
              <span
                className="inline-flex items-center gap-1 rounded-md bg-surface-elevated px-3 py-1.5 text-xs text-text-primary/60"
                data-testid="publish-readonly-pill"
              >
                View only — request edit access from owner
              </span>
              <button
                type="button"
                onClick={() => {
                  void handleDuplicateToMyDrafts();
                }}
                disabled={createDraft.isPending}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-surface-base hover:bg-accent/90 disabled:opacity-60"
                data-testid="publish-duplicate-button"
              >
                {createDraft.isPending ? "Duplicating…" : "Duplicate to my drafts"}
              </button>
            </>
          ) : draftId === null ? (
            <SaveDraftButton
              hasDraftId={false}
              saving={createDraft.isPending || updateDraft.isPending}
              onSave={handleSaveButton}
            />
          ) : (
            <SaveStatusIndicator
              status={autosave.status}
              lastSavedAt={autosave.lastSavedAt}
              onRetry={() => {
                void autosave.retry();
              }}
            />
          )}
          {draftId !== null && isOwner && (
            <ShareDropdown
              visibility={visibility}
              studyLinked={studyIdForShare !== null}
              studyName={studyTitle}
              onChange={handleVisibilityChange}
            />
          )}
          {draftQuery.data?.study_slug && (
            <button
              type="button"
              onClick={() => navigate(`/studies/${draftQuery.data?.study_slug}?tab=manuscript`)}
              className="text-xs text-accent hover:text-accent-light transition-colors"
              title={draftQuery.data?.study_title ?? undefined}
            >
              ← Back to study
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate("/publish/library")}
            className="text-xs text-text-ghost hover:text-text-primary transition-colors"
          >
            ← Library
          </button>
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

      {/* Snapshots panel — visible on Steps 2 and 3 when editing an existing draft */}
      {/* Hide for non-owners; backend policy would reject snapshot writes anyway. */}
      {draftId !== null && isOwner && (state.step === 2 || state.step === 3) && (
        <SnapshotsPanel
          draftId={draftId}
          defaultLabel={`Snapshot ${new Date().toISOString().slice(0, 10)}`}
          onReverted={() => {
            hydratedRef.current = false;
            void draftQuery.refetch();
          }}
        />
      )}

      <HybridPromptModal
        open={promptOpen}
        defaultTitle={
          state.selectedExecutions[0]?.studyTitle ??
          (state.title || "Untitled manuscript")
        }
        onSave={handlePromptSave}
        onContinueWithoutSaving={() => setPromptOpen(false)}
      />
      </div>
      {publishAgentEnabled && draftId !== null && <AgentCopilotPanel draftId={draftId} />}
    </div>
  );
}
