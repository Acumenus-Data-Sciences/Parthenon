import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAutoSave } from "../../hooks/useAutoSave";
import { useCreateAnalysis, useExecuteAnalysis } from "../../hooks/useClinicalAnalysis";
import { useCreatePin } from "../../hooks/useEvidencePins";
import { useSaveDomainState } from "../../hooks/useInvestigation";
import type {
  ClinicalAnalysisConfig,
  ClinicalAnalysisType,
  ClinicalState,
  Investigation,
} from "../../types";
import { AlertCircle } from "lucide-react";
import { AnalysisGallery } from "./AnalysisGallery";
import { ConfigDrawer } from "./ConfigDrawer";
import { ExecutionTracker } from "./ExecutionTracker";
import { RunHistoryPanel } from "./RunHistoryPanel";

// ── Types ────────────────────────────────────────────────────────────────────

type PanelView = "gallery" | "tracking" | "history";

interface ActiveExecution {
  apiPrefix: string;
  analysisId: number;
  executionId: number;
  type: ClinicalAnalysisType;
}

interface ClinicalPanelProps {
  investigation: Investigation;
}

// ── Sub-tab bar ──────────────────────────────────────────────────────────────

interface SubTabBarProps {
  view: PanelView;
  hasActiveExecution: boolean;
  onChange: (view: PanelView) => void;
}

function SubTabBar({ view, hasActiveExecution, onChange }: SubTabBarProps) {
  const tabs: { id: PanelView; label: string; hidden?: boolean }[] = [
    { id: "gallery", label: "Gallery" },
    { id: "tracking", label: "Active Run", hidden: !hasActiveExecution },
    { id: "history", label: "History" },
  ];

  return (
    <div className="flex items-center gap-1 border-b border-zinc-800 px-6 pt-2" role="tablist">
      {tabs
        .filter((t) => !t.hidden)
        .map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            onClick={() => onChange(tab.id)}
            className={[
              "px-4 py-2.5 text-xs font-medium rounded-t transition-colors",
              view === tab.id
                ? "text-[#2DD4BF] border-b-2 border-[#2DD4BF]"
                : "text-zinc-500 hover:text-zinc-300",
            ].join(" ")}
          >
            {tab.label}
            {tab.id === "tracking" && (
              <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
            )}
          </button>
        ))}
    </div>
  );
}

// ── Build design payload ──────────────────────────────────────────────────────

function buildDesignPayload(
  config: ClinicalAnalysisConfig,
): Record<string, unknown> {
  const base: Record<string, unknown> = {};

  switch (config.type) {
    case "characterization":
      return {
        ...base,
        name: "Investigation Characterization",
        cohort_ids: config.target_cohort_id ? [config.target_cohort_id] : [],
        source_id: config.source_id,
        min_cell_count: (config.parameters.min_cell_count as number | undefined) ?? 5,
      };

    case "incidence_rate":
      return {
        ...base,
        name: "Investigation Incidence Rate",
        target_cohort_id: config.target_cohort_id,
        outcome_cohort_ids: config.outcome_cohort_ids,
        source_id: config.source_id,
        tar_start: (config.parameters.tar_start as number | undefined) ?? 0,
        tar_end: (config.parameters.tar_end as number | undefined) ?? 365,
      };

    case "estimation":
      return {
        ...base,
        name: "Investigation Comparative Estimation",
        design_json: {
          targetCohortId: config.target_cohort_id,
          comparatorCohortId: config.comparator_cohort_id,
          outcomeCohortIds: config.outcome_cohort_ids,
          psMethod: config.parameters.ps_method ?? "matching",
        },
        source_id: config.source_id,
      };

    case "prediction":
      return {
        ...base,
        name: "Investigation Patient-Level Prediction",
        target_cohort_id: config.target_cohort_id,
        outcome_cohort_ids: config.outcome_cohort_ids,
        source_id: config.source_id,
        model_type: config.parameters.model_type ?? "lasso_logistic_regression",
      };

    case "sccs":
      return {
        ...base,
        name: "Investigation SCCS",
        exposure_cohort_id: config.target_cohort_id,
        outcome_cohort_ids: config.outcome_cohort_ids,
        source_id: config.source_id,
        naive_period: (config.parameters.naive_period as number | undefined) ?? 180,
      };

    case "pathway":
      return {
        ...base,
        name: "Investigation Pathway Analysis",
        target_cohort_id: config.target_cohort_id,
        source_id: config.source_id,
      };

    case "evidence_synthesis":
      return {
        ...base,
        name: "Investigation Evidence Synthesis",
      };

    default:
      return base;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

const VALID_PANEL_VIEWS: PanelView[] = ["gallery", "tracking", "history"];

export function ClinicalPanel({ investigation }: ClinicalPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedType, setSelectedType] = useState<ClinicalAnalysisType | null>(null);
  const [activeExecution, setActiveExecution] = useState<ActiveExecution | null>(null);
  const [view, setView] = useState<PanelView>(() => {
    const urlTab = searchParams.get("subtab");
    const isValid = VALID_PANEL_VIEWS.includes(urlTab as PanelView);
    // "tracking" requires an active execution; fall back to gallery if loaded cold
    if (isValid && urlTab !== "tracking") return urlTab as PanelView;
    return "gallery";
  });
  const [executeError, setExecuteError] = useState<string | null>(null);

  function handleViewChange(v: PanelView) {
    setView(v);
    setSearchParams(
      (prev) => {
        prev.set("subtab", v);
        return prev;
      },
      { replace: true },
    );
  }

  // Local copy of clinical state for auto-save
  const [clinicalState, setClinicalState] = useState<ClinicalState>(
    () => investigation.clinical_state,
  );

  // Hooks
  const createAnalysisMutation = useCreateAnalysis();
  const executeAnalysisMutation = useExecuteAnalysis();
  const saveDomainState = useSaveDomainState();
  const createPin = useCreatePin(investigation.id);

  useAutoSave(
    investigation.id,
    "clinical",
    clinicalState as unknown as Record<string, unknown>,
  );

  // ── Pin handler ────────────────────────────────────────────────────────────
  const handlePinFinding = useCallback(
    (finding: {
      domain: string;
      section: string;
      finding_type: string;
      finding_payload: Record<string, unknown>;
    }) => {
      createPin.mutate({
        domain: finding.domain,
        section: finding.section,
        finding_type: finding.finding_type,
        finding_payload: finding.finding_payload,
        is_key_finding: false,
      });
    },
    [createPin],
  );

  // ── Execute handler ────────────────────────────────────────────────────────
  const handleExecute = useCallback(
    async (config: ClinicalAnalysisConfig) => {
      setExecuteError(null);

      try {
        const descriptor = (await import("../../clinicalRegistry")).CLINICAL_ANALYSIS_REGISTRY.find(
          (r) => r.type === config.type,
        );

        const apiPrefix = descriptor?.apiPrefix ?? config.type;
        const designPayload = buildDesignPayload(config);

        // 1. Create the analysis record
        const analysisRecord = await createAnalysisMutation.mutateAsync({
          apiPrefix,
          payload: designPayload,
        });

        const analysisId = (analysisRecord.id ?? analysisRecord.analysis_id) as number;

        // 2. Execute the analysis
        const executionRecord = await executeAnalysisMutation.mutateAsync({
          apiPrefix,
          analysisId,
          sourceId: config.source_id ?? undefined,
        });

        const executionId = (
          (executionRecord as Record<string, unknown>).id ??
          (executionRecord as Record<string, unknown>).execution_id
        ) as number;

        // 3. Close config drawer and switch to tracking view
        setSelectedType(null);
        setActiveExecution({ apiPrefix, analysisId, executionId, type: config.type });
        handleViewChange("tracking");

        // 4. Update clinical state to track the new queued analysis
        const newEntry = {
          analysis_type: config.type,
          api_prefix: apiPrefix,
          analysis_id: analysisId,
          execution_id: executionId,
          config: designPayload,
          status: "queued" as const,
        };

        const updated: ClinicalState = {
          ...clinicalState,
          queued_analyses: [...clinicalState.queued_analyses, newEntry],
          selected_source_id: config.source_id,
        };

        setClinicalState(updated);

        // Persist immediately (don't wait for debounce on important state changes)
        saveDomainState.mutate({
          id: investigation.id,
          domain: "clinical",
          state: updated as unknown as Record<string, unknown>,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred while dispatching the analysis.";
        setExecuteError(message);
      }
    },
    [
      createAnalysisMutation,
      executeAnalysisMutation,
      clinicalState,
      saveDomainState,
      investigation.id,
    ],
  );

  // ── Complete handler ────────────────────────────────────────────────────────
  const handleComplete = useCallback(
    (_execution: Record<string, unknown>) => {
      if (!activeExecution) return;

      const updated: ClinicalState = {
        ...clinicalState,
        queued_analyses: clinicalState.queued_analyses.map((qa) =>
          qa.analysis_id === activeExecution.analysisId &&
          qa.execution_id === activeExecution.executionId
            ? { ...qa, status: "complete" as const }
            : qa,
        ),
      };

      setClinicalState(updated);
    },
    [activeExecution, clinicalState],
  );

  // ── Select execution from history ──────────────────────────────────────────
  const handleSelectExecution = useCallback(
    (
      apiPrefix: string,
      analysisId: number,
      executionId: number,
      type: ClinicalAnalysisType,
    ) => {
      setActiveExecution({ apiPrefix, analysisId, executionId, type });
      handleViewChange("tracking");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ backgroundColor: "#0E0E11" }}>
      {/* Sub-tab navigation */}
      <SubTabBar
        view={view}
        hasActiveExecution={activeExecution !== null}
        onChange={(v) => {
          // If switching away from tracking with no active run, go to gallery
          if (v === "tracking" && !activeExecution) return;
          handleViewChange(v);
        }}
      />

      {/* Panel body */}
      <div className="px-6 py-6">
        {view === "gallery" && (
          <AnalysisGallery
            investigation={investigation}
            onSelectAnalysis={(type) => setSelectedType(type)}
          />
        )}

        {view === "tracking" && activeExecution && (
          <ExecutionTracker
            apiPrefix={activeExecution.apiPrefix}
            analysisId={activeExecution.analysisId}
            executionId={activeExecution.executionId}
            analysisType={activeExecution.type}
            onComplete={handleComplete}
            onPinFinding={handlePinFinding}
          />
        )}

        {view === "history" && (
          <RunHistoryPanel
            investigation={{ ...investigation, clinical_state: clinicalState }}
            onSelectExecution={handleSelectExecution}
          />
        )}
      </div>

      {/* Inline execute error — shown below the panel body */}
      {executeError && (
        <div className="mx-6 mb-4 flex items-start gap-3 rounded border border-[#9B1B30] bg-[#9B1B30]/10 px-4 py-3">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#9B1B30]" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#e05c6e]">Analysis dispatch failed</p>
            <p className="text-xs text-zinc-400 mt-0.5 break-words">{executeError}</p>
          </div>
          <button
            type="button"
            onClick={() => setExecuteError(null)}
            className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors text-xs"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Config drawer — rendered at this level so it sits above content */}
      <ConfigDrawer
        analysisType={selectedType}
        investigation={investigation}
        onClose={() => {
          setSelectedType(null);
          setExecuteError(null);
        }}
        onExecute={(config) => {
          void handleExecute(config);
        }}
        isPending={
          createAnalysisMutation.isPending || executeAnalysisMutation.isPending
        }
        pendingLabel={
          createAnalysisMutation.isPending ? "Creating…" : "Dispatching…"
        }
      />
    </div>
  );
}
