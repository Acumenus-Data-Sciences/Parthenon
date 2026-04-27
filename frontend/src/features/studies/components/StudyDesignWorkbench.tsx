import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Brain, CheckCircle2, Loader2, Lock, Plus, Save, Sparkles, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import type { Source } from "@/types/models";
import { StudyDesignLockPanel } from "./StudyDesignLockPanel";
import { ProtocolImportProgress } from "./ProtocolImportProgress";
import {
  getProtocolImportPhase,
  useProtocolImportElapsed,
} from "./protocolImportProgress";
import { buildCompatibilityAssistance, type CompatibilityAssistance, type CompatibilityGroup } from "./studyDesignCompatibilityAssistance";
import { buildStudyDesignGuidance } from "./studyDesignGuidance";
import { buildIntentReviewAssistance, type IntentReviewAssistance, type IntentReviewEvidenceSpan, type IntentReviewSuggestion } from "./studyDesignIntentAssistance";
import { Field } from "./workbench/shared/Field";
import { VerificationBadge } from "./workbench/shared/VerificationBadge";
import { EvidenceMetric } from "./workbench/shared/EvidenceMetric";
import { ActionGateHint } from "./workbench/shared/ActionGateHint";
import { StudyCompilerGuidancePanel } from "./workbench/StudyCompilerGuidancePanel";
import { PhenotypeRecommendationPanel } from "./workbench/PhenotypeRecommendationPanel";
import { ConceptSetDraftPanel } from "./workbench/ConceptSetDraftPanel";
import { CohortDraftPanel } from "./workbench/CohortDraftPanel";
import {
  analysisDetailPath,
  analysisPlanIssues,
  analysisPlanParameterRows,
  arrayValue,
  cohortDraftPayload,
  conceptDraftPayload,
  draftPayloadRecord,
  feasibilityIssueGuidance,
  feasibilityPreviousRun,
  formatAnalysisParameterValue,
  formatSigned,
  formToSpec,
  isRecord,
  issueAction,
  issueMessage,
  mutationError,
  normalizeCohortRole,
  specToForm,
  summaryAt,
  textAt,
  versionSpec,
  type IntentFormState,
} from "./workbench/studyDesignWorkbenchHelpers";
import type { Study, StudyAnalysisPlanDraft, StudyCohortReadiness, StudyDesignAsset, StudyDesignDraftConcept, StudyDesignVersion, StudyFeasibilityResult } from "../types/study";
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
}

type StudyFeasibilitySource = NonNullable<StudyFeasibilityResult["sources"]>[number];
type StudyFeasibilityCohort = NonNullable<StudyFeasibilitySource["cohorts"]>[number];
type StudyFeasibilityAttritionStep = NonNullable<StudyFeasibilityCohort["attrition"]>[number];

export function StudyDesignWorkbench({ study }: StudyDesignWorkbenchProps) {
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
            <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
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

function FeasibilityDashboard({
  assets,
  readiness,
  isReadinessLoading,
  isRunning,
  onRun,
}: {
  assets: StudyDesignAsset[];
  readiness: StudyCohortReadiness | null;
  isReadinessLoading: boolean;
  isRunning: boolean;
  onRun: (sourceIds: number[], minCellCount: number) => void;
}) {
  const { t } = useTranslation("app");
  const { data: sources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });
  const [selectedSourceIds, setSelectedSourceIds] = useState<number[] | null>(null);
  const [minCellCount, setMinCellCount] = useState(5);
  const [minCellEdited, setMinCellEdited] = useState(false);
  const defaultSource = sources.find((source) => source.is_default) ?? sources[0] ?? null;
  const defaultSourceIds = defaultSource ? [defaultSource.id] : [];
  const cdmResultsSourceIds = sources
    .filter((source) => {
      const daimons = Array.isArray(source.daimons) ? source.daimons : [];
      const daimonTypes = daimons.map((daimon) => daimon.daimon_type);
      return daimonTypes.includes("cdm") && daimonTypes.includes("results");
    })
    .map((source) => source.id);
  const selectedIds = selectedSourceIds ?? defaultSourceIds;
  const feasibilityAssets = assets
    .filter((asset) => asset.asset_type === "feasibility_result")
    .sort((left, right) => right.id - left.id);
  const feasibilityAsset = feasibilityAssets[0];
  const previousFeasibilityAsset = feasibilityAssets[1];
  const feasibility = isRecord(feasibilityAsset?.draft_payload_json)
    ? feasibilityAsset.draft_payload_json as unknown as StudyFeasibilityResult
    : undefined;
  const previousFeasibility = isRecord(previousFeasibilityAsset?.draft_payload_json)
    ? previousFeasibilityAsset.draft_payload_json as unknown as StudyFeasibilityResult
    : undefined;
  const activeMinCellCount = minCellEdited
    ? minCellCount
    : typeof feasibility?.min_cell_count === "number" ? feasibility.min_cell_count : minCellCount;
  const feasibilitySources = arrayValue<StudyFeasibilitySource>(feasibility?.sources);
  const feasibilityBlockers = arrayValue(feasibility?.blockers);
  const feasibilityWarnings = arrayValue(feasibility?.warnings);
  const feasibilityIssueRows = [
    ...feasibilityBlockers.map((issue) => ({ issue, tone: "critical" as const })),
    ...feasibilityWarnings.map((issue) => ({ issue, tone: "warning" as const })),
  ];
  const previousRun = feasibilityPreviousRun(feasibility, previousFeasibility);
  const cohortsReady = readiness?.ready_for_feasibility === true || readiness?.ready === true;
  const canRun = selectedIds.length > 0 && cohortsReady;
  const runGate = isReadinessLoading
    ? "Checking cohort readiness before feasibility."
    : readiness == null
      ? "Cohort readiness must be available before feasibility."
      : !cohortsReady
        ? t("studies.workbench.messages.linkRequiredCohorts")
        : selectedIds.length === 0
          ? "Select at least one source before running feasibility."
          : null;
  const attritionSources = feasibilitySources.filter((source) =>
    arrayValue<StudyFeasibilityCohort>(source.cohorts).some((cohort) => arrayValue<StudyFeasibilityAttritionStep>(cohort.attrition).length > 0),
  );

  const toggleSource = (source: Source) => {
    setSelectedSourceIds((current) => {
      const active = current ?? defaultSourceIds;
      return active.includes(source.id)
        ? active.filter((id) => id !== source.id)
        : [...active, source.id];
    });
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">
            {t("studies.workbench.sections.feasibility")}
          </p>
          <p className="text-xs text-text-ghost">
            {t("studies.workbench.descriptions.feasibility")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRun(selectedIds, activeMinCellCount)}
          disabled={!canRun || isRunning}
          title={runGate ?? undefined}
          className="btn btn-primary btn-sm shrink-0"
        >
          {isRunning ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {t("studies.workbench.actions.runFeasibility")}
        </button>
      </div>

      <ActionGateHint message={runGate} tone={!cohortsReady ? "warning" : "neutral"} />

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-ghost">
            {t("studies.workbench.sections.sources")}
          </p>
          {sourcesLoading ? (
            <p className="text-xs text-text-muted">{t("studies.workbench.messages.loadingSources")}</p>
          ) : sources.length === 0 ? (
            <p className="text-xs text-text-muted">{t("studies.workbench.messages.noSources")}</p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => setSelectedSourceIds(sources.map((source) => source.id))} className="btn btn-ghost btn-sm">
                  All
                </button>
                <button type="button" onClick={() => setSelectedSourceIds(defaultSourceIds)} disabled={defaultSourceIds.length === 0} className="btn btn-ghost btn-sm">
                  Default
                </button>
                <button type="button" onClick={() => setSelectedSourceIds(cdmResultsSourceIds)} disabled={cdmResultsSourceIds.length === 0} className="btn btn-ghost btn-sm">
                  CDM + results
                </button>
                <button type="button" onClick={() => setSelectedSourceIds([])} className="btn btn-ghost btn-sm">
                  Clear
                </button>
                <span className="self-center text-[11px] text-text-ghost">
                  {selectedIds.length}/{sources.length} selected
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sources.map((source) => {
                  const active = selectedIds.includes(source.id);
                  return (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => toggleSource(source)}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-xs",
                      active
                        ? "border-success bg-success/10 text-success"
                        : "border-border-default text-text-muted hover:text-text-secondary",
                    )}
                  >
                    {source.source_name}
                  </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <label className="text-xs text-text-muted">
          {t("studies.workbench.messages.smallCellThreshold")}
          <input
            type="number"
            min={1}
            max={100}
            value={activeMinCellCount}
            onChange={(event) => {
              setMinCellEdited(true);
              setMinCellCount(Number(event.target.value) || 5);
            }}
            className="form-input mt-1 w-24"
          />
        </label>
      </div>

      {feasibility ? (
        <div className="border-t border-border-default pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-text-secondary">
                {t("studies.workbench.messages.sourcesReady", {
                  ready: feasibility.ready_source_count,
                  total: feasibility.source_count,
                })}
              </p>
              <p className="text-[11px] text-text-ghost">
                {t("studies.workbench.messages.ranAt", {
                  time: new Date(feasibility.ran_at).toLocaleString(),
                })}
              </p>
              {previousRun && (
                <p className="text-[11px] text-text-ghost">
                  Previous run: {previousRun.ready_source_count}/{previousRun.source_count} ready
                  {typeof previousRun.delta_ready_source_count === "number"
                    ? ` · ready source delta ${formatSigned(previousRun.delta_ready_source_count)}`
                    : ""}
                  {previousRun.threshold_changed
                    ? ` · threshold changed from ${previousRun.min_cell_count} to ${feasibility.min_cell_count}`
                    : ""}
                </p>
              )}
            </div>
            <span
              className={cn(
                "rounded-md px-2 py-1 text-[10px] uppercase tracking-wider",
                feasibility.status === "ready" && "bg-success/10 text-success",
                feasibility.status === "limited" && "bg-warning/10 text-warning",
                feasibility.status === "blocked" && "bg-critical/10 text-critical",
              )}
            >
              {feasibility.status}
            </span>
          </div>
          {feasibilityIssueRows.length > 0 && (
            <div className="mt-3 space-y-2">
              {feasibilityIssueRows.map(({ issue, tone }, index) => {
                const message = issueMessage(issue);
                if (!message) return null;
                const action = issueAction(issue);

                return (
                  <div
                    key={`${tone}-${index}-${message}`}
                    className="rounded-md border border-border-default bg-surface-base px-2 py-2"
                  >
                    <p className={cn("text-xs", tone === "critical" ? "text-critical" : "text-warning")}>
                      {message}
                    </p>
                    <p className="mt-1 text-[11px] text-text-muted">
                      Abby source gate: {feasibilityIssueGuidance(issue)}
                    </p>
                    {action?.label && (
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-text-ghost">
                        Action target: {action.label}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-text-ghost">
                <tr>
                  <th className="py-1 pr-3 font-medium">{t("studies.workbench.labels.source")}</th>
                  <th className="py-1 pr-3 font-medium">{t("studies.workbench.labels.status")}</th>
                  <th className="py-1 pr-3 font-medium">{t("studies.workbench.labels.cohorts")}</th>
                  <th className="py-1 pr-3 font-medium">{t("studies.workbench.labels.coverage")}</th>
                  <th className="py-1 pr-3 font-medium">{t("studies.workbench.labels.domains")}</th>
                  <th className="py-1 pr-3 font-medium">{t("studies.workbench.labels.freshness")}</th>
                  <th className="py-1 pr-3 font-medium">{t("studies.workbench.labels.dqd")}</th>
                </tr>
              </thead>
              <tbody>
                {feasibilitySources.map((source) => {
                  const sourceCohorts = arrayValue<StudyFeasibilityCohort>(source.cohorts);
                  const dateCoverage = source.coverage?.date_coverage;
                  const observationPeriod = source.coverage?.observation_period;
                  const freshness = source.coverage?.freshness;
                  const dqdPassRate = source.source_quality?.dqd?.pass_rate;
                  const sourceIssues = [
                    ...arrayValue(source.blockers).map((issue) => ({ issue, tone: "critical" as const })),
                    ...arrayValue(source.warnings).map((issue) => ({ issue, tone: "warning" as const })),
                  ];

                  return (
                    <tr key={source.source_id ?? source.source_name} className="border-t border-border-default">
                      <td className="py-2 pr-3 text-text-secondary">
                        <span className="block">{source.source_name}</span>
                        {sourceIssues.slice(0, 2).map(({ issue, tone }, issueIndex) => {
                          const message = issueMessage(issue);
                          if (!message) return null;

                          return (
                            <span
                              key={`${source.source_id ?? source.source_name}-${issueIndex}-${message}`}
                              className={cn("mt-1 block text-[10px]", tone === "critical" ? "text-critical" : "text-warning")}
                            >
                              {message}
                            </span>
                          );
                        })}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={source.ready_for_analysis ? "text-success" : "text-warning"}>
                          {source.ready_for_analysis ? t("studies.workbench.messages.ready") : t("studies.workbench.actions.review")}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-text-muted">
                        {sourceCohorts.map((cohort, index) => (
                          <span key={cohort.study_cohort_id ?? `${source.source_id ?? source.source_name}-${cohort.role ?? index}`} className="mr-2 inline-block">
                            {cohort.role}: {cohort.person_count_suppressed ? `<${feasibility.min_cell_count}` : cohort.person_count ?? t("studies.workbench.messages.none")}
                          </span>
                        ))}
                      </td>
                      <td className="py-2 pr-3 text-text-muted">
                        <span className="block">
                          {dateCoverage?.start_date && dateCoverage?.end_date
                            ? `${dateCoverage.start_date} to ${dateCoverage.end_date}`
                            : t("studies.workbench.messages.noDates")}
                        </span>
                        <span className="block text-[11px] text-text-ghost">
                          OP: {observationPeriod?.record_count ?? t("studies.workbench.messages.none")}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-text-muted">
                        {source.domain_availability
                          ? t("studies.workbench.messages.roles", {
                            ready: source.domain_availability.available_role_count,
                            total: source.domain_availability.role_count,
                          })
                          : t("studies.workbench.messages.unknown")}
                      </td>
                      <td className="py-2 pr-3 text-text-muted">
                        {!freshness || freshness.status === "unknown"
                          ? t("studies.workbench.messages.unknown")
                          : `${freshness.status}${freshness.days_since_release == null ? "" : ` (${freshness.days_since_release}d)`}`}
                      </td>
                      <td className="py-2 pr-3 text-text-muted">
                        {dqdPassRate == null
                          ? t("studies.workbench.messages.noDqd")
                          : t("studies.workbench.messages.passRate", { rate: dqdPassRate })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {attritionSources.length > 0 && (
            <div className="mt-4 border-t border-border-default pt-3">
              <p className="text-xs font-semibold text-text-secondary">{t("studies.workbench.sections.attrition")}</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {attritionSources.map((source) => (
                  <div key={source.source_id ?? source.source_name} className="border-l border-border-default pl-3">
                    <p className="text-xs font-semibold text-text-secondary">{source.source_name}</p>
                    <div className="mt-2 space-y-1">
                      {arrayValue<StudyFeasibilityCohort>(source.cohorts).map((cohort, cohortIndex) => (
                        <div key={cohort.study_cohort_id ?? `${source.source_id ?? source.source_name}-${cohort.role ?? cohortIndex}`} className="text-[11px] text-text-muted">
                          <span className="font-medium text-text-secondary">{cohort.role}</span>
                          {arrayValue<StudyFeasibilityAttritionStep>(cohort.attrition).map((step, stepIndex) => (
                            <span key={`${cohort.study_cohort_id ?? cohort.role ?? cohortIndex}-${step.name ?? stepIndex}`} className="ml-2 inline-block">
                              {step.name}: {step.person_count_suppressed ? `<${feasibility.min_cell_count}` : step.person_count ?? t("studies.workbench.messages.none")}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="border-t border-border-default pt-3 text-xs text-text-ghost">
          {t("studies.workbench.messages.noFeasibilityEvidence")}
        </p>
      )}
    </div>
  );
}

function AnalysisPlanPanel({
  assets,
  version,
  isGenerating,
  isReviewing,
  isVerifying,
  isMaterializing,
  onGenerate,
  onReview,
  onVerify,
  onMaterialize,
}: {
  assets: StudyDesignAsset[];
  version: StudyDesignVersion;
  isGenerating: boolean;
  isReviewing: boolean;
  isVerifying: boolean;
  isMaterializing: boolean;
  onGenerate: (analysisTypes?: string[]) => void;
  onReview: (asset: StudyDesignAsset, decision: "accept" | "reject" | "defer") => void;
  onVerify: (asset: StudyDesignAsset) => void;
  onMaterialize: (asset: StudyDesignAsset) => void;
}) {
  const { t } = useTranslation("app");
  const plans = assets
    .filter((asset) => asset.asset_type === "analysis_plan")
    .sort((left, right) => (right.rank_score ?? -1) - (left.rank_score ?? -1) || right.id - left.id);
  const latestFeasibility = assets
    .filter((asset) => asset.asset_type === "feasibility_result")
    .sort((left, right) => right.id - left.id)[0];
  const latestFeasibilityPayload = isRecord(latestFeasibility?.draft_payload_json)
    ? latestFeasibility?.draft_payload_json as unknown as StudyFeasibilityResult
    : null;
  const familyOptions = useMemo(() => analysisFamilyOptions(version, assets, latestFeasibilityPayload), [version, assets, latestFeasibilityPayload]);
  const recommendedFamilyIds = familyOptions.filter((family) => family.recommended).map((family) => family.id);
  const defaultFamilyIds = recommendedFamilyIds.length > 0 ? recommendedFamilyIds : familyOptions.slice(0, 1).map((family) => family.id);
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<string[] | null>(null);
  const activeFamilyIds = selectedFamilyIds ?? defaultFamilyIds;
  const canGenerate = latestFeasibility != null && activeFamilyIds.length > 0;
  const draftPlansGate = latestFeasibility == null
    ? t("studies.workbench.messages.runFeasibilityBeforePlans")
    : activeFamilyIds.length === 0
      ? "Select at least one analysis family before drafting plans."
      : null;

  const toggleFamily = (familyId: string) => {
    setSelectedFamilyIds((current) =>
      (current ?? defaultFamilyIds).includes(familyId)
        ? (current ?? defaultFamilyIds).filter((id) => id !== familyId)
        : [...(current ?? defaultFamilyIds), familyId],
    );
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">
            {t("studies.workbench.sections.analysisPlans")}
          </p>
          <p className="text-xs text-text-ghost">
            {t("studies.workbench.descriptions.analysisPlans")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onGenerate(activeFamilyIds)}
          disabled={!canGenerate || isGenerating}
          title={draftPlansGate ?? undefined}
          className="btn btn-primary btn-sm shrink-0"
        >
          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Draft Selected Plans
        </button>
      </div>

      <ActionGateHint message={draftPlansGate} />

      {latestFeasibility && (
        <div className="rounded-md border border-border-default bg-surface-base p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-text-secondary">Analysis family selection</p>
            <span className="text-[11px] text-text-ghost">
              {activeFamilyIds.length}/{familyOptions.length} selected
            </span>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {familyOptions.map((family) => {
              const selected = activeFamilyIds.includes(family.id);

              return (
                <button
                  key={family.id}
                  type="button"
                  onClick={() => toggleFamily(family.id)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left",
                    selected
                      ? "border-success bg-success/10 text-text-primary"
                      : "border-border-default bg-surface-raised text-text-muted hover:text-text-secondary",
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span>
                      <span className="block text-xs font-semibold">{family.label}</span>
                      <span className="mt-0.5 block text-[11px] text-text-ghost">{family.package}</span>
                    </span>
                    {family.recommended && (
                      <span className="rounded-md bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                        Recommended
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-[11px] text-text-muted">{family.reason}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="rounded-md border border-border-default bg-surface-base p-3 text-sm text-text-muted">
          {t("studies.workbench.messages.noAnalysisPlans")}
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map((asset) => {
            const payload = draftPayloadRecord(asset) as Partial<StudyAnalysisPlanDraft>;
            const blockers = analysisPlanIssues(payload.blockers, asset.verification_json?.blocking_reasons);
            const warnings = analysisPlanIssues(payload.warnings, asset.verification_json?.warnings);
            const parameterRows = analysisPlanParameterRows(payload);
            const verified = asset.verification_status === "verified";
            const accepted = asset.status === "accepted";
            const rejected = asset.status === "rejected";
            const materialized = asset.status === "materialized" && asset.materialized_id != null;
            const analysisPath = analysisDetailPath(payload.analysis_type, asset.materialized_id);
            const analysisType = typeof payload.analysis_type === "string" ? payload.analysis_type : undefined;
            const familyLabel = payload.analysis_family?.label ?? analysisFamilyLabel(payload.analysis_type) ?? payload.analysis_type ?? "analysis";

            return (
              <div key={asset.id} className="rounded-lg border border-border-default bg-surface-base px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-success/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success">
                        {payload.analysis_type ?? "analysis"}
                      </span>
                      <VerificationBadge status={asset.verification_status} />
                      <span className="text-[10px] text-text-muted">{asset.status}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-text-secondary">
                      {payload.title ?? `${familyLabel} plan #${asset.id}`}
                    </p>
                    {payload.description && (
                      <p className="mt-1 text-xs text-text-muted line-clamp-2">{payload.description}</p>
                    )}
                    {payload.analysis_family?.reason && (
                      <p className="mt-1 text-xs text-text-muted">
                        Abby plan fit: {payload.analysis_family.reason}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-ghost">
                      <span>{payload.hades_package ?? "HADES"}</span>
                      <span>{payload.hades_capability?.installed ? "installed" : "missing"}</span>
                      <span>{t("studies.workbench.messages.feasibilityStatus", {
                        status: payload.feasibility?.status ?? t("studies.workbench.messages.unknown"),
                      })}</span>
                      {materialized && analysisPath && (
                        <a href={analysisPath} className="text-success hover:text-success-light">
                          {t("studies.workbench.labels.nativeAnalysis", { id: asset.materialized_id })}
                        </a>
                      )}
                      {materialized && !analysisPath && <span>{t("studies.workbench.labels.nativeAnalysis", { id: asset.materialized_id })}</span>}
                    </div>
                    {payload.hades_remediation?.message && (
                      <p className="mt-2 text-xs text-warning">{payload.hades_remediation.message}</p>
                    )}
                    {blockers[0] && <p className="mt-2 text-xs text-critical">{blockers[0].message}</p>}
                    {!blockers[0] && warnings[0] && <p className="mt-2 text-xs text-warning">{warnings[0].message}</p>}
                    {blockers[0]?.action?.label && (
                      <p className="mt-1 text-[10px] uppercase tracking-wider text-text-ghost">
                        Action target: {blockers[0].action.label}
                      </p>
                    )}
                    {parameterRows.length > 0 && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {parameterRows.slice(0, 6).map((row) => (
                          <div key={row.name ?? row.label} className="rounded-md border border-border-default bg-surface-raised px-2 py-2">
                            <p className="text-[10px] uppercase tracking-wider text-text-ghost">{row.label}</p>
                            <p className="mt-1 text-xs text-text-secondary">{formatAnalysisParameterValue(row.value)}</p>
                            {row.message && <p className="mt-1 text-[11px] text-text-muted">{row.message}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {!materialized && !accepted && (
                      <button
                        type="button"
                        onClick={() => onVerify(asset)}
                        disabled={isVerifying}
                        className="btn btn-ghost btn-sm"
                      >
                        {asset.verification_status === "unverified" ? t("studies.workbench.actions.verify") : "Re-verify"}
                      </button>
                    )}
                    {!materialized && asset.status === "needs_review" && (
                      <>
                        <button
                          type="button"
                          onClick={() => onReview(asset, "accept")}
                          disabled={isReviewing || !verified}
                          className="btn btn-primary btn-sm"
                        >
                          {t("studies.workbench.actions.accept")}
                        </button>
                        <button
                          type="button"
                          onClick={() => onReview(asset, "defer")}
                          disabled={isReviewing}
                          className="btn btn-ghost btn-sm"
                        >
                          {t("studies.workbench.actions.defer")}
                        </button>
                        <button
                          type="button"
                          onClick={() => onReview(asset, "reject")}
                          disabled={isReviewing}
                          className="btn btn-ghost btn-sm"
                        >
                          {t("studies.workbench.actions.reject")}
                        </button>
                      </>
                    )}
                    {!materialized && !accepted && analysisType && (asset.verification_status === "blocked" || rejected) && (
                      <button
                        type="button"
                        onClick={() => onGenerate([analysisType])}
                        disabled={isGenerating}
                        className="btn btn-ghost btn-sm"
                      >
                        Re-draft family
                      </button>
                    )}
                    {!materialized && accepted && (
                      <button
                        type="button"
                        onClick={() => onMaterialize(asset)}
                        disabled={isMaterializing}
                        className="btn btn-primary btn-sm"
                      >
                        {t("studies.workbench.actions.materialize")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BottomUpCompatibilityPanel({
  assets,
  isImporting,
  isCritiquing,
  canCritique,
  onImport,
  onCritique,
}: {
  assets: StudyDesignAsset[];
  isImporting: boolean;
  isCritiquing: boolean;
  canCritique: boolean;
  onImport: () => void;
  onCritique: () => void;
}) {
  const { t } = useTranslation("app");
  const compatibility = useMemo(
    () => buildCompatibilityAssistance(assets),
    [assets],
  );
  const visibleGroups = compatibility.groups.filter(
    (group) => group.status !== "empty" || group.id === "feasibility" || group.id === "package",
  );
  const critiqueGate = !canCritique
    ? "Locked design versions cannot be critiqued. Start a new design session to continue."
    : null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">
            {t("studies.workbench.sections.currentAssets")}
          </p>
          <p className="text-xs text-text-ghost">
            {t("studies.workbench.descriptions.currentAssets")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onImport}
            disabled={isImporting}
            className="btn btn-ghost btn-sm"
          >
            {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {t("studies.workbench.actions.importCurrent")}
          </button>
          <button
            type="button"
            onClick={onCritique}
            disabled={isCritiquing || !canCritique}
            title={critiqueGate ?? undefined}
            className="btn btn-primary btn-sm"
          >
            {isCritiquing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {t("studies.workbench.actions.critique")}
          </button>
        </div>
      </div>

      <ActionGateHint message={critiqueGate} />

      <div className="grid gap-2 sm:grid-cols-3">
        <EvidenceMetric label={t("studies.workbench.labels.imported")} value={compatibility.metrics.imported} tone={compatibility.metrics.imported > 0 ? "success" : "neutral"} />
        <EvidenceMetric label={t("studies.workbench.labels.critiques")} value={compatibility.metrics.critiques} tone={compatibility.metrics.critiques > 0 ? "warning" : "neutral"} />
        <EvidenceMetric label={t("studies.workbench.labels.blocked")} value={compatibility.metrics.blocking} tone={compatibility.metrics.blocking > 0 ? "critical" : "neutral"} />
      </div>

      <CompatibilityOverview compatibility={compatibility} />

      {visibleGroups.length > 0 && (
        <div className="grid gap-3 xl:grid-cols-2">
          {visibleGroups.map((group) => (
            <CompatibilityGroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompatibilityOverview({ compatibility }: { compatibility: CompatibilityAssistance }) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        compatibility.status === "blocked" && "border-critical/40 bg-critical/10",
        compatibility.status === "review" && "border-warning/40 bg-warning/10",
        compatibility.status === "ready" && "border-success/30 bg-success/5",
        compatibility.status === "empty" && "border-border-default bg-surface-base",
      )}
    >
      <div className="flex items-start gap-2">
        {compatibility.status === "blocked"
          ? <AlertTriangle size={15} className="mt-0.5 shrink-0 text-critical" />
          : compatibility.status === "ready"
            ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />
            : <Sparkles size={15} className="mt-0.5 shrink-0 text-warning" />}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-secondary">Abby compatibility tasks</p>
          <p className="mt-1 text-xs text-text-muted">{compatibility.summary}</p>
          <p className="mt-1 text-[11px] text-text-ghost">{compatibility.policy}</p>
        </div>
      </div>
    </div>
  );
}

function CompatibilityGroupCard({ group }: { group: CompatibilityGroup }) {
  const hasContent = group.importedAssets.length > 0 || group.tasks.length > 0;

  return (
    <div className="rounded-md border border-border-default bg-surface-base px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-secondary">{group.label}</p>
            <CompatibilityStatusBadge status={group.status} />
          </div>
          <p className="mt-1 text-xs text-text-muted">{group.nextAction}</p>
        </div>
        <div className="shrink-0 text-right text-[10px] uppercase tracking-wider text-text-ghost">
          <div>{group.importedAssets.length} imported</div>
          <div>{group.tasks.length} tasks</div>
        </div>
      </div>

      {!hasContent && (
        <p className="mt-3 text-xs text-text-ghost">No imported assets or critique tasks in this stage yet.</p>
      )}

      {group.tasks.length > 0 && (
        <div className="mt-3 space-y-2">
          {group.tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "rounded-md border px-3 py-2",
                task.severity === "blocking"
                  ? "border-critical/40 bg-critical/10"
                  : "border-warning/40 bg-warning/10",
              )}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={14}
                  className={cn(
                    "mt-0.5 shrink-0",
                    task.severity === "blocking" ? "text-critical" : "text-warning",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-secondary">{task.actionLabel}</p>
                  <p className="mt-1 text-xs text-text-muted">{task.message}</p>
                  <p className="mt-1 text-[11px] text-text-ghost">{task.actionTarget}</p>
                  {task.nativeLink && (
                    <a href={task.nativeLink} className="mt-2 inline-flex text-xs text-accent hover:text-accent-hover">
                      Open native record
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {group.importedAssets.length > 0 && (
        <div className="mt-3 divide-y divide-border-default overflow-hidden rounded-md border border-border-default">
          {group.importedAssets.slice(0, 4).map((asset) => (
            <div key={asset.id} className="flex flex-col gap-2 bg-surface-raised px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-xs font-medium text-text-secondary">{asset.label}</p>
                  {asset.role && <span className="text-[10px] text-text-ghost">{asset.role}</span>}
                  <VerificationBadge status={asset.verificationStatus} />
                </div>
                {asset.detail && <p className="mt-1 line-clamp-1 text-[11px] text-text-muted">{asset.detail}</p>}
                {asset.blocker && <p className="mt-1 text-[11px] text-critical">{asset.blocker}</p>}
                {!asset.blocker && asset.warning && <p className="mt-1 text-[11px] text-warning">{asset.warning}</p>}
              </div>
              {asset.nativeLink && asset.nativeLabel && (
                <a href={asset.nativeLink} className="btn btn-ghost btn-sm shrink-0">
                  {asset.nativeLabel}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CompatibilityStatusBadge({ status }: { status: CompatibilityGroup["status"] }) {
  const label = status === "blocked"
    ? "Blocked"
    : status === "review"
      ? "Review"
      : status === "ready"
        ? "Ready"
        : "Empty";

  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
        status === "blocked" && "border-critical/40 text-critical",
        status === "review" && "border-warning/50 text-warning",
        status === "ready" && "border-success/40 text-success",
        status === "empty" && "border-border-default text-text-ghost",
      )}
    >
      {label}
    </span>
  );
}


const ANALYSIS_FAMILIES = [
  {
    id: "characterization",
    label: "Baseline Characterization",
    package: "Characterization",
    requiredRoles: ["target"],
    reason: "Useful before inferential analysis and requires only a target cohort.",
  },
  {
    id: "estimation",
    label: "Population-Level Estimation",
    package: "CohortMethod",
    requiredRoles: ["target", "comparator", "outcome"],
    reason: "Best fit when target, comparator, and outcome cohorts support comparative effect estimation.",
  },
  {
    id: "prediction",
    label: "Patient-Level Prediction",
    package: "PatientLevelPrediction",
    requiredRoles: ["target", "outcome"],
    reason: "Best fit when the intent asks for outcome risk prediction.",
  },
  {
    id: "incidence_rate",
    label: "Incidence Rate",
    package: "CohortIncidence",
    requiredRoles: ["target"],
    reason: "Best fit for incidence or prevalence questions.",
  },
  {
    id: "pathway",
    label: "Treatment Pathways",
    package: "TreatmentPatterns",
    requiredRoles: ["target", "comparator"],
    reason: "Best fit for treatment sequence, switching, or pathway questions.",
  },
  {
    id: "sccs",
    label: "Self-Controlled Case Series",
    package: "SelfControlledCaseSeries",
    requiredRoles: ["target", "outcome"],
    reason: "Best fit for acute exposure-outcome safety questions.",
  },
  {
    id: "self_controlled_cohort",
    label: "Self-Controlled Cohort",
    package: "SelfControlledCohort",
    requiredRoles: ["target", "outcome"],
    reason: "Best fit for self-controlled cohort risk-window designs.",
  },
  {
    id: "evidence_synthesis",
    label: "Evidence Synthesis",
    package: "EvidenceSynthesis",
    requiredRoles: ["target"],
    reason: "Best fit after multiple sources produce analysis-ready evidence.",
  },
];

function analysisFamilyOptions(version: StudyDesignVersion, assets: StudyDesignAsset[], feasibility: StudyFeasibilityResult | null) {
  const spec = version.normalized_spec_json ?? version.spec_json ?? {};
  const studyText = [
    summaryAt(spec, "study.study_type"),
    summaryAt(spec, "study.study_design"),
    summaryAt(spec, "study.research_question"),
    summaryAt(spec, "study.primary_objective"),
    summaryAt(spec, "pico.comparator"),
    summaryAt(spec, "pico.outcomes.0"),
  ].join(" ").toLowerCase();
  const roles = new Set(
    assets
      .filter((asset) => asset.asset_type === "cohort_draft" && asset.status === "materialized")
      .map((asset) => normalizeCohortRole(String(asset.role ?? asset.draft_payload_json?.role ?? ""))),
  );
  const readySourceCount = feasibility?.ready_source_count ?? 0;

  return ANALYSIS_FAMILIES.map((family) => {
    const hasRoles = family.requiredRoles.every((role) => roles.has(role));
    const recommended = family.id === "characterization"
      || (family.id === "estimation" && (hasRoles || studyText.includes("comparative") || studyText.includes("effect")))
      || (family.id === "prediction" && hasRoles && (studyText.includes("prediction") || studyText.includes("risk")))
      || (family.id === "incidence_rate" && (studyText.includes("incidence") || studyText.includes("prevalence")))
      || (family.id === "pathway" && (hasRoles || studyText.includes("pathway") || studyText.includes("sequence")))
      || (family.id === "sccs" && hasRoles && (studyText.includes("safety") || studyText.includes("acute") || studyText.includes("self")))
      || (family.id === "self_controlled_cohort" && hasRoles && studyText.includes("self"))
      || (family.id === "evidence_synthesis" && readySourceCount > 1);

    return {
      ...family,
      recommended,
      reason: recommended ? family.reason : `Available when ${family.requiredRoles.join(", ")} role evidence supports this family.`,
    };
  });
}

function analysisFamilyLabel(type: string | undefined): string | null {
  return ANALYSIS_FAMILIES.find((family) => family.id === type)?.label ?? null;
}

function IntentReviewPanel({
  version,
  initialFormState,
  onSave,
  onAccept,
  isSaving,
  isAccepting,
  onDirtyChange,
}: {
  version: StudyDesignVersion;
  initialFormState: IntentFormState;
  onSave: (state: IntentFormState) => void;
  onAccept: () => void;
  isSaving: boolean;
  isAccepting: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { t } = useTranslation("app");
  const [formState, setFormState] = useState(initialFormState);
  // Baseline re-anchors when version.updated_at increments (after parent's
  // update mutation invalidates+refetches). React docs: "Storing information
  // from previous renders" — track prev prop in state, update during render.
  const [baselineFormState, setBaselineFormState] = useState(initialFormState);
  const [trackedUpdatedAt, setTrackedUpdatedAt] = useState(version.updated_at);
  if (trackedUpdatedAt !== version.updated_at) {
    setTrackedUpdatedAt(version.updated_at);
    if (JSON.stringify(baselineFormState) !== JSON.stringify(formState)) {
      setBaselineFormState(formState);
    }
  }
  const isDirty = useMemo(
    () => JSON.stringify(formState) !== JSON.stringify(baselineFormState),
    [formState, baselineFormState],
  );
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  const lint = version.lint_results_json ?? null;
  const isImmutable = ["accepted", "compiled", "locked"].includes(version.status);
  const lintIssues = lint?.issues ?? [];
  const isReady = lint?.status === "ready" || version.status === "review_ready";
  const saveGate = isImmutable
    ? "Accepted or locked intents cannot be edited in this version."
    : null;
  const acceptGate = isImmutable
    ? "This intent has already been accepted or locked."
    : !isReady
      ? "Resolve Abby Review blockers before accepting intent."
      : null;
  const intentAssistance = useMemo(
    () => buildIntentReviewAssistance(version, formState),
    [formState, version],
  );

  const applySuggestion = (suggestion: IntentReviewSuggestion) => {
    if (isImmutable || !suggestion.draftValue) return;
    setFormState((current) => ({
      ...current,
      [suggestion.fieldKey]: suggestion.draftValue,
    }));
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">
            {t("studies.workbench.sections.intentReview")}
          </p>
          <p className="text-xs text-text-ghost">
            {t("studies.workbench.labels.versionStatus", {
              version: version.version_number,
              status: version.status,
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSave(formState)}
            disabled={isSaving || isImmutable}
            title={saveGate ?? undefined}
            className="btn btn-ghost btn-sm"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {t("studies.workbench.actions.saveReview")}
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={isAccepting || isImmutable || !isReady}
            title={acceptGate ?? undefined}
            className="btn btn-primary btn-sm"
          >
            {isAccepting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {t("studies.workbench.actions.acceptIntent")}
          </button>
        </div>
      </div>

      <ActionGateHint message={acceptGate} />

      <IntentReviewAssistancePanel
        assistance={intentAssistance}
        disabled={isImmutable}
        onApplySuggestion={applySuggestion}
      />

      {lintIssues.length > 0 && (
        <div className="space-y-2">
          {lintIssues.map((issue, index) => (
            <div
              key={`${issue.field ?? "issue"}-${index}`}
              className={cn(
                "flex gap-2 rounded-md border px-3 py-2 text-sm",
                issue.severity === "blocking"
                  ? "border-critical/40 bg-critical/10 text-critical"
                  : "border-warning/40 bg-warning/10 text-warning",
              )}
            >
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label={t("studies.workbench.researchQuestion")} value={formState.researchQuestion} onChange={(value) => setFormState({ ...formState, researchQuestion: value })} />
        </div>
        <Field label={t("studies.workbench.labels.primaryObjective")} value={formState.primaryObjective} onChange={(value) => setFormState({ ...formState, primaryObjective: value })} />
        <Field label={t("studies.workbench.labels.population")} value={formState.population} onChange={(value) => setFormState({ ...formState, population: value })} />
        <Field label={t("studies.workbench.labels.exposure")} value={formState.exposure} onChange={(value) => setFormState({ ...formState, exposure: value })} />
        <Field label={t("studies.workbench.labels.comparator")} value={formState.comparator} onChange={(value) => setFormState({ ...formState, comparator: value })} />
        <Field label={t("studies.workbench.labels.primaryOutcome")} value={formState.outcome} onChange={(value) => setFormState({ ...formState, outcome: value })} />
        <Field label={t("studies.workbench.labels.timeAtRisk")} value={formState.time} onChange={(value) => setFormState({ ...formState, time: value })} />
      </div>
    </div>
  );
}

function IntentReviewAssistancePanel({
  assistance,
  disabled,
  onApplySuggestion,
}: {
  assistance: IntentReviewAssistance;
  disabled: boolean;
  onApplySuggestion: (suggestion: IntentReviewSuggestion) => void;
}) {
  const concerns = [...assistance.missingFields, ...assistance.weakFields];
  const sourceParts = protocolSourceParts(assistance);
  const suggestions = assistance.suggestions.slice(0, 7);
  const evidenceSpans = assistance.evidenceSpans.slice(0, 4);
  const noteGroups = [
    { label: "Open questions", notes: assistance.openQuestions },
    { label: "Risk notes", notes: assistance.riskNotes },
    { label: "Uncertainty", notes: assistance.uncertaintyNotes },
    { label: "Design assumptions", notes: assistance.designAssumptions },
  ].filter((group) => group.notes.length > 0);

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        assistance.status === "ready"
          ? "border-success/30 bg-success/5"
          : "border-warning/40 bg-warning/10",
      )}
    >
      <div className="flex items-start gap-2">
        {assistance.status === "ready"
          ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
          : <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-secondary">Abby Review</p>
            <span className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
              assistance.status === "ready"
                ? "border-success/40 text-success"
                : "border-warning/50 text-warning",
            )}>
              {assistance.status === "ready" ? "Ready" : "Needs review"}
            </span>
          </div>
          <p className="mt-1 text-xs text-text-muted">{assistance.summary}</p>
        </div>
      </div>

      {sourceParts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-muted">
          {sourceParts.map((part) => (
            <span key={part} className="rounded-full border border-border-default bg-surface-base px-2 py-1">
              {part}
            </span>
          ))}
        </div>
      )}

      {concerns.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {concerns.map((concern) => (
            <span
              key={`${concern.fieldKey}-${concern.message}`}
              className="rounded-full border border-warning/50 bg-warning/10 px-2 py-1 text-[11px] font-medium text-warning"
              title={concern.message}
            >
              {concern.fieldLabel}
            </span>
          ))}
        </div>
      )}

      {assistance.protocolSource?.truncated && (
        <p className="mt-3 flex gap-2 text-xs text-warning">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>Protocol text was shortened for evaluation. Verify late-document eligibility, outcomes, and safety sections before accepting.</span>
        </p>
      )}

      {(evidenceSpans.length > 0 || hasConfidence(assistance)) && (
        <IntentReviewEvidenceSummary
          confidence={assistance.confidence}
          evidenceSpans={evidenceSpans}
        />
      )}

      {noteGroups.length > 0 && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {noteGroups.map((group) => (
            <ReviewNoteGroup key={group.label} label={group.label} notes={group.notes} />
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-3 space-y-2">
          {suggestions.map((suggestion) => (
            <div
              key={`${suggestion.fieldKey}-${suggestion.action}`}
              className="rounded-md border border-border-default bg-surface-base px-3 py-2"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-secondary">{suggestion.fieldLabel}</p>
                  <p className="mt-1 text-xs text-text-muted">{suggestion.action}</p>
                  {suggestion.draftValue && (
                    <p className="mt-1 text-[11px] text-text-ghost">{suggestion.draftValue}</p>
                  )}
                </div>
                {suggestion.draftValue && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onApplySuggestion(suggestion)}
                    className="btn btn-ghost btn-sm shrink-0"
                  >
                    <Sparkles size={12} />
                    Use wording
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IntentReviewEvidenceSummary({
  confidence,
  evidenceSpans,
}: {
  confidence: IntentReviewAssistance["confidence"];
  evidenceSpans: IntentReviewEvidenceSpan[];
}) {
  const fieldConfidence = confidence.fields.slice(0, 6);

  return (
    <div className="mt-3 rounded-md border border-border-default bg-surface-base px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-text-secondary">Evidence and confidence</p>
        {confidence.overall !== undefined && (
          <span className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            confidence.overall >= 0.75
              ? "border-success/40 text-success"
              : confidence.overall >= 0.5
                ? "border-warning/50 text-warning"
                : "border-critical/40 text-critical",
          )}>
            Overall {formatConfidence(confidence.overall)}
          </span>
        )}
      </div>

      {fieldConfidence.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {fieldConfidence.map((field) => (
            <span
              key={field.fieldKey}
              className="rounded-full border border-border-default bg-surface-overlay/30 px-2 py-0.5 text-[11px] text-text-muted"
            >
              {field.fieldLabel} {formatConfidence(field.confidence)}
            </span>
          ))}
        </div>
      )}

      {evidenceSpans.length > 0 && (
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {evidenceSpans.map((span, index) => (
            <div
              key={`${span.fieldLabel}-${index}`}
              className="rounded-md border border-border-subtle bg-surface-overlay/30 px-2.5 py-2"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-text-secondary">{span.fieldLabel}</span>
                {span.confidence !== undefined && (
                  <span className="rounded-full border border-border-default px-1.5 py-0.5 text-[10px] text-text-muted">
                    {formatConfidence(span.confidence)}
                  </span>
                )}
                {span.section && (
                  <span className="text-[10px] text-text-ghost">{span.section}</span>
                )}
                {span.page && (
                  <span className="text-[10px] text-text-ghost">p. {span.page}</span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-text-muted">{span.quote}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewNoteGroup({ label, notes }: { label: string; notes: string[] }) {
  return (
    <div className="rounded-md border border-border-default bg-surface-base px-3 py-2">
      <p className="text-xs font-semibold text-text-secondary">{label}</p>
      <ul className="mt-1 space-y-1 text-xs text-text-muted">
        {notes.slice(0, 3).map((note, index) => (
          <li key={`${label}-${index}`}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

function hasConfidence(assistance: IntentReviewAssistance): boolean {
  return assistance.confidence.overall !== undefined || assistance.confidence.fields.length > 0;
}

function formatConfidence(value: number): string {
  const percent = value <= 1 ? value * 100 : value;

  return `${Math.round(Math.max(0, Math.min(100, percent)))}%`;
}

function protocolSourceParts(assistance: IntentReviewAssistance): string[] {
  const source = assistance.protocolSource;
  if (!source) return [];

  return [
    source.filename ? `Protocol: ${source.filename}` : "",
    source.textLength ? `${source.textLength.toLocaleString()} chars reviewed` : "",
  ].filter(Boolean);
}

