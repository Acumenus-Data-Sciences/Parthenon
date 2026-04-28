import { useCallback, useMemo, useRef, useState, type ChangeEvent, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Brain, Loader2, Lock, Plus, Sparkles, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { StudyDesignLockPanel } from "./StudyDesignLockPanel";
import { ProtocolImportProgress } from "./ProtocolImportProgress";
import {
  getProtocolImportPhase,
  useProtocolImportElapsed,
} from "./protocolImportProgress";
import { buildStudyDesignGuidance } from "./studyDesignGuidance";
import { ActionGateHint } from "./workbench/shared/ActionGateHint";
import { AnalysisPlanPanel } from "./workbench/AnalysisPlanPanel";
import { BottomUpCompatibilityPanel } from "./workbench/BottomUpCompatibilityPanel";
import { CohortDraftPanel } from "./workbench/CohortDraftPanel";
import { ConceptSetDraftPanel } from "./workbench/ConceptSetDraftPanel";
import { FeasibilityDashboard } from "./workbench/FeasibilityDashboard";
import { IntentReviewPanel } from "./workbench/IntentReviewPanel";
import { PhenotypeRecommendationPanel } from "./workbench/PhenotypeRecommendationPanel";
import { StudyCompilerGuidancePanel } from "./workbench/StudyCompilerGuidancePanel";
import {
  cohortDraftPayload,
  conceptDraftPayload,
  draftPayloadRecord,
  formToSpec,
  mutationError,
  specToForm,
  textAt,
  versionSpec,
  type IntentFormState,
} from "./workbench/studyDesignWorkbenchHelpers";
import type { Study, StudyDesignAsset, StudyDesignDraftConcept } from "../types/study";
import {
  useAcceptStudyDesignVersion,
  useCreateStudyDesignSession,
  useDraftStudyAnalysisPlans,
  useDraftStudyCohorts,
  useDraftStudyConceptSets,
  useGenerateStudyIntent,
  useImportStudyDesignProtocol,
  useImportExistingStudyDesign,
  useCritiqueStudyDesignVersion,
  useLinkStudyCohortDraft,
  useMaterializeStudyCohortDraft,
  useMaterializeStudyConceptSetDraft,
  useMaterializeStudyAnalysisPlan,
  useLockStudyDesignVersion,
  useRecommendStudyPhenotypes,
  useReviewStudyDesignAsset,
  useRunStudyFeasibility,
  useVerifyStudyAnalysisPlan,
  useStudyDesignGuidance,
  useStudyDesignLockReadiness,
  useStudyCohortReadiness,
  useStudyDesignAssets,
  useStudyDesignSessions,
  useStudyDesignVersions,
  useVerifyStudyConceptSetDrafts,
  useVerifyStudyCohortDraft,
  useUpdateStudyConceptSetDraft,
  useUpdateStudyCohortDraft,
  useUpdateStudyDesignVersion,
  useVerifyStudyConceptSetDraft,
} from "../hooks/useStudies";

interface StudyDesignWorkbenchProps {
  study: Study;
  /** Optional ref forwarded to the workbench title heading for focus management. */
  headingRef?: Ref<HTMLHeadingElement>;
}

export function StudyDesignWorkbench({ study, headingRef }: StudyDesignWorkbenchProps) {
  const { t } = useTranslation("app");
  const slug = study.slug || String(study.id);
  const protocolInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [researchQuestion, setResearchQuestion] = useState(
    study.primary_objective || study.description || "",
  );
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [protocolFileName, setProtocolFileName] = useState<string | null>(null);
  const [protocolImportStartedAt, setProtocolImportStartedAt] = useState<number | null>(null);
  const [protocolImportCompletedAt, setProtocolImportCompletedAt] = useState<number | null>(null);
  const [protocolImportFailedAt, setProtocolImportFailedAt] = useState<number | null>(null);

  const sessionsQuery = useStudyDesignSessions(slug);
  const createSession = useCreateStudyDesignSession();
  const generateIntent = useGenerateStudyIntent();
  const importProtocol = useImportStudyDesignProtocol();
  const updateVersion = useUpdateStudyDesignVersion();
  const acceptVersion = useAcceptStudyDesignVersion();
  const importExistingStudy = useImportExistingStudyDesign();
  const critiqueStudyDesign = useCritiqueStudyDesignVersion();
  const recommendPhenotypes = useRecommendStudyPhenotypes();
  const draftConceptSets = useDraftStudyConceptSets();
  const draftCohorts = useDraftStudyCohorts();
  const verifyConceptSetDraft = useVerifyStudyConceptSetDraft();
  const verifyConceptSetDrafts = useVerifyStudyConceptSetDrafts();
  const verifyCohortDraft = useVerifyStudyCohortDraft();
  const updateConceptSetDraft = useUpdateStudyConceptSetDraft();
  const updateCohortDraft = useUpdateStudyCohortDraft();
  const materializeConceptSetDraft = useMaterializeStudyConceptSetDraft();
  const materializeCohortDraft = useMaterializeStudyCohortDraft();
  const linkCohortDraft = useLinkStudyCohortDraft();
  const runFeasibility = useRunStudyFeasibility();
  const draftAnalysisPlans = useDraftStudyAnalysisPlans();
  const verifyAnalysisPlan = useVerifyStudyAnalysisPlan();
  const materializeAnalysisPlan = useMaterializeStudyAnalysisPlan();
  const lockDesignVersion = useLockStudyDesignVersion();
  const reviewAsset = useReviewStudyDesignAsset();

  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const effectiveSessionId = selectedSessionId ?? sessions[0]?.id ?? null;
  const versionsQuery = useStudyDesignVersions(slug, effectiveSessionId);
  const selectedSession = sessions.find((session) => session.id === effectiveSessionId) ?? null;
  const versions = useMemo(() => versionsQuery.data ?? [], [versionsQuery.data]);
  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? versions[0] ?? null,
    [versions, selectedVersionId],
  );
  const assetsQuery = useStudyDesignAssets(
    slug,
    effectiveSessionId,
    selectedVersion ? { version_id: selectedVersion.id } : undefined,
  );
  const cohortReadinessQuery = useStudyCohortReadiness(slug, effectiveSessionId, selectedVersion?.id ?? null);
  const lockReadinessQuery = useStudyDesignLockReadiness(slug, effectiveSessionId, selectedVersion?.id ?? null);
  const backendGuidanceQuery = useStudyDesignGuidance(slug, effectiveSessionId, selectedVersion?.id ?? null);
  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);
  const compilerGuidance = useMemo(
    () => buildStudyDesignGuidance({
      version: selectedVersion,
      assets,
      cohortReadiness: cohortReadinessQuery.data ?? null,
      lockReadiness: lockReadinessQuery.data ?? null,
      backendGuidance: backendGuidanceQuery.data ?? null,
    }),
    [assets, backendGuidanceQuery.data, cohortReadinessQuery.data, lockReadinessQuery.data, selectedVersion],
  );
  const protocolBusy = protocolImportStartedAt !== null
    && protocolImportCompletedAt === null
    && protocolImportFailedAt === null;
  const protocolImportEndedAt = protocolImportCompletedAt ?? protocolImportFailedAt;
  const protocolElapsedSeconds = useProtocolImportElapsed(
    protocolImportStartedAt,
    protocolBusy ? null : protocolImportEndedAt,
  );
  const protocolImportPhase = getProtocolImportPhase({
    isPending: protocolBusy,
    elapsedSeconds: protocolElapsedSeconds,
    completedAt: protocolImportCompletedAt,
    failedAt: protocolImportFailedAt,
  });
  const intentGenerationGate = !researchQuestion.trim()
    ? "Enter a research question before generating intent."
    : null;

  const ensureSessionPromiseRef = useRef<Promise<number> | null>(null);

  const ensureSession = useCallback(
    async (sourceMode = "natural_language") => {
      if (selectedSession) return selectedSession.id;
      if (ensureSessionPromiseRef.current) return ensureSessionPromiseRef.current;

      const promise = (async () => {
        try {
          const session = await createSession.mutateAsync({
            slug,
            payload: {
              title: t("studies.workbench.sessionTitle"),
              source_mode: sourceMode,
            },
          });
          setSelectedSessionId(session.id);
          return session.id;
        } finally {
          ensureSessionPromiseRef.current = null;
        }
      })();

      ensureSessionPromiseRef.current = promise;
      return promise;
    },
    [createSession, selectedSession, slug, t],
  );

  const handleGenerate = async () => {
    if (!researchQuestion.trim()) return;
    const sessionId = await ensureSession();
    const version = await generateIntent.mutateAsync({
      slug,
      sessionId,
      researchQuestion: researchQuestion.trim(),
    });
    setSelectedVersionId(version.id);
  };

  const handleProtocolUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setProtocolFileName(file.name);
    setProtocolImportStartedAt(Date.now());
    setProtocolImportCompletedAt(null);
    setProtocolImportFailedAt(null);

    try {
      const sessionId = await ensureSession("protocol_upload");
      const result = await importProtocol.mutateAsync({ slug, sessionId, file });
      const version = result.version;
      setSelectedSessionId(sessionId);
      setSelectedVersionId(version.id);
      const importedQuestion = textAt(version.intent_json, "research_question");
      if (importedQuestion !== "") {
        setResearchQuestion(importedQuestion);
      }
      setProtocolImportCompletedAt(Date.now());
    } catch {
      setProtocolImportFailedAt(Date.now());
    }
  };

  const handleSaveReview = (formState: IntentFormState) => {
    if (!selectedSession || !selectedVersion) return;
    const nextSpec = formToSpec(versionSpec(selectedVersion), formState, study);
    updateVersion.mutate({
      slug,
      sessionId: selectedSession.id,
      versionId: selectedVersion.id,
      payload: {
        normalized_spec_json: nextSpec,
        intent_json: {
          ...(selectedVersion.intent_json ?? {}),
          research_question: formState.researchQuestion || textAt(nextSpec, "study.research_question"),
          primary_objective: formState.primaryObjective,
          pico: {
            ...(selectedVersion.intent_json?.pico ?? {}),
            population: formState.population,
            intervention: formState.exposure,
            comparator: formState.comparator,
            outcome: formState.outcome,
            time_at_risk: formState.time,
          },
        },
        status: "review_ready",
      },
    });
  };

  const handleAccept = () => {
    if (!selectedSession || !selectedVersion) return;
    acceptVersion.mutate({
      slug,
      sessionId: selectedSession.id,
      versionId: selectedVersion.id,
    });
  };

  const handleImportExistingStudy = async () => {
    const sessionId = await ensureSession();
    const result = await importExistingStudy.mutateAsync({ slug, sessionId });
    setSelectedVersionId(result.id);
  };

  const handleCritiqueStudyDesign = () => {
    if (!selectedSession || !selectedVersion) return;
    critiqueStudyDesign.mutate({
      slug,
      sessionId: selectedSession.id,
      versionId: selectedVersion.id,
    });
  };

  const handleRecommendPhenotypes = () => {
    if (!selectedSession || !selectedVersion) return;
    recommendPhenotypes.mutate({
      slug,
      sessionId: selectedSession.id,
      versionId: selectedVersion.id,
    });
  };

  const handleReviewAsset = (asset: StudyDesignAsset, decision: "accept" | "reject" | "defer", reviewNotes?: string | null) => {
    if (!selectedSession) return;
    reviewAsset.mutate({
      slug,
      sessionId: selectedSession.id,
      assetId: asset.id,
      decision,
      reviewNotes,
    });
  };

  const handleDraftConceptSets = () => {
    if (!selectedSession || !selectedVersion) return;
    draftConceptSets.mutate({
      slug,
      sessionId: selectedSession.id,
      versionId: selectedVersion.id,
    });
  };

  const handleVerifyConceptSetDraft = (asset: StudyDesignAsset) => {
    if (!selectedSession) return;
    verifyConceptSetDraft.mutate({
      slug,
      sessionId: selectedSession.id,
      assetId: asset.id,
    });
  };

  const handleVerifyConceptSetDrafts = () => {
    if (!selectedSession || !selectedVersion) return;
    verifyConceptSetDrafts.mutate({
      slug,
      sessionId: selectedSession.id,
      versionId: selectedVersion.id,
    });
  };

  const handleUpdateConceptSetDraft = (asset: StudyDesignAsset, concepts: StudyDesignDraftConcept[]) => {
    if (!selectedSession) return;
    updateConceptSetDraft.mutate({
      slug,
      sessionId: selectedSession.id,
      assetId: asset.id,
      payload: conceptDraftPayload(asset, concepts),
    });
  };

  const handleMaterializeConceptSetDraft = (asset: StudyDesignAsset) => {
    if (!selectedSession) return;
    materializeConceptSetDraft.mutate({
      slug,
      sessionId: selectedSession.id,
      assetId: asset.id,
    });
  };

  const handleDraftCohorts = () => {
    if (!selectedSession || !selectedVersion) return;
    draftCohorts.mutate({
      slug,
      sessionId: selectedSession.id,
      versionId: selectedVersion.id,
    });
  };

  const handleVerifyCohortDraft = (asset: StudyDesignAsset) => {
    if (!selectedSession) return;
    verifyCohortDraft.mutate({ slug, sessionId: selectedSession.id, assetId: asset.id });
  };

  const handleUpdateCohortDraft = (asset: StudyDesignAsset, patch: Record<string, unknown>) => {
    if (!selectedSession) return;
    updateCohortDraft.mutate({
      slug,
      sessionId: selectedSession.id,
      assetId: asset.id,
      payload: cohortDraftPayload(asset, patch),
    });
  };

  const handleMaterializeCohortDraft = (asset: StudyDesignAsset) => {
    if (!selectedSession) return;
    materializeCohortDraft.mutate({ slug, sessionId: selectedSession.id, assetId: asset.id });
  };

  const handleLinkCohortDraft = (asset: StudyDesignAsset, role?: string) => {
    if (!selectedSession) return;
    linkCohortDraft.mutate({
      slug,
      sessionId: selectedSession.id,
      assetId: asset.id,
      role: role ?? asset.role ?? String(draftPayloadRecord(asset).role ?? "target"),
    });
  };

  const handleRunFeasibility = (sourceIds: number[], minCellCount: number) => {
    if (!selectedSession || !selectedVersion) return;
    runFeasibility.mutate({
      slug,
      sessionId: selectedSession.id,
      versionId: selectedVersion.id,
      sourceIds,
      minCellCount,
    });
  };

  const handleDraftAnalysisPlans = (analysisTypes?: string[]) => {
    if (!selectedSession || !selectedVersion) return;
    draftAnalysisPlans.mutate({
      slug,
      sessionId: selectedSession.id,
      versionId: selectedVersion.id,
      payload: analysisTypes && analysisTypes.length > 0 ? { analysis_types: analysisTypes } : undefined,
    });
  };

  const handleVerifyAnalysisPlan = (asset: StudyDesignAsset) => {
    if (!selectedSession) return;
    verifyAnalysisPlan.mutate({ slug, sessionId: selectedSession.id, assetId: asset.id });
  };

  const handleMaterializeAnalysisPlan = (asset: StudyDesignAsset) => {
    if (!selectedSession) return;
    materializeAnalysisPlan.mutate({ slug, sessionId: selectedSession.id, assetId: asset.id });
  };

  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);
  const [lockGateMessage, setLockGateMessage] = useState<string | null>(null);
  const [intentReviewDirty, setIntentReviewDirty] = useState(false);

  const handleLockVersionRequest = async () => {
    if (!selectedSession || !selectedVersion) return;
    setLockGateMessage(null);
    // Refetch readiness so we lock against current state, not stale cache.
    const fresh = (await lockReadinessQuery.refetch()).data;
    if (!fresh || fresh.can_lock !== true || fresh.locked === true) {
      setLockGateMessage(fresh?.locked ? t("studies.workbench.messages.alreadyLocked") : t("studies.workbench.messages.lockGateClosed"));
      return;
    }
    setLockConfirmOpen(true);
  };

  // TODO(backend OCC): pass selectedVersion.updated_at as a precondition once
  // the lock endpoint accepts it. The backend currently takes no body.
  const handleConfirmLock = () => {
    if (!selectedSession || !selectedVersion) return;
    const close = () => setLockConfirmOpen(false);
    lockDesignVersion.mutate(
      { slug, sessionId: selectedSession.id, versionId: selectedVersion.id },
      { onSuccess: close, onError: close },
    );
  };

  const confirmDiscardIfDirty = () =>
    !intentReviewDirty || window.confirm(t("studies.workbench.confirmDiscardEdits"));

  const guardedSetSelectedVersion = (id: number) => {
    if (!confirmDiscardIfDirty()) return;
    setSelectedVersionId(id);
    setIntentReviewDirty(false);
  };

  const guardedSelectSession = (id: number) => {
    if (!confirmDiscardIfDirty()) return;
    setSelectedSessionId(id);
    setSelectedVersionId(null);
    setIntentReviewDirty(false);
  };

  // Last dismissed error reference; new errors (different reference) re-surface.
  const [dismissedError, setDismissedError] = useState<unknown>(null);

  const trackedMutations: Array<{ error: unknown; reset: () => void }> = [
    createSession, generateIntent, importProtocol, updateVersion, acceptVersion,
    importExistingStudy, critiqueStudyDesign, recommendPhenotypes, draftConceptSets,
    draftCohorts, verifyConceptSetDraft, verifyConceptSetDrafts, verifyCohortDraft,
    updateConceptSetDraft, updateCohortDraft, materializeConceptSetDraft,
    materializeCohortDraft, linkCohortDraft, runFeasibility, draftAnalysisPlans,
    verifyAnalysisPlan, materializeAnalysisPlan, lockDesignVersion, reviewAsset,
  ];
  const recentErrorMutation = trackedMutations.find(
    (mutation) => mutation.error && mutation.error !== dismissedError,
  );
  const recentMutationError = recentErrorMutation?.error ?? null;

  const dismissMutationError = () => {
    if (!recentErrorMutation) return;
    recentErrorMutation.reset();
    setDismissedError(recentErrorMutation.error);
  };

  return (
    <div className="panel space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-success" />
            <h3
              ref={headingRef}
              tabIndex={-1}
              className="panel-title"
              style={{ fontSize: "var(--text-base)" }}
            >
              {t("studies.workbench.title")}
            </h3>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {t("studies.workbench.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            createSession.mutate(
              { slug, payload: { title: t("studies.workbench.sessionTitle"), source_mode: "natural_language" } },
              { onSuccess: (session) => setSelectedSessionId(session.id) },
            );
          }}
          disabled={createSession.isPending}
          className="btn btn-ghost btn-sm w-full justify-center sm:w-auto sm:shrink-0"
        >
          {createSession.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {t("studies.workbench.newSession")}
        </button>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-raised p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-secondary">
              {t("studies.designer.actions.uploadProtocol")}
            </p>
            <p className="text-xs text-text-ghost">
              {t("studies.designer.protocolImport.phases.analyzing.detail")}
            </p>
          </div>
          <input
            ref={protocolInputRef}
            type="file"
            aria-label="Upload protocol file"
            accept=".doc,.docx,.pdf,.md,.markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown"
            className="sr-only"
            onChange={handleProtocolUpload}
          />
          <button
            type="button"
            onClick={() => protocolInputRef.current?.click()}
            disabled={protocolBusy || createSession.isPending || importProtocol.isPending}
            className="btn btn-primary btn-sm w-full justify-center sm:w-auto sm:shrink-0"
          >
            {protocolBusy || importProtocol.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {t("studies.designer.actions.uploadProtocol")}
          </button>
        </div>
        <ProtocolImportProgress
          phase={protocolImportPhase}
          elapsedSeconds={protocolElapsedSeconds}
          fileName={protocolFileName}
          className="mt-3"
        />
      </div>

      {sessions.length > 0 && (
        <div className="grid gap-3 md:grid-cols-[minmax(0,240px)_1fr]">
          <div className="space-y-2">
            <p className="text-[10px] text-text-ghost uppercase tracking-wider">
              {t("studies.workbench.sessions")}
            </p>
            <div className="space-y-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => guardedSelectSession(session.id)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                    selectedSession?.id === session.id
                      ? "border-success/60 bg-success/10"
                      : "border-border-default bg-surface-raised hover:bg-surface-overlay",
                  )}
                >
                  <p className="text-sm font-medium text-text-secondary">{session.title}</p>
                  <p className="text-xs text-text-ghost">{session.status}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="form-label">{t("studies.workbench.researchQuestion")}</label>
              <textarea
                value={researchQuestion}
                onChange={(event) => setResearchQuestion(event.target.value)}
                rows={3}
                className="form-input form-textarea"
                placeholder={t("studies.workbench.researchQuestionPlaceholder")}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!researchQuestion.trim() || generateIntent.isPending || createSession.isPending}
                  title={intentGenerationGate ?? undefined}
                  className="btn btn-primary btn-sm"
                >
                  {generateIntent.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {t("studies.workbench.generateIntent")}
                </button>
              </div>
              <ActionGateHint message={intentGenerationGate} />
            </div>

            {versions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {versions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => guardedSetSelectedVersion(version.id)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs",
                      selectedVersion?.id === version.id
                        ? "border-success/70 bg-success/10 text-success"
                        : "border-border-default text-text-muted hover:text-text-secondary",
                    )}
                  >
                    v{version.version_number} · {version.status}
                  </button>
                ))}
              </div>
            )}

            {selectedVersion && (
              <>
                <StudyCompilerGuidancePanel guidance={compilerGuidance} />
                <IntentReviewPanel
                  key={selectedVersion.id}
                  version={selectedVersion}
                  initialFormState={specToForm(versionSpec(selectedVersion))}
                  onSave={handleSaveReview}
                  onAccept={handleAccept}
                  isSaving={updateVersion.isPending}
                  isAccepting={acceptVersion.isPending}
                  onDirtyChange={setIntentReviewDirty}
                />
                <BottomUpCompatibilityPanel
                  assets={assets}
                  isImporting={importExistingStudy.isPending}
                  isCritiquing={critiqueStudyDesign.isPending}
                  canCritique={selectedVersion.status !== "locked"}
                  onImport={handleImportExistingStudy}
                  onCritique={handleCritiqueStudyDesign}
                />
                <PhenotypeRecommendationPanel
                  assets={assets}
                  isLoading={assetsQuery.isLoading}
                  isGenerating={recommendPhenotypes.isPending}
                  isReviewing={reviewAsset.isPending}
                  onGenerate={handleRecommendPhenotypes}
                  onReview={handleReviewAsset}
                  canGenerate={selectedVersion.status === "accepted" || selectedVersion.status === "review_ready"}
                />
                <ConceptSetDraftPanel
                  assets={assets}
                  isGenerating={draftConceptSets.isPending}
                  isReviewing={reviewAsset.isPending}
                  isVerifying={verifyConceptSetDraft.isPending || verifyConceptSetDrafts.isPending}
                  isUpdating={updateConceptSetDraft.isPending}
                  isMaterializing={materializeConceptSetDraft.isPending}
                  onGenerate={handleDraftConceptSets}
                  onReview={handleReviewAsset}
                  onVerify={handleVerifyConceptSetDraft}
                  onVerifyAll={handleVerifyConceptSetDrafts}
                  onUpdate={handleUpdateConceptSetDraft}
                  onMaterialize={handleMaterializeConceptSetDraft}
                />
                <CohortDraftPanel
                  assets={assets}
                  readiness={cohortReadinessQuery.data ?? null}
                  isReadinessLoading={cohortReadinessQuery.isLoading}
                  isGenerating={draftCohorts.isPending}
                  isReviewing={reviewAsset.isPending}
                  isVerifying={verifyCohortDraft.isPending}
                  isUpdating={updateCohortDraft.isPending}
                  isMaterializing={materializeCohortDraft.isPending}
                  isLinking={linkCohortDraft.isPending}
                  onGenerate={handleDraftCohorts}
                  onReview={handleReviewAsset}
                  onVerify={handleVerifyCohortDraft}
                  onUpdate={handleUpdateCohortDraft}
                  onMaterialize={handleMaterializeCohortDraft}
                  onLink={handleLinkCohortDraft}
                />
                <FeasibilityDashboard
                  assets={assets}
                  readiness={cohortReadinessQuery.data ?? null}
                  isReadinessLoading={cohortReadinessQuery.isLoading}
                  isRunning={runFeasibility.isPending}
                  onRun={handleRunFeasibility}
                />
                <AnalysisPlanPanel
                  assets={assets}
                  version={selectedVersion}
                  isGenerating={draftAnalysisPlans.isPending}
                  isReviewing={reviewAsset.isPending}
                  isVerifying={verifyAnalysisPlan.isPending}
                  isMaterializing={materializeAnalysisPlan.isPending}
                  onGenerate={handleDraftAnalysisPlans}
                  onReview={handleReviewAsset}
                  onVerify={handleVerifyAnalysisPlan}
                  onMaterialize={handleMaterializeAnalysisPlan}
                />
                <StudyDesignLockPanel
                  readiness={lockReadinessQuery.data ?? null}
                  isLoading={lockReadinessQuery.isLoading}
                  isLocking={lockDesignVersion.isPending}
                  versionStatus={selectedVersion.status}
                  onLock={() => void handleLockVersionRequest()}
                />
                {lockGateMessage && (
                  <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning" role="alert">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>{lockGateMessage}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {sessions.length === 0 && !sessionsQuery.isLoading && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <p className="text-sm text-text-secondary">
            {t("studies.workbench.startSession")}
          </p>
          <div className="mt-3">
            <textarea
              value={researchQuestion}
              onChange={(event) => setResearchQuestion(event.target.value)}
              rows={3}
              className="form-input form-textarea"
              placeholder={t("studies.workbench.emptyQuestionPlaceholder")}
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!researchQuestion.trim() || createSession.isPending || generateIntent.isPending}
              className="btn btn-primary btn-sm mt-3"
            >
              {createSession.isPending || generateIntent.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {t("studies.workbench.createAndGenerate")}
            </button>
          </div>
        </div>
      )}

      {sessionsQuery.isLoading && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 size={14} className="animate-spin" />
          {t("studies.workbench.loadingSessions")}
        </div>
      )}

      {recentMutationError && (
        <div className="rounded-lg border border-critical/40 bg-critical/10 p-3 text-sm text-critical flex items-start gap-3" role="alert">
          <span className="flex-1">{mutationError(recentMutationError)}</span>
          <button type="button" onClick={dismissMutationError} className="btn btn-ghost btn-sm shrink-0">
            {t("studies.workbench.actions.dismiss")}
          </button>
        </div>
      )}

      <Modal
        open={lockConfirmOpen}
        onClose={() => { if (!lockDesignVersion.isPending) setLockConfirmOpen(false); }}
        title={t("studies.workbench.lockConfirm.title")}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" disabled={lockDesignVersion.isPending} onClick={() => setLockConfirmOpen(false)}>
              {t("studies.workbench.actions.cancel")}
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={lockDesignVersion.isPending} onClick={handleConfirmLock}>
              {lockDesignVersion.isPending ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              {t("studies.workbench.lockConfirm.confirm")}
            </button>
          </div>
        }
      >
        <p className="text-sm text-text-primary">{t("studies.workbench.lockConfirm.body", { version: selectedVersion?.version_number ?? "", updatedAt: selectedVersion?.updated_at ?? "" })}</p>
        <p className="mt-2 text-xs text-warning">{t("studies.workbench.lockConfirm.irreversibleWarning")}</p>
      </Modal>
    </div>
  );
}




