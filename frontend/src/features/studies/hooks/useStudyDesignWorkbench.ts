import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { buildStudyDesignGuidance } from "../components/studyDesignGuidance";
import {
  cohortDraftPayload,
  conceptDraftPayload,
  draftPayloadRecord,
  formToSpec,
  isRecord,
  textAt,
  versionSpec,
  type IntentFormState,
} from "../components/workbench/studyDesignWorkbenchHelpers";
import {
  getProtocolImportPhase,
  useProtocolImportElapsed,
} from "../components/protocolImportProgress";
import type {
  Study,
  StudyDesignAsset,
  StudyDesignDraftConcept,
} from "../types/study";
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
} from "./useStudies";

/**
 * Hook owning ALL orchestration state and handlers for StudyDesignWorkbench.
 *
 * Quick task 260428-gu8 — extracted from StudyDesignWorkbench.tsx so the
 * root component can stay below 500 LOC and focus on JSX. The hook returns
 * one stable object containing state, derived values, refs, and handlers
 * the component consumes via destructuring.
 */
export function useStudyDesignWorkbench(study: Study) {
  const { t } = useTranslation("app");
  const slug = study.slug || String(study.id);

  // ---------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------
  const protocolInputRef = useRef<HTMLInputElement | null>(null);
  const ensureSessionPromiseRef = useRef<Promise<number> | null>(null);

  // ---------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [researchQuestion, setResearchQuestion] = useState(
    study.primary_objective || study.description || "",
  );
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [protocolFileName, setProtocolFileName] = useState<string | null>(null);
  const [protocolImportStartedAt, setProtocolImportStartedAt] = useState<number | null>(null);
  const [protocolImportCompletedAt, setProtocolImportCompletedAt] = useState<number | null>(null);
  const [protocolImportFailedAt, setProtocolImportFailedAt] = useState<number | null>(null);
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);
  const [lockGateMessage, setLockGateMessage] = useState<string | null>(null);
  const [intentReviewDirty, setIntentReviewDirty] = useState(false);
  const [dismissedError, setDismissedError] = useState<unknown>(null);

  // ---------------------------------------------------------------------
  // Query + mutation hooks
  // ---------------------------------------------------------------------
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

  // ---------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------
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

  // ---------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------
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

  const handleReviewAsset = (
    asset: StudyDesignAsset,
    decision: "accept" | "reject" | "defer",
    reviewNotes?: string | null,
  ) => {
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

  const handleLockVersionRequest = async () => {
    if (!selectedSession || !selectedVersion) return;
    setLockGateMessage(null);
    // Refetch readiness so we lock against current state, not stale cache.
    const fresh = (await lockReadinessQuery.refetch()).data;
    if (!fresh || fresh.can_lock !== true || fresh.locked === true) {
      setLockGateMessage(
        fresh?.locked
          ? t("studies.workbench.messages.alreadyLocked")
          : t("studies.workbench.messages.lockGateClosed"),
      );
      return;
    }
    setLockConfirmOpen(true);
  };

  const handleConfirmLock = () => {
    if (!selectedSession || !selectedVersion) return;
    const close = () => setLockConfirmOpen(false);
    lockDesignVersion.mutate(
      {
        slug,
        sessionId: selectedSession.id,
        versionId: selectedVersion.id,
        ifUnmodifiedSince: selectedVersion.updated_at ?? null,
      },
      {
        onSuccess: close,
        onError: (error: unknown) => {
          close();
          // Optimistic concurrency control: backend returns 409 when the
          // version was mutated since the user loaded it. Surface a
          // human-readable message via lockGateMessage and refetch
          // readiness so the UI re-evaluates against current state.
          const status =
            isRecord(error) && isRecord(error.response)
              ? (error.response.status as unknown)
              : null;
          if (status === 409) {
            setLockGateMessage(t("studies.workbench.messages.lockConflict"));
            void lockReadinessQuery.refetch();
          }
        },
      },
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

  // ---------------------------------------------------------------------
  // Aggregated mutation error tracking
  // ---------------------------------------------------------------------
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

  // ---------------------------------------------------------------------
  // Public surface — stable shape, no conditional keys.
  // ---------------------------------------------------------------------
  return {
    // identifiers
    slug,
    // state
    researchQuestion,
    setResearchQuestion,
    selectedSessionId,
    setSelectedSessionId,
    selectedVersionId,
    protocolFileName,
    lockConfirmOpen,
    setLockConfirmOpen,
    lockGateMessage,
    setIntentReviewDirty,
    // refs
    protocolInputRef,
    // queries / mutations
    sessionsQuery,
    versionsQuery,
    assetsQuery,
    cohortReadinessQuery,
    lockReadinessQuery,
    createSession,
    generateIntent,
    importProtocol,
    updateVersion,
    acceptVersion,
    importExistingStudy,
    critiqueStudyDesign,
    recommendPhenotypes,
    draftConceptSets,
    draftCohorts,
    verifyConceptSetDraft,
    verifyConceptSetDrafts,
    verifyCohortDraft,
    updateConceptSetDraft,
    updateCohortDraft,
    materializeConceptSetDraft,
    materializeCohortDraft,
    linkCohortDraft,
    runFeasibility,
    draftAnalysisPlans,
    verifyAnalysisPlan,
    materializeAnalysisPlan,
    lockDesignVersion,
    reviewAsset,
    // derived
    sessions,
    versions,
    selectedSession,
    selectedVersion,
    assets,
    compilerGuidance,
    protocolBusy,
    protocolElapsedSeconds,
    protocolImportPhase,
    intentGenerationGate,
    recentMutationError,
    // handlers
    handleGenerate,
    handleProtocolUpload,
    handleSaveReview,
    handleAccept,
    handleImportExistingStudy,
    handleCritiqueStudyDesign,
    handleRecommendPhenotypes,
    handleReviewAsset,
    handleDraftConceptSets,
    handleVerifyConceptSetDraft,
    handleVerifyConceptSetDrafts,
    handleUpdateConceptSetDraft,
    handleMaterializeConceptSetDraft,
    handleDraftCohorts,
    handleVerifyCohortDraft,
    handleUpdateCohortDraft,
    handleMaterializeCohortDraft,
    handleLinkCohortDraft,
    handleRunFeasibility,
    handleDraftAnalysisPlans,
    handleVerifyAnalysisPlan,
    handleMaterializeAnalysisPlan,
    handleLockVersionRequest,
    handleConfirmLock,
    guardedSetSelectedVersion,
    guardedSelectSession,
    dismissMutationError,
  };
}
