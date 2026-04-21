import { lazy, Suspense, useCallback, useState } from "react";
import type { TFunction } from "i18next";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import type { FinnGenAnalysisModule, FinnGenRun } from "@/features/_finngen-foundation";
import { AlertCircle } from "lucide-react";
import { AnalysisGallery } from "./AnalysisGallery";
import { ConfigDrawer } from "./ConfigDrawer";
import { ExecutionTracker } from "./ExecutionTracker";
import { RunHistoryPanel } from "./RunHistoryPanel";

const FinnGenGalleryPage = lazy(() =>
  import("@/features/finngen-analyses/pages/AnalysisGalleryPage").then((m) => ({
    default: m.AnalysisGalleryPage,
  })),
);

const FinnGenDetailPage = lazy(() =>
  import("@/features/finngen-analyses/pages/AnalysisDetailPage").then((m) => ({
    default: m.AnalysisDetailPage,
  })),
);

const FinnGenRunHistoryTable = lazy(() =>
  import("@/features/finngen-analyses/components/RunHistoryTable").then((m) => ({
    default: m.RunHistoryTable,
  })),
);

// ── Types ────────────────────────────────────────────────────────────────────

type PanelView = "gallery" | "tracking" | "history" | "finngen" | "finngen-history";

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
  const { t } = useTranslation("app");
  const tabs: { id: PanelView; label: string; hidden?: boolean }[] = [
    { id: "gallery", label: t("investigation.common.tabs.gallery") },
    {
      id: "tracking",
      label: t("investigation.common.tabs.tracking"),
      hidden: !hasActiveExecution,
    },
    { id: "history", label: t("investigation.common.tabs.history") },
    { id: "finngen", label: t("investigation.common.tabs.finngen") },
    {
      id: "finngen-history",
      label: t("investigation.common.tabs.finngenHistory"),
    },
  ];

  return (
    <div className="flex items-center gap-1 border-b border-border-default px-6 pt-2" role="tablist">
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
                ? "text-success border-b-2 border-success"
                : "text-text-ghost hover:text-text-secondary",
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
  t: TFunction<"app">,
  config: ClinicalAnalysisConfig,
): Record<string, unknown> {
  const base: Record<string, unknown> = {};

  switch (config.type) {
    case "characterization":
      return {
        ...base,
        name: t("investigation.clinical.payloadNames.characterization"),
        cohort_ids: config.target_cohort_id ? [config.target_cohort_id] : [],
        source_id: config.source_id,
        min_cell_count: (config.parameters.min_cell_count as number | undefined) ?? 5,
      };

    case "incidence_rate":
      return {
        ...base,
        name: t("investigation.clinical.payloadNames.incidence_rate"),
        target_cohort_id: config.target_cohort_id,
        outcome_cohort_ids: config.outcome_cohort_ids,
        source_id: config.source_id,
        tar_start: (config.parameters.tar_start as number | undefined) ?? 0,
        tar_end: (config.parameters.tar_end as number | undefined) ?? 365,
      };

    case "estimation":
      return {
        ...base,
        name: t("investigation.clinical.payloadNames.estimation"),
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
        name: t("investigation.clinical.payloadNames.prediction"),
        target_cohort_id: config.target_cohort_id,
        outcome_cohort_ids: config.outcome_cohort_ids,
        source_id: config.source_id,
        model_type: config.parameters.model_type ?? "lasso_logistic_regression",
      };

    case "sccs":
      return {
        ...base,
        name: t("investigation.clinical.payloadNames.sccs"),
        exposure_cohort_id: config.target_cohort_id,
        outcome_cohort_ids: config.outcome_cohort_ids,
        source_id: config.source_id,
        naive_period: (config.parameters.naive_period as number | undefined) ?? 180,
      };

    case "pathway":
      return {
        ...base,
        name: t("investigation.clinical.payloadNames.pathway"),
        target_cohort_id: config.target_cohort_id,
        source_id: config.source_id,
      };

    case "evidence_synthesis":
      return {
        ...base,
        name: t("investigation.clinical.payloadNames.evidence_synthesis"),
      };

    default:
      return base;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

const VALID_PANEL_VIEWS: PanelView[] = ["gallery", "tracking", "history", "finngen", "finngen-history"];

export function ClinicalPanel({ investigation }: ClinicalPanelProps) {
  const { t } = useTranslation("app");
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedType, setSelectedType] = useState<ClinicalAnalysisType | null>(null);
  const [activeExecution, setActiveExecution] = useState<ActiveExecution | null>(null);
  const [selectedFinnGenModule, setSelectedFinnGenModule] = useState<FinnGenAnalysisModule | null>(null);
  const [view, setView] = useState<PanelView>(() => {
    const urlTab = searchParams.get("subtab");
    const isValid = VALID_PANEL_VIEWS.includes(urlTab as PanelView);
    // "tracking" requires an active execution; fall back to gallery if loaded cold
    if (isValid && urlTab !== "tracking") return urlTab as PanelView;
    return "gallery";
  });
  const [executeError, setExecuteError] = useState<string | null>(null);

  const handleViewChange = useCallback((v: PanelView) => {
    if (v !== "finngen") {
      setSelectedFinnGenModule(null);
    }
    setView(v);
    setSearchParams(
      (prev) => {
        prev.set("subtab", v);
        return prev;
      },
      { replace: true },
    );
  }, [setSearchParams]);

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
        const designPayload = buildDesignPayload(t, config);

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
          queued_analyses: [...(clinicalState.queued_analyses ?? []), newEntry],
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
          err instanceof Error
            ? err.message
            : t("investigation.common.messages.unexpectedDispatchError");
        setExecuteError(message);
      }
    },
    [
      createAnalysisMutation,
      executeAnalysisMutation,
      clinicalState,
      saveDomainState,
      investigation.id,
      handleViewChange,
      t,
    ],
  );

  // ── Complete handler ────────────────────────────────────────────────────────
  const handleComplete = useCallback(
    (_execution: Record<string, unknown>) => {
      if (!activeExecution) return;

      const updated: ClinicalState = {
        ...clinicalState,
        queued_analyses: (clinicalState.queued_analyses ?? []).map((qa) =>
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
    <div className="flex flex-col" style={{ backgroundColor: "var(--surface-base)" }}>
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

        {view === "finngen" && !selectedFinnGenModule && (
          <Suspense
            fallback={
              <div className="py-8 text-center text-xs text-text-ghost">
                {t("investigation.common.messages.finngenLoading")}
              </div>
            }
          >
            <FinnGenGalleryPage
              sourceKey={String(clinicalState.selected_source_id ?? "")}
              onSelectModule={(mod) => setSelectedFinnGenModule(mod)}
            />
          </Suspense>
        )}

        {view === "finngen" && selectedFinnGenModule && (
          <Suspense
            fallback={
              <div className="py-8 text-center text-xs text-text-ghost">
                {t("investigation.common.messages.finngenLoading")}
              </div>
            }
          >
            <FinnGenDetailPage
              moduleKey={selectedFinnGenModule.key}
              sourceKey={String(clinicalState.selected_source_id ?? "")}
              onBack={() => setSelectedFinnGenModule(null)}
            />
          </Suspense>
        )}

        {view === "finngen-history" && (
          <Suspense
            fallback={
              <div className="py-8 text-center text-xs text-text-ghost">
                {t("investigation.common.messages.finngenLoading")}
              </div>
            }
          >
            <FinnGenRunHistoryTable
              sourceKey={String(clinicalState.selected_source_id ?? "")}
              onSelectRun={(run: FinnGenRun) => {
                const mod: FinnGenAnalysisModule = {
                  key: run.analysis_type,
                  label: run.analysis_type.replace("co2.", ""),
                  description: "",
                  darkstar_endpoint: "",
                  enabled: true,
                  min_role: "researcher",
                  settings_schema: null,
                  default_settings: null,
                  result_schema: null,
                  result_component: null,
                };
                setSelectedFinnGenModule(mod);
                handleViewChange("finngen");
              }}
            />
          </Suspense>
        )}
      </div>

      {/* Inline execute error — shown below the panel body */}
      {executeError && (
        <div className="mx-6 mb-4 flex items-start gap-3 rounded border border-primary bg-primary/10 px-4 py-3">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-critical">
              {t("investigation.common.messages.analysisDispatchFailed")}
            </p>
            <p className="text-xs text-text-muted mt-0.5 break-words">{executeError}</p>
          </div>
          <button
            type="button"
            onClick={() => setExecuteError(null)}
            className="shrink-0 text-text-ghost hover:text-text-secondary transition-colors text-xs"
            aria-label={t("investigation.common.actions.dismissError")}
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
          createAnalysisMutation.isPending
            ? t("investigation.common.actions.createInvestigation")
            : t("investigation.common.messages.running")
        }
      />
    </div>
  );
}
