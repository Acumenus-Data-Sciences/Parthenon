import { useId, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Brain, CheckCircle2, ChevronDown, ChevronRight, Loader2, Plus, Save, Sparkles, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { searchConcepts } from "@/features/vocabulary/api/vocabularyApi";
import type { Source } from "@/types/models";
import type { Concept } from "@/features/vocabulary/types/vocabulary";
import { StudyDesignLockPanel } from "./StudyDesignLockPanel";
import { ProtocolImportProgress } from "./ProtocolImportProgress";
import {
  getProtocolImportPhase,
  useProtocolImportElapsed,
} from "./protocolImportProgress";
import { buildCompatibilityAssistance, type CompatibilityAssistance, type CompatibilityGroup } from "./studyDesignCompatibilityAssistance";
import { buildStudyDesignGuidance } from "./studyDesignGuidance";
import { buildIntentReviewAssistance, type IntentReviewAssistance, type IntentReviewEvidenceSpan, type IntentReviewSuggestion } from "./studyDesignIntentAssistance";
import type { Study, StudyAnalysisPlanDraft, StudyCohortReadiness, StudyCompilerGuidance, StudyCompilerStageStatus, StudyDesignAsset, StudyDesignDraftConcept, StudyDesignSpec, StudyDesignVersion, StudyFeasibilityResult, StudyReadinessAction } from "../types/study";
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

interface IntentFormState {
  researchQuestion: string;
  primaryObjective: string;
  population: string;
  exposure: string;
  comparator: string;
  outcome: string;
  time: string;
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

  const ensureSession = async (sourceMode = "natural_language") => {
    if (selectedSession) return selectedSession.id;

    const session = await createSession.mutateAsync({
      slug,
      payload: {
        title: t("studies.workbench.sessionTitle"),
        source_mode: sourceMode,
      },
    });
    setSelectedSessionId(session.id);
    return session.id;
  };

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

  const handleLockVersion = () => {
    if (!selectedSession || !selectedVersion) return;
    lockDesignVersion.mutate({
      slug,
      sessionId: selectedSession.id,
      versionId: selectedVersion.id,
    });
  };

  const activeMutationError =
    mutationError(createSession.error) ||
    mutationError(generateIntent.error) ||
    mutationError(importProtocol.error) ||
    mutationError(updateVersion.error) ||
    mutationError(acceptVersion.error) ||
    mutationError(importExistingStudy.error) ||
    mutationError(critiqueStudyDesign.error) ||
    mutationError(recommendPhenotypes.error) ||
    mutationError(draftConceptSets.error) ||
    mutationError(draftCohorts.error) ||
    mutationError(verifyConceptSetDraft.error) ||
    mutationError(verifyConceptSetDrafts.error) ||
    mutationError(verifyCohortDraft.error) ||
    mutationError(updateConceptSetDraft.error) ||
    mutationError(updateCohortDraft.error) ||
    mutationError(materializeConceptSetDraft.error) ||
    mutationError(materializeCohortDraft.error) ||
    mutationError(linkCohortDraft.error) ||
    mutationError(runFeasibility.error) ||
    mutationError(draftAnalysisPlans.error) ||
    mutationError(verifyAnalysisPlan.error) ||
    mutationError(materializeAnalysisPlan.error) ||
    mutationError(lockDesignVersion.error) ||
    mutationError(reviewAsset.error);

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
                  onClick={() => {
                    setSelectedSessionId(session.id);
                    setSelectedVersionId(null);
                  }}
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
                    onClick={() => setSelectedVersionId(version.id)}
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
                  onLock={handleLockVersion}
                />
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

      {activeMutationError && (
        <div className="rounded-lg border border-critical/40 bg-critical/10 p-3 text-sm text-critical">
          {activeMutationError}
        </div>
      )}
    </div>
  );
}

function StudyCompilerGuidancePanel({ guidance }: { guidance: StudyCompilerGuidance }) {
  const blockers = guidance.blockers.slice(0, 3);
  const warnings = guidance.warnings.slice(0, 2);

  return (
    <div className="rounded-lg border border-success/30 bg-success/5 p-4" role="region" aria-label="Abby guidance">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-success" />
            <p className="text-sm font-semibold text-text-secondary">Abby guidance</p>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            {guidance.nextAction.label}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {guidance.nextAction.detail}
          </p>
          {(blockers.length > 0 || warnings.length > 0) && (
            <div className="mt-3 space-y-1">
              {blockers.map((blocker) => (
                <p key={`blocker-${blocker}`} className="flex gap-2 text-xs text-critical">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>{blocker}</span>
                </p>
              ))}
              {warnings.map((warning) => (
                <p key={`warning-${warning}`} className="flex gap-2 text-xs text-warning">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>{warning}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 text-[10px] sm:grid-cols-4 lg:min-w-[360px]">
          <GuidanceMetric label="Accepted" value={guidance.metrics.acceptedRecommendations} />
          <GuidanceMetric label="Concepts" value={guidance.metrics.materializedConceptSets} />
          <GuidanceMetric label="Cohorts" value={guidance.metrics.linkedCohorts} />
          <GuidanceMetric label="Analyses" value={guidance.metrics.materializedAnalyses} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {guidance.stages.map((stage) => (
          <div
            key={stage.id}
            className={cn(
              "rounded-md border px-2 py-2",
              stage.status === "complete" && "border-success/40 bg-success/10",
              stage.status === "active" && "border-info/40 bg-info/10",
              stage.status === "blocked" && "border-critical/40 bg-critical/10",
              stage.status === "pending" && "border-border-default bg-surface-base",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[11px] font-semibold text-text-secondary">{stage.label}</p>
              <GuidanceStatusChip status={stage.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuidanceMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border-default bg-surface-base px-2 py-1.5">
      <p className="text-sm font-semibold text-text-secondary">{value}</p>
      <p className="uppercase tracking-wider text-text-ghost">{label}</p>
    </div>
  );
}

function GuidanceStatusChip({ status }: { status: StudyCompilerStageStatus }) {
  const Icon = status === "complete"
    ? CheckCircle2
    : status === "blocked"
      ? AlertTriangle
      : status === "active"
        ? Sparkles
        : ChevronRight;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
        status === "complete" && "bg-success/10 text-success",
        status === "active" && "bg-info/10 text-info",
        status === "blocked" && "bg-critical/10 text-critical",
        status === "pending" && "bg-surface-overlay text-text-muted",
      )}
    >
      <Icon size={10} />
      {status}
    </span>
  );
}

function PhenotypeRecommendationPanel({
  assets,
  isLoading,
  isGenerating,
  isReviewing,
  onGenerate,
  onReview,
  canGenerate,
}: {
  assets: StudyDesignAsset[];
  isLoading: boolean;
  isGenerating: boolean;
  isReviewing: boolean;
  onGenerate: () => void;
  onReview: (asset: StudyDesignAsset, decision: "accept" | "reject" | "defer", reviewNotes?: string | null) => void;
  canGenerate: boolean;
}) {
  const { t } = useTranslation("app");
  const recommendations = assets.filter((asset) =>
    ["phenotype_recommendation", "local_cohort", "local_concept_set"].includes(asset.asset_type),
  ).sort((left, right) =>
    (right.rank_score ?? -1) - (left.rank_score ?? -1) || right.id - left.id,
  );
  const evidenceCounts = recommendations.reduce(
    (counts, asset) => {
      if (asset.verification_status === "verified") counts.verified += 1;
      else if (asset.verification_status === "blocked") counts.blocked += 1;
      else if (asset.verification_status === "partial") counts.partial += 1;
      else counts.unverified += 1;
      return counts;
    },
    { verified: 0, partial: 0, blocked: 0, unverified: 0 },
  );
  const generateGate = !canGenerate
    ? t("studies.workbench.messages.saveOrAcceptBeforeRecommendations")
    : null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">
            {t("studies.workbench.sections.phenotypeRecommendations")}
          </p>
          <p className="text-xs text-text-ghost">
            {t("studies.workbench.descriptions.recommendations")}
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          title={generateGate ?? undefined}
          className="btn btn-primary btn-sm shrink-0"
        >
          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {t("studies.workbench.actions.recommend")}
        </button>
      </div>

      {recommendations.length > 0 && (
        <div className="grid gap-2 text-xs sm:grid-cols-4">
          <EvidenceMetric label={t("studies.workbench.labels.verified")} value={evidenceCounts.verified} tone="success" />
          <EvidenceMetric label={t("studies.workbench.labels.needsCheck")} value={evidenceCounts.partial + evidenceCounts.unverified} tone="warning" />
          <EvidenceMetric label={t("studies.workbench.labels.blocked")} value={evidenceCounts.blocked} tone="critical" />
          <EvidenceMetric label={t("studies.workbench.labels.reviewQueue")} value={recommendations.length} tone="neutral" />
        </div>
      )}

      <ActionGateHint message={generateGate} />

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 size={14} className="animate-spin" />
          {t("studies.workbench.messages.loadingRecommendations")}
        </div>
      )}

      {!isLoading && recommendations.length === 0 && (
        <div className="rounded-md border border-border-default bg-surface-base p-3 text-sm text-text-muted">
          {t("studies.workbench.messages.noRecommendations")}
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="space-y-2">
          {recommendations.map((asset) => (
            <RecommendationCard
              key={asset.id}
              asset={asset}
              isReviewing={isReviewing}
              onReview={onReview}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConceptSetDraftPanel({
  assets,
  isGenerating,
  isReviewing,
  isVerifying,
  isUpdating,
  isMaterializing,
  onGenerate,
  onReview,
  onVerify,
  onVerifyAll,
  onUpdate,
  onMaterialize,
}: {
  assets: StudyDesignAsset[];
  isGenerating: boolean;
  isReviewing: boolean;
  isVerifying: boolean;
  isUpdating: boolean;
  isMaterializing: boolean;
  onGenerate: () => void;
  onReview: (asset: StudyDesignAsset, decision: "accept" | "reject" | "defer") => void;
  onVerify: (asset: StudyDesignAsset) => void;
  onVerifyAll: () => void;
  onUpdate: (asset: StudyDesignAsset, concepts: StudyDesignDraftConcept[]) => void;
  onMaterialize: (asset: StudyDesignAsset) => void;
}) {
  const { t } = useTranslation("app");
  const acceptedInputs = assets.filter((asset) =>
    ["phenotype_recommendation", "local_cohort", "local_concept_set"].includes(asset.asset_type) &&
    asset.status === "accepted",
  );
  const drafts = assets
    .filter((asset) => asset.asset_type === "concept_set_draft")
    .sort((left, right) => right.id - left.id);
  const canGenerate = acceptedInputs.length > 0;
  const verifyAllGate = drafts.length === 0
    ? "Create a concept set draft before batch verification."
    : null;
  const generateGate = !canGenerate
    ? t("studies.workbench.messages.acceptRecommendationFirst")
    : null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">
            {t("studies.workbench.sections.conceptSetDrafts")}
          </p>
          <p className="text-xs text-text-ghost">
            {t("studies.workbench.descriptions.conceptSets")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onVerifyAll}
            disabled={drafts.length === 0 || isVerifying}
            title={verifyAllGate ?? undefined}
            className="btn btn-ghost btn-sm"
          >
            {isVerifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Verify All
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate || isGenerating}
            title={generateGate ?? undefined}
            className="btn btn-primary btn-sm"
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {t("studies.workbench.actions.draftConceptSets")}
          </button>
        </div>
      </div>

      <ActionGateHint message={generateGate} />

      {drafts.length === 0 && (
        <div className="rounded-md border border-border-default bg-surface-base p-3 text-sm text-text-muted">
          {t("studies.workbench.messages.noConceptSetDrafts")}
        </div>
      )}

      {drafts.length > 0 && (
        <div className="space-y-2">
          {drafts.map((asset) => (
            <ConceptSetDraftCard
              key={asset.id}
              asset={asset}
              isReviewing={isReviewing}
              isVerifying={isVerifying}
              isUpdating={isUpdating}
              isMaterializing={isMaterializing}
              onReview={onReview}
              onVerify={onVerify}
              onUpdate={onUpdate}
              onMaterialize={onMaterialize}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConceptSetDraftCard({
  asset,
  isReviewing,
  isVerifying,
  isUpdating,
  isMaterializing,
  onReview,
  onVerify,
  onUpdate,
  onMaterialize,
}: {
  asset: StudyDesignAsset;
  isReviewing: boolean;
  isVerifying: boolean;
  isUpdating: boolean;
  isMaterializing: boolean;
  onReview: (asset: StudyDesignAsset, decision: "accept" | "reject" | "defer") => void;
  onVerify: (asset: StudyDesignAsset) => void;
  onUpdate: (asset: StudyDesignAsset, concepts: StudyDesignDraftConcept[]) => void;
  onMaterialize: (asset: StudyDesignAsset) => void;
}) {
  const { t } = useTranslation("app");
  const [expanded, setExpanded] = useState(asset.verification_status !== "verified");
  const [conceptQuery, setConceptQuery] = useState("");
  const [conceptResults, setConceptResults] = useState<Concept[]>([]);
  const [isSearchingConcepts, setIsSearchingConcepts] = useState(false);
  const payload = draftPayloadRecord(asset);
  const verified = asset.verification_status === "verified";
  const accepted = asset.status === "accepted";
  const materialized = asset.materialized_id != null;
  const verification = recordValue(asset.verification_json);
  const concepts = draftConceptArray(verification?.concepts ?? payload.concepts);
  const blockers = issueMessages(verification?.blocking_reasons);
  const warnings = issueMessages(verification?.warnings);
  const repairSuggestions = arrayValue(verification?.repair_suggestions).filter(isRecord);
  const canEdit = !materialized && asset.status !== "accepted";
  const roleLabel = textValue(payload.role);
  const title = textValue(payload.title) || `Concept set draft #${asset.id}`;
  const clinicalRationale = textValue(payload.clinical_rationale);
  const domainLabel = textValue(payload.domain);

  const handleSearchConcepts = async () => {
    if (conceptQuery.trim().length < 2) return;
    setIsSearchingConcepts(true);
    try {
      const result = await searchConcepts({ q: conceptQuery.trim(), standard: true, limit: 8 });
      setConceptResults(result.items);
    } finally {
      setIsSearchingConcepts(false);
    }
  };

  const handleAddConcept = (concept: Concept) => {
    if (concepts.some((item) => item.concept_id === concept.concept_id)) return;
    onUpdate(asset, [...concepts, conceptFromVocabulary(concept)]);
    setConceptQuery("");
    setConceptResults([]);
  };

  const handleRemoveConcept = (conceptId: number | null | undefined) => {
    if (conceptId == null) return;
    onUpdate(asset, concepts.filter((concept) => concept.concept_id !== conceptId));
  };

  const handleToggleConcept = (conceptId: number | null | undefined, field: "is_excluded" | "include_descendants" | "include_mapped") => {
    if (conceptId == null) return;
    onUpdate(
      asset,
      concepts.map((concept) =>
        concept.concept_id === conceptId
          ? { ...concept, [field]: !concept[field] }
          : concept,
      ),
    );
  };

  const handleApplyRepair = (suggestion: Record<string, unknown>) => {
    const patch = isRecord(suggestion.patch) ? suggestion.patch : null;
    const patchedConcepts = Array.isArray(patch?.concepts) ? patch.concepts : null;
    if (!patchedConcepts) return;
    onUpdate(asset, patchedConcepts as StudyDesignDraftConcept[]);
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-base px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-success/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success">
              {t("studies.workbench.labels.conceptSetDraft")}
            </span>
            <VerificationBadge status={asset.verification_status} />
            <span className="text-[10px] text-text-muted">{asset.status}</span>
            {roleLabel && <span className="text-[10px] text-text-ghost">{roleLabel}</span>}
          </div>
          <p className="mt-1 text-sm font-medium text-text-secondary">
            {title}
          </p>
          {clinicalRationale && (
            <p className="mt-1 text-xs text-text-muted line-clamp-2">{clinicalRationale}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-ghost">
            <span>{t("studies.workbench.labels.conceptsCount", { count: concepts.length })}</span>
            {domainLabel && <span>{domainLabel}</span>}
            {materialized && <span>{t("studies.workbench.labels.nativeConceptSet", { id: asset.materialized_id })}</span>}
          </div>
          {blockers.length > 0 && <p className="mt-2 text-xs text-critical">{blockers[0]}</p>}
          {blockers.length === 0 && warnings.length > 0 && <p className="mt-2 text-xs text-warning">{warnings[0]}</p>}
          {repairSuggestions.length > 0 && canEdit && (
            <div className="mt-3 space-y-2 rounded-md border border-warning/30 bg-warning/5 p-2">
              <p className="text-[10px] uppercase tracking-wider text-warning">Abby repair suggestions</p>
              {repairSuggestions.map((suggestion, index) => {
                const patch = isRecord(suggestion.patch) ? suggestion.patch : null;
                const canApply = Array.isArray(patch?.concepts);

                return (
                  <div key={`${asset.id}-repair-${index}`} className="flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-text-secondary">{String(suggestion.title ?? "Repair draft")}</p>
                      <p className="text-text-muted">{String(suggestion.message ?? "")}</p>
                    </div>
                    {canApply && (
                      <button
                        type="button"
                        onClick={() => handleApplyRepair(suggestion)}
                        disabled={isUpdating}
                        className="btn btn-ghost btn-sm shrink-0"
                      >
                        Apply Abby patch
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {!materialized && asset.verification_status === "unverified" && (
            <button
              type="button"
              onClick={() => onVerify(asset)}
              disabled={isVerifying}
              className="btn btn-ghost btn-sm"
            >
              {t("studies.workbench.actions.verify")}
            </button>
          )}
          {!materialized && asset.status === "needs_review" && (
            <>
              <button
                type="button"
                onClick={() => onReview(asset, "accept")}
                disabled={isReviewing || !verified}
                title={verified ? undefined : textAt(verification, "eligibility.reason") || t("studies.workbench.messages.onlyVerifiedConceptSetDrafts")}
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
          {!materialized && accepted && (
            <button
              type="button"
              onClick={() => onMaterialize(asset)}
              disabled={isMaterializing || !verified}
              className="btn btn-primary btn-sm"
            >
              {t("studies.workbench.actions.materialize")}
            </button>
          )}
          {materialized && (
            <a href={`/concept-sets/${asset.materialized_id}`} className="btn btn-ghost btn-sm">
              {t("studies.workbench.actions.openNativeEditor")}
            </a>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mt-3 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary"
      >
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {t("studies.workbench.labels.concepts")}
      </button>

      {expanded && (
        <div className="mt-3 border-t border-border-default pt-3">
          {canEdit && (
            <div className="mb-3 space-y-2">
              <div className="flex gap-2">
                <input
                  value={conceptQuery}
                  onChange={(event) => setConceptQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSearchConcepts();
                    }
                  }}
                  className="form-input"
                  placeholder={t("studies.workbench.messages.searchConceptsPlaceholder")}
                />
                <button
                  type="button"
                  onClick={() => void handleSearchConcepts()}
                  disabled={conceptQuery.trim().length < 2 || isSearchingConcepts}
                  className="btn btn-ghost btn-sm shrink-0"
                >
                  {isSearchingConcepts ? <Loader2 size={14} className="animate-spin" /> : t("studies.workbench.actions.search")}
                </button>
              </div>
              {conceptResults.length > 0 && (
                <div className="rounded-md border border-border-default bg-surface-raised">
                  {conceptResults.map((concept) => (
                    <button
                      key={concept.concept_id}
                      type="button"
                      onClick={() => handleAddConcept(concept)}
                      className="flex w-full items-center justify-between gap-3 border-b border-border-default px-3 py-2 text-left last:border-b-0 hover:bg-surface-overlay"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-text-secondary">{concept.concept_name}</span>
                        <span className="text-[10px] text-text-ghost">
                          {concept.concept_id} · {concept.domain_id} · {concept.vocabulary_id}
                        </span>
                      </span>
                      <span className="text-xs text-success">{t("studies.workbench.actions.add")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-text-ghost">
              <tr>
                <th className="py-2 pr-3 font-medium">{t("studies.workbench.labels.concept")}</th>
                <th className="py-2 pr-3 font-medium">{t("studies.workbench.labels.domain")}</th>
                <th className="py-2 pr-3 font-medium">{t("studies.workbench.labels.vocabulary")}</th>
                <th className="py-2 pr-3 font-medium">{t("studies.workbench.labels.flags")}</th>
                {canEdit && <th className="py-2 pr-3 font-medium">{t("studies.workbench.labels.actions")}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {concepts.map((concept, index) => (
                <tr key={`${asset.id}-${concept.concept_id ?? index}`}>
                  <td className="py-2 pr-3 text-text-secondary">
                    <span className="block font-medium">{concept.concept?.concept_name ?? `Concept ${concept.concept_id ?? "missing"}`}</span>
                    <span className="text-text-ghost">{concept.concept_id ?? "Missing ID"}</span>
                  </td>
                  <td className="py-2 pr-3 text-text-muted">{concept.concept?.domain_id ?? "Unknown"}</td>
                  <td className="py-2 pr-3 text-text-muted">{concept.concept?.vocabulary_id ?? "Unknown"}</td>
                  <td className="py-2 pr-3 text-text-ghost">
                    <button
                      type="button"
                      onClick={() => handleToggleConcept(concept.concept_id, "is_excluded")}
                      disabled={!canEdit || isUpdating}
                      className="hover:text-text-secondary disabled:hover:text-text-ghost"
                    >
                      {concept.is_excluded ? "Excluded" : "Included"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleConcept(concept.concept_id, "include_descendants")}
                      disabled={!canEdit || isUpdating}
                      className="hover:text-text-secondary disabled:hover:text-text-ghost"
                    >
                      {concept.include_descendants ? " · Descendants" : " · No descendants"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleConcept(concept.concept_id, "include_mapped")}
                      disabled={!canEdit || isUpdating}
                      className="hover:text-text-secondary disabled:hover:text-text-ghost"
                    >
                      {concept.include_mapped ? " · Mapped" : " · No mapped"}
                    </button>
                    {concept.concept?.standard_concept !== "S" ? " · Non-standard" : ""}
                    {concept.concept?.invalid_reason ? " · Invalid" : ""}
                  </td>
                  {canEdit && (
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => handleRemoveConcept(concept.concept_id)}
                        disabled={isUpdating}
                        className="text-xs text-critical hover:underline"
                      >
                        {t("studies.workbench.actions.remove")}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CohortDraftPanel({
  assets,
  readiness,
  isReadinessLoading,
  isGenerating,
  isReviewing,
  isVerifying,
  isUpdating,
  isMaterializing,
  isLinking,
  onGenerate,
  onReview,
  onVerify,
  onUpdate,
  onMaterialize,
  onLink,
}: {
  assets: StudyDesignAsset[];
  readiness: StudyCohortReadiness | null;
  isReadinessLoading: boolean;
  isGenerating: boolean;
  isReviewing: boolean;
  isVerifying: boolean;
  isUpdating: boolean;
  isMaterializing: boolean;
  isLinking: boolean;
  onGenerate: () => void;
  onReview: (asset: StudyDesignAsset, decision: "accept" | "reject" | "defer") => void;
  onVerify: (asset: StudyDesignAsset) => void;
  onUpdate: (asset: StudyDesignAsset, patch: Record<string, unknown>) => void;
  onMaterialize: (asset: StudyDesignAsset) => void;
  onLink: (asset: StudyDesignAsset, role?: string) => void;
}) {
  const { t } = useTranslation("app");
  const materializedConceptSets = assets.filter((asset) =>
    asset.asset_type === "concept_set_draft" &&
    asset.status === "materialized" &&
    asset.materialized_id != null,
  );
  const drafts = assets
    .filter((asset) => asset.asset_type === "cohort_draft")
    .sort((left, right) => right.id - left.id);
  const requiredRoles = arrayValue<string>(readiness?.required_roles);
  const presentRoles = isRecord(readiness?.present_roles) ? readiness.present_roles : {};
  const readinessBlockers = arrayValue(readiness?.blockers);
  const readinessWarnings = arrayValue(readiness?.warnings);
  const readinessDrafts = isRecord(readiness?.drafts) ? readiness.drafts : {};
  const missingRoles = arrayValue<string>(readiness?.missing_roles);
  const roleOptions = requiredRoles.length > 0 ? requiredRoles : ["target", "comparator", "outcome"];
  const cohortsReady = readiness?.ready_for_feasibility === true || readiness?.ready === true;
  const cohortAssetCount = typeof readiness?.cohort_asset_count === "number" ? readiness.cohort_asset_count : drafts.length;
  const materializedVerifiedCount = typeof readiness?.materialized_verified_count === "number" ? readiness.materialized_verified_count : 0;
  const draftTotal = typeof readinessDrafts.total === "number" ? readinessDrafts.total : cohortAssetCount;
  const draftMaterialized = typeof readinessDrafts.materialized === "number" ? readinessDrafts.materialized : materializedVerifiedCount;
  const draftLinked = typeof readinessDrafts.linked === "number" ? readinessDrafts.linked : materializedVerifiedCount;
  const roleLine = readiness
    ? requiredRoles.length > 0
      ? requiredRoles.map((role) => `${role}: ${presentRoles[role] ?? 0}`).join(" · ")
      : t("studies.workbench.messages.roles", {
        ready: materializedVerifiedCount,
        total: cohortAssetCount,
      })
    : null;
  const draftCohortGate = materializedConceptSets.length === 0
    ? t("studies.workbench.messages.materializeConceptSetFirst")
    : null;
  const readinessActionButton = (issue: unknown) => {
    const action = issueAction(issue);
    if (!action?.type) return null;

    if (action.type === "draft_cohorts") {
      return (
        <button
          type="button"
          onClick={onGenerate}
          disabled={materializedConceptSets.length === 0 || isGenerating}
          title={draftCohortGate ?? undefined}
          className="btn btn-ghost btn-sm shrink-0"
        >
          {String(action.label ?? "Draft cohorts")}
        </button>
      );
    }

    if (action.type === "link_materialized_cohort" && typeof action.asset_id === "number") {
      const asset = drafts.find((draft) => draft.id === action.asset_id);
      if (!asset) return null;

      return (
        <button
          type="button"
          onClick={() => onLink(asset, typeof action.role === "string" ? action.role : undefined)}
          disabled={isLinking}
          className="btn btn-ghost btn-sm shrink-0"
        >
          {String(action.label ?? `Link ${action.role ?? "cohort"}`)}
        </button>
      );
    }

    if (action.type === "link_materialized_cohort") {
      return (
        <span className="text-[10px] text-text-ghost">
          Select a role on a materialized cohort below.
        </span>
      );
    }

    return null;
  };
  const issueRows = [
    ...readinessBlockers.map((issue) => ({ issue, tone: "critical" as const })),
    ...readinessWarnings.map((issue) => ({ issue, tone: "warning" as const })),
  ];

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">
            {t("studies.workbench.sections.cohortDrafts")}
          </p>
          <p className="text-xs text-text-ghost">
            {t("studies.workbench.descriptions.cohorts")}
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={materializedConceptSets.length === 0 || isGenerating}
          title={draftCohortGate ?? undefined}
          className="btn btn-primary btn-sm shrink-0"
        >
          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {t("studies.workbench.actions.draftCohorts")}
        </button>
      </div>

      <div className="border-t border-border-default pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-text-secondary">
              {t("studies.workbench.sections.cohortReadiness")}
            </p>
            <p className="text-[11px] text-text-ghost">
              {isReadinessLoading ? t("studies.workbench.messages.checkingLinkedRoles") : roleLine ?? t("studies.workbench.messages.noReadinessSignal")}
            </p>
          </div>
          {readiness && (
            <span
              className={cn(
                "rounded-md px-2 py-1 text-[10px] uppercase tracking-wider",
                cohortsReady
                  ? "bg-success/10 text-success"
                  : "bg-warning/10 text-warning",
              )}
            >
              {cohortsReady ? t("studies.workbench.messages.ready") : t("studies.workbench.messages.blocked")}
            </span>
          )}
        </div>
        {requiredRoles.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {requiredRoles.map((role) => {
              const present = Number(presentRoles[role] ?? 0);
              const missing = present === 0;
              return (
                <div
                  key={role}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-[11px]",
                    missing
                      ? "border-warning/30 bg-warning/5 text-warning"
                      : "border-success/30 bg-success/5 text-success",
                  )}
                >
                  <span className="font-medium capitalize">{role}</span>
                  <span className="ml-2 text-text-ghost">{present} linked</span>
                </div>
              );
            })}
          </div>
        )}
        {missingRoles.length > 0 && (
          <p className="mt-2 text-[11px] text-warning">
            Missing roles: {missingRoles.join(", ")}
          </p>
        )}
        {issueRows.length > 0 && (
          <div className="mt-3 space-y-2">
            {issueRows.map(({ issue, tone }, index) => {
              const message = issueMessage(issue);
              if (!message) return null;
              return (
                <div
                  key={`${tone}-${index}-${message}`}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border-default bg-surface-base px-2 py-2"
                >
                  <p className={cn("min-w-0 flex-1 text-xs", tone === "critical" ? "text-critical" : "text-warning")}>
                    {message}
                  </p>
                  {readinessActionButton(issue)}
                </div>
              );
            })}
          </div>
        )}
        {readiness && (
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-ghost">
            <span>{t("studies.workbench.messages.drafts", { count: draftTotal })}</span>
            <span>{t("studies.workbench.messages.materialized", { count: draftMaterialized })}</span>
            <span>{t("studies.workbench.messages.linked", { count: draftLinked })}</span>
          </div>
        )}
      </div>

      <ActionGateHint message={draftCohortGate} />

      {drafts.length === 0 && (
        <div className="rounded-md border border-border-default bg-surface-base p-3 text-sm text-text-muted">
          {t("studies.workbench.messages.noCohortDrafts")}
        </div>
      )}

      {drafts.map((asset) => (
        <CohortDraftCard
          key={asset.id}
          asset={asset}
          isReviewing={isReviewing}
          isVerifying={isVerifying}
          isUpdating={isUpdating}
          isMaterializing={isMaterializing}
          isLinking={isLinking}
          roleOptions={roleOptions}
          onReview={onReview}
          onVerify={onVerify}
          onUpdate={onUpdate}
          onMaterialize={onMaterialize}
          onLink={onLink}
        />
      ))}
    </div>
  );
}

function CohortDraftCard({
  asset,
  isReviewing,
  isVerifying,
  isUpdating,
  isMaterializing,
  isLinking,
  roleOptions,
  onReview,
  onVerify,
  onUpdate,
  onMaterialize,
  onLink,
}: {
  asset: StudyDesignAsset;
  isReviewing: boolean;
  isVerifying: boolean;
  isUpdating: boolean;
  isMaterializing: boolean;
  isLinking: boolean;
  roleOptions: string[];
  onReview: (asset: StudyDesignAsset, decision: "accept" | "reject" | "defer") => void;
  onVerify: (asset: StudyDesignAsset) => void;
  onUpdate: (asset: StudyDesignAsset, patch: Record<string, unknown>) => void;
  onMaterialize: (asset: StudyDesignAsset) => void;
  onLink: (asset: StudyDesignAsset, role?: string) => void;
}) {
  const { t } = useTranslation("app");
  const [expanded, setExpanded] = useState(asset.verification_status !== "verified");
  const payload = draftPayloadRecord(asset);
  const [selectedLinkRole, setSelectedLinkRole] = useState(
    normalizeCohortRole(String(payload.role ?? asset.role ?? roleOptions[0] ?? "target")),
  );
  const linkRoleOptions = Array.from(new Set([selectedLinkRole, ...roleOptions].filter(Boolean)));
  const verified = asset.verification_status === "verified";
  const accepted = asset.status === "accepted";
  const materialized = asset.status === "materialized" && asset.materialized_id != null;
  const studyCohortId = typeof asset.provenance_json?.study_cohort_id === "number" ? asset.provenance_json.study_cohort_id : null;
  const verification = recordValue(asset.verification_json);
  const blockers = issueMessages(verification?.blocking_reasons);
  const warnings = issueMessages(verification?.warnings);
  const repairSuggestions = arrayValue(verification?.repair_suggestions).filter(isRecord);
  const checkRows = verificationCheckRows(verification);
  const conceptSetIds = arrayValue(payload.concept_set_ids);
  const canEdit = !materialized && asset.status !== "accepted";
  const roleLabel = textValue(payload.role);
  const title = textValue(payload.title) || `Cohort draft #${asset.id}`;
  const logicDescription = textValue(payload.logic_description);

  const handleApplyRepair = (suggestion: Record<string, unknown>) => {
    const patch = isRecord(suggestion.patch) ? suggestion.patch : null;
    if (!patch) return;
    onUpdate(asset, patch);
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-base px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-success/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success">
              {t("studies.workbench.labels.cohortDraft")}
            </span>
            <VerificationBadge status={asset.verification_status} />
            <span className="text-[10px] text-text-muted">{asset.status}</span>
            {roleLabel && <span className="text-[10px] text-text-ghost">{roleLabel}</span>}
          </div>
          <p className="mt-1 text-sm font-medium text-text-secondary">
            {title}
          </p>
          {logicDescription && (
            <p className="mt-1 text-xs text-text-muted line-clamp-2">{logicDescription}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-ghost">
            <span>{t("studies.workbench.labels.conceptSetsCount", { count: conceptSetIds.length })}</span>
            {materialized && <span>{t("studies.workbench.labels.nativeCohort", { id: asset.materialized_id })}</span>}
            {studyCohortId != null && <span>{t("studies.workbench.labels.linkedStudyCohort", { id: studyCohortId })}</span>}
          </div>
          {blockers.length > 0 && <p className="mt-2 text-xs text-critical">{blockers[0]}</p>}
          {blockers.length === 0 && warnings.length > 0 && <p className="mt-2 text-xs text-warning">{warnings[0]}</p>}
          {repairSuggestions.length > 0 && canEdit && (
            <div className="mt-3 space-y-2 rounded-md border border-warning/30 bg-warning/5 p-2">
              <p className="text-[10px] uppercase tracking-wider text-warning">Abby cohort repair suggestions</p>
              {repairSuggestions.map((suggestion, index) => {
                const patch = isRecord(suggestion.patch) ? suggestion.patch : null;

                return (
                  <div key={`${asset.id}-cohort-repair-${index}`} className="flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-text-secondary">{String(suggestion.title ?? "Repair cohort draft")}</p>
                      <p className="text-text-muted">{String(suggestion.message ?? "")}</p>
                    </div>
                    {patch && (
                      <button
                        type="button"
                        onClick={() => handleApplyRepair(suggestion)}
                        disabled={isUpdating}
                        className="btn btn-ghost btn-sm shrink-0"
                      >
                        Apply Abby cohort patch
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {!materialized && asset.verification_status === "unverified" && (
            <button type="button" onClick={() => onVerify(asset)} disabled={isVerifying} className="btn btn-ghost btn-sm">
              {t("studies.workbench.actions.verify")}
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
              <button type="button" onClick={() => onReview(asset, "defer")} disabled={isReviewing} className="btn btn-ghost btn-sm">
                {t("studies.workbench.actions.defer")}
              </button>
              <button type="button" onClick={() => onReview(asset, "reject")} disabled={isReviewing} className="btn btn-ghost btn-sm">
                {t("studies.workbench.actions.reject")}
              </button>
            </>
          )}
          {!materialized && accepted && (
            <button
              type="button"
              onClick={() => onMaterialize(asset)}
              disabled={isMaterializing || !verified}
              className="btn btn-primary btn-sm"
            >
              {t("studies.workbench.actions.materialize")}
            </button>
          )}
          {materialized && (
            <>
              {studyCohortId == null && (
                <div className="flex items-center gap-1">
                  <label htmlFor={`cohort-role-${asset.id}`} className="sr-only">Cohort role</label>
                  <select
                    id={`cohort-role-${asset.id}`}
                    aria-label={`Cohort role for ${title}`}
                    value={selectedLinkRole}
                    onChange={(event) => setSelectedLinkRole(event.target.value)}
                    className="form-input h-8 w-32 text-xs"
                  >
                    {linkRoleOptions.map((role) => (
                      <option key={`${asset.id}-${role}`} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onLink(asset, selectedLinkRole)}
                    disabled={isLinking}
                    className="btn btn-primary btn-sm"
                  >
                    {t("studies.workbench.actions.linkToStudy")}
                  </button>
                </div>
              )}
              <a href={`/cohort-definitions/${asset.materialized_id}`} className="btn btn-ghost btn-sm">
                {t("studies.workbench.actions.openNativeEditor")}
              </a>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mt-3 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary"
      >
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {t("studies.workbench.labels.lint")}
      </button>

      {expanded && (
        <div className="mt-3 border-t border-border-default pt-3">
          <div className="space-y-1">
            {checkRows.map((check) => (
              <div key={`${asset.id}-${check.name}`} className="flex gap-2 text-xs text-text-muted">
                <span
                  className={cn(
                    "mt-1 h-2 w-2 shrink-0 rounded-full",
                    check.status === "pass" && "bg-success",
                    check.status === "warn" && "bg-warning",
                    check.status === "fail" && "bg-critical",
                    check.status === "info" && "bg-surface-overlay",
                  )}
                />
                <span>{check.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
      const daimonTypes = source.daimons.map((daimon) => daimon.daimon_type);
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

function EvidenceMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "success" | "warning" | "critical" | "neutral";
}) {
  return (
    <div className="rounded-md border border-border-default bg-surface-base px-3 py-2">
      <p
        className={cn(
          "text-lg font-semibold",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "critical" && "text-critical",
          tone === "neutral" && "text-text-secondary",
        )}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-text-ghost">{label}</p>
    </div>
  );
}

function ActionGateHint({
  message,
  tone = "warning",
}: {
  message: string | null;
  tone?: "warning" | "neutral";
}) {
  if (!message) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
        tone === "warning" && "border-warning/30 bg-warning/5 text-warning",
        tone === "neutral" && "border-border-default bg-surface-base text-text-muted",
      )}
    >
      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function RecommendationCard({
  asset,
  isReviewing,
  onReview,
}: {
  asset: StudyDesignAsset;
  isReviewing: boolean;
  onReview: (asset: StudyDesignAsset, decision: "accept" | "reject" | "defer", reviewNotes?: string | null) => void;
}) {
  const { t } = useTranslation("app");
  const [expanded, setExpanded] = useState(asset.verification_status !== "verified");
  const [reviewNote, setReviewNote] = useState(asset.review_notes ?? "");
  const payload = draftPayloadRecord(asset);
  const score = typeof payload.score === "number" ? Math.round(payload.score * 100) : null;
  const rankScore = typeof asset.rank_score === "number" ? Math.round(asset.rank_score) : null;
  const typeLabel = asset.asset_type.replace(/_/g, " ");
  const reviewed = ["accepted", "rejected", "deferred"].includes(asset.status);
  const verified = asset.verification_status === "verified";
  const verification = recordValue(asset.verification_json);
  const verificationChecks = verificationCheckRows(verification);
  const blockers = issueMessages(verification?.blocking_reasons);
  const warnings = issueMessages(verification?.warnings);
  const rawSource = valueAt(verification, "source_summary.source") ?? asset.rank_score_json?.source ?? asset.provenance_json?.source;
  const source = rawSource == null ? null : String(rawSource);
  const acceptDisabledReason = verified
    ? null
    : textAt(verification, "eligibility.reason") || t("studies.workbench.messages.onlyVerifiedRecommendations");
  const title = textValue(payload.title) || `Recommendation #${asset.id}`;
  const description = textValue(payload.description);
  const rationale = textValue(payload.rationale);
  const domainLabel = textValue(payload.domain);
  const reviewNotes = () => {
    const trimmed = reviewNote.trim();
    return trimmed === "" ? null : trimmed;
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-base px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-success/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success">
              {typeLabel}
            </span>
            {rankScore != null && (
              <span className="rounded-md border border-border-default px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
                {t("studies.workbench.labels.rank", { score: rankScore })}
              </span>
            )}
            {score != null && <span className="text-[10px] text-text-ghost">{t("studies.workbench.labels.match", { score })}</span>}
            <VerificationBadge status={asset.verification_status} />
            {asset.status !== "needs_review" && (
              <span className="text-[10px] text-text-muted">{asset.status}</span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-text-secondary">
            {title}
          </p>
          {description && (
            <p className="mt-1 text-xs text-text-muted line-clamp-2">{description}</p>
          )}
          {rationale && (
            <p className="mt-1 text-xs text-text-ghost">{rationale}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-ghost">
            {source && <span>{sourceLabel(source)}</span>}
            {payload.external_id != null && <span>{t("studies.workbench.labels.ohdsiId", { id: String(payload.external_id) })}</span>}
            {domainLabel && <span>{domainLabel}</span>}
            {payload.has_expression === true && <span>{t("studies.workbench.labels.computable")}</span>}
            {payload.is_imported === true && <span>{t("studies.workbench.labels.imported")}</span>}
          </div>
          {blockers.length > 0 && (
            <p className="mt-2 text-xs text-critical">{blockers[0]}</p>
          )}
          {blockers.length === 0 && warnings.length > 0 && (
            <p className="mt-2 text-xs text-warning">{warnings[0]}</p>
          )}
          {acceptDisabledReason && !reviewed && (
            <p className="mt-2 text-[10px] text-text-ghost">{acceptDisabledReason}</p>
          )}
          {!reviewed && (
            <textarea
              aria-label="Recommendation review note"
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              rows={2}
              placeholder="Review note"
              className="form-input form-textarea mt-2 text-xs"
            />
          )}
        </div>

        {!reviewed && (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => onReview(asset, "accept", reviewNotes())}
              disabled={isReviewing || !verified}
              title={acceptDisabledReason ?? undefined}
              className="btn btn-primary btn-sm"
            >
              {t("studies.workbench.actions.accept")}
            </button>
            <button
              type="button"
              onClick={() => onReview(asset, "defer", reviewNotes())}
              disabled={isReviewing}
              className="btn btn-ghost btn-sm"
            >
              {t("studies.workbench.actions.defer")}
            </button>
            <button
              type="button"
              onClick={() => onReview(asset, "reject", reviewNotes())}
              disabled={isReviewing}
              className="btn btn-ghost btn-sm"
            >
              {t("studies.workbench.actions.reject")}
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mt-3 inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary"
      >
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {t("studies.workbench.labels.evidence")}
      </button>

      {expanded && (
        <div className="mt-3 border-t border-border-default pt-3">
          <div className="grid gap-3 md:grid-cols-2">
            <EvidenceBlock title={t("studies.workbench.sections.source")}>
              <EvidenceLine label={t("studies.workbench.labels.origin")} value={source ? sourceLabel(source) : t("studies.workbench.messages.unknown")} />
              <EvidenceLine label={t("studies.workbench.labels.matchedTerm")} value={textAt(verification, "source_summary.matched_term") || null} />
              <EvidenceLine label={t("studies.workbench.labels.canonicalRecord")} value={textAt(verification, "canonical_summary.title") || t("studies.workbench.labels.noCanonicalRecord")} />
            </EvidenceBlock>
            <EvidenceBlock title={t("studies.workbench.sections.governance")}>
              <EvidenceLine label={t("studies.workbench.labels.eligibility")} value={valueAt(verification, "eligibility.can_accept") ? t("studies.workbench.labels.acceptable") : t("studies.workbench.labels.blockedOrNeedsReview")} />
              <EvidenceLine label={t("studies.workbench.labels.policy")} value={textValue(verification?.acceptance_policy ?? asset.rank_score_json?.policy)} />
              <EvidenceLine label={t("studies.workbench.labels.nextActions")} value={arrayValue<string>(verification?.accepted_downstream_actions).join(", ")} />
            </EvidenceBlock>
          </div>

          {isRecord(asset.rank_score_json?.components) && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider text-text-ghost">{t("studies.workbench.labels.rankComponents")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(asset.rank_score_json.components).map(([name, value]) => (
                  <span
                    key={`${asset.id}-${name}`}
                    className="rounded-md border border-border-default px-2 py-1 text-[10px] text-text-muted"
                  >
                    {formatEvidenceName(name)} {formatRankComponent(value)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {verificationChecks.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-text-ghost">{t("studies.workbench.labels.verifierChecks")}</p>
              {verificationChecks.map((check) => (
                <div
                  key={`${asset.id}-${check.name}`}
                  className="flex gap-2 text-xs text-text-muted"
                >
                  <span
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      check.status === "pass" && "bg-success",
                      check.status === "warn" && "bg-warning",
                      check.status === "fail" && "bg-critical",
                      check.status === "info" && "bg-surface-overlay",
                    )}
                  />
                  <span>{check.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EvidenceBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-text-ghost">{title}</p>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}

function EvidenceLine({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;

  return (
    <p className="text-xs text-text-muted">
      <span className="text-text-ghost">{label}:</span> {String(value)}
    </p>
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

function analysisPlanIssues(issues: unknown, fallback: unknown): Array<{ message: string; action?: { label?: string } }> {
  const structured: Array<{ message: string; action?: { label?: string } }> = [];
  for (const issue of arrayValue(issues)) {
    const message = issueMessage(issue);
    if (!message) continue;

    const action = issueAction(issue);
    structured.push({ message, action: action ?? undefined });
  }

  if (structured.length > 0) return structured;

  return arrayValue(fallback).flatMap((message) => typeof message === "string" ? [{ message }] : []);
}

function analysisPlanParameterRows(payload: Partial<StudyAnalysisPlanDraft>): Array<{ name: string; label: string; value?: unknown; message?: string }> {
  if (Array.isArray(payload.parameter_review)) {
    return payload.parameter_review
      .filter(isRecord)
      .map((row, index) => ({
        name: String(row.name ?? row.label ?? `parameter_${index}`),
        label: String(row.label ?? row.name ?? `Parameter ${index + 1}`),
        value: row.value,
        message: typeof row.message === "string" ? row.message : undefined,
      }));
  }

  const designJson = isRecord(payload.design_json) ? payload.design_json : {};
  return Object.entries(designJson).slice(0, 4).map(([key, value]) => ({
    name: key,
    label: key.replace(/_/g, " "),
    value,
    message: "Review generated default.",
  }));
}

function formatAnalysisParameterValue(value: unknown): string {
  if (value == null || value === "") return "Not set";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `${value.length} selected`;
  if (isRecord(value)) return Object.keys(value).slice(0, 4).join(", ");

  return String(value);
}

function analysisDetailPath(type: string | undefined, id: number | null): string | null {
  if (id == null) return null;

  const basePath = {
    characterization: "/analyses/characterizations",
    incidence_rate: "/analyses/incidence-rates",
    pathway: "/analyses/pathways",
    estimation: "/analyses/estimations",
    prediction: "/analyses/predictions",
    sccs: "/analyses/sccs",
    self_controlled_cohort: "/analyses/self-controlled-cohorts",
    evidence_synthesis: "/analyses/evidence-synthesis",
  }[type ?? ""];

  return basePath ? `${basePath}/${id}` : null;
}

function VerificationBadge({ status }: { status: string }) {
  const { t } = useTranslation("app");
  const label = status === "verified"
    ? t("studies.workbench.labels.verified")
    : status === "partial"
      ? t("studies.workbench.labels.needsCheck")
      : status === "blocked"
        ? t("studies.workbench.labels.blocked")
        : t("studies.workbench.labels.unverified");
  const tone = status === "verified" ? "success" : status === "blocked" ? "critical" : "warning";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider",
        tone === "success" && "bg-success/10 text-success",
        tone === "warning" && "bg-warning/10 text-warning",
        tone === "critical" && "bg-critical/10 text-critical",
      )}
    >
      {tone === "success" ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
      {label}
    </span>
  );
}

function sourceLabel(source: string): string {
  return source
    .replace(/_/g, " ")
    .replace(/\bstudy-agent\b/i, "StudyAgent")
    .replace(/\bohdsi\b/i, "OHDSI");
}

function formatEvidenceName(name: string): string {
  return name.replace(/_/g, " ");
}

function formatRankComponent(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0.0";
  if (value > 0) return `+${value.toFixed(1)}`;
  return value.toFixed(1);
}

function conceptFromVocabulary(concept: Concept): StudyDesignDraftConcept {
  return {
    concept_id: concept.concept_id,
    is_excluded: false,
    include_descendants: true,
    include_mapped: false,
    concept: {
      concept_id: concept.concept_id,
      concept_name: concept.concept_name,
      domain_id: concept.domain_id,
      vocabulary_id: concept.vocabulary_id,
      concept_class_id: concept.concept_class_id,
      standard_concept: concept.standard_concept,
      concept_code: concept.concept_code,
      invalid_reason: concept.invalid_reason ?? null,
    },
  };
}

function conceptDraftPayload(asset: StudyDesignAsset, concepts: StudyDesignDraftConcept[]) {
  const payload = draftPayloadRecord(asset);

  return {
    title: payload.title ?? `Concept set draft #${asset.id}`,
    role: payload.role ?? asset.role,
    domain: payload.domain ?? null,
    clinical_rationale: payload.clinical_rationale ?? null,
    search_terms: payload.search_terms ?? [],
    source_concept_set_references: payload.source_concept_set_references ?? [],
    concepts: concepts.map((concept) => ({
      concept_id: Number(concept.concept_id),
      is_excluded: concept.is_excluded ?? false,
      include_descendants: concept.include_descendants ?? true,
      include_mapped: concept.include_mapped ?? false,
      rationale: concept.rationale ?? null,
    })),
  };
}

function cohortDraftPayload(asset: StudyDesignAsset, patch: Record<string, unknown>) {
  const payload = isRecord(asset.draft_payload_json) ? asset.draft_payload_json : {};
  const merged = {
    ...payload,
    ...patch,
  };

  return {
    title: merged.title ?? `Cohort draft #${asset.id}`,
    role: merged.role ?? asset.role ?? "target",
    logic_description: merged.logic_description ?? null,
    concept_set_ids: Array.isArray(merged.concept_set_ids) ? merged.concept_set_ids : [],
    concept_set_asset_ids: Array.isArray(merged.concept_set_asset_ids)
      ? merged.concept_set_asset_ids
      : Array.isArray(merged.source_asset_ids)
        ? merged.source_asset_ids
        : [],
    source_asset_ids: Array.isArray(merged.source_asset_ids)
      ? merged.source_asset_ids
      : Array.isArray(merged.concept_set_asset_ids)
        ? merged.concept_set_asset_ids
        : [],
    entry_event: isRecord(merged.entry_event) ? merged.entry_event : null,
    observation_window: isRecord(merged.observation_window) ? merged.observation_window : null,
    inclusion_rules: Array.isArray(merged.inclusion_rules) ? merged.inclusion_rules : [],
    censoring_criteria: Array.isArray(merged.censoring_criteria) ? merged.censoring_criteria : [],
    exit_strategy: typeof merged.exit_strategy === "string" ? merged.exit_strategy : null,
    collapse_settings: isRecord(merged.collapse_settings) ? merged.collapse_settings : null,
    role_link: isRecord(merged.role_link) ? merged.role_link : null,
    expression_json: isRecord(merged.expression_json) ? merged.expression_json : {},
  };
}

function verificationCheckRows(verification: Record<string, unknown> | null | undefined): Array<{ name: string; status: string; message: string }> {
  if (!verification) return [];
  if (Array.isArray(verification.checklist)) {
    return verification.checklist
      .filter(isRecord)
      .map((check) => ({
        name: String(check.name ?? "check"),
        status: String(check.status ?? "info"),
        message: String(check.message ?? check.name ?? "Check"),
      }));
  }
  if (Array.isArray(verification.checks)) {
    return verification.checks
      .filter(isRecord)
      .map((check) => ({
        name: String(check.name ?? "check"),
        status: String(check.status ?? "info"),
        message: String(check.message ?? check.name ?? "Check"),
      }));
  }
  if (isRecord(verification.checks)) {
    return Object.entries(verification.checks).map(([name, passed]) => ({
      name,
      status: passed ? "pass" : "fail",
      message: `${passed ? "Pass" : "Fix"}: ${name.replace(/_/g, " ")}`,
    }));
  }
  return [];
}

function IntentReviewPanel({
  version,
  initialFormState,
  onSave,
  onAccept,
  isSaving,
  isAccepting,
}: {
  version: StudyDesignVersion;
  initialFormState: IntentFormState;
  onSave: (state: IntentFormState) => void;
  onAccept: () => void;
  isSaving: boolean;
  isAccepting: boolean;
}) {
  const { t } = useTranslation("app");
  const [formState, setFormState] = useState(initialFormState);
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

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="form-label">{label}</label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        className="form-input form-textarea"
      />
    </div>
  );
}

function versionSpec(version: StudyDesignVersion): StudyDesignSpec {
  const spec = version.normalized_spec_json ?? {};
  return isRecord(spec) ? spec : emptySpec();
}

function emptySpec(): StudyDesignSpec {
  return {
    schema_version: "1.0",
    study: {},
    pico: {},
  };
}

function specToForm(spec: StudyDesignSpec): IntentFormState {
  return {
    researchQuestion: textAt(spec, "study.research_question"),
    primaryObjective: textAt(spec, "study.primary_objective"),
    population: summaryAt(spec, "pico.population"),
    exposure: summaryAt(spec, "pico.intervention_or_exposure") || summaryAt(spec, "pico.intervention"),
    comparator: summaryAt(spec, "pico.comparator"),
    outcome: summaryAt(spec, "pico.outcomes.0") || summaryAt(spec, "pico.outcome"),
    time: summaryAt(spec, "pico.time") || summaryAt(spec, "pico.time_at_risk"),
  };
}

function formToSpec(spec: StudyDesignSpec, form: IntentFormState, study: Study): StudyDesignSpec {
  const current = isRecord(spec) ? spec : emptySpec();
  const currentStudy = isRecord(current.study) ? current.study : {};
  const currentPico = isRecord(current.pico) ? current.pico : {};

  return {
    ...current,
    study: {
      ...currentStudy,
      title: currentStudy.title || study.title,
      short_title: currentStudy.short_title ?? study.short_title,
      research_question: form.researchQuestion || textAt(currentStudy, "research_question") || study.primary_objective || "",
      primary_objective: form.primaryObjective,
      study_design: currentStudy.study_design || study.study_design || "observational",
      study_type: currentStudy.study_type || study.study_type || "custom",
      target_population_summary: form.population,
    },
    pico: {
      ...currentPico,
      population: { ...objectAt(currentPico, "population"), summary: form.population },
      intervention_or_exposure: { ...objectAt(currentPico, "intervention_or_exposure"), summary: form.exposure },
      comparator: { ...objectAt(currentPico, "comparator"), summary: form.comparator },
      outcomes: [{ ...objectAt(currentPico, "outcomes.0"), summary: form.outcome, primary: true }],
      time: { ...objectAt(currentPico, "time"), summary: form.time },
    },
  };
}

function summaryAt(value: unknown, path: string): string {
  const selected = valueAt(value, path);
  if (typeof selected === "string") return selected;
  if (isRecord(selected)) {
    const summary = selected.summary ?? selected.label ?? selected.title ?? selected.description;
    return typeof summary === "string" ? summary : "";
  }
  return "";
}

function textAt(value: unknown, path: string): string {
  const selected = valueAt(value, path);
  return typeof selected === "string" ? selected : "";
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  const selected = valueAt(value, path);
  return isRecord(selected) ? selected : {};
}

function valueAt(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      const index = Number(part);
      return Number.isInteger(index) ? current[index] : undefined;
    }
    if (isRecord(current)) {
      return current[part];
    }
    return undefined;
  }, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function arrayValue<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function draftPayloadRecord(asset: StudyDesignAsset): Record<string, unknown> {
  return isRecord(asset.draft_payload_json) ? asset.draft_payload_json : {};
}

function draftConceptArray(value: unknown): StudyDesignDraftConcept[] {
  return arrayValue(value)
    .filter(isRecord)
    .map((concept) => ({
      concept_id: Number(concept.concept_id),
      is_excluded: concept.is_excluded === true,
      include_descendants: concept.include_descendants !== false,
      include_mapped: concept.include_mapped === true,
      rationale: typeof concept.rationale === "string" ? concept.rationale : null,
      concept: isRecord(concept.concept)
        ? {
          concept_id: Number(concept.concept.concept_id ?? concept.concept_id),
          concept_name: String(concept.concept.concept_name ?? `Concept ${concept.concept_id ?? "missing"}`),
          domain_id: String(concept.concept.domain_id ?? "Unknown"),
          vocabulary_id: String(concept.concept.vocabulary_id ?? "Unknown"),
          concept_class_id: String(concept.concept.concept_class_id ?? "Unknown"),
          standard_concept: typeof concept.concept.standard_concept === "string" ? concept.concept.standard_concept : null,
          concept_code: String(concept.concept.concept_code ?? concept.concept_id ?? ""),
          invalid_reason: typeof concept.concept.invalid_reason === "string" ? concept.concept.invalid_reason : null,
        }
        : undefined,
    }))
    .filter((concept) => Number.isFinite(concept.concept_id));
}

function issueMessages(value: unknown): string[] {
  return arrayValue(value)
    .map(issueMessage)
    .filter((message) => message !== "");
}

function issueMessage(issue: unknown): string {
  if (typeof issue === "string") return issue;
  if (isRecord(issue) && typeof issue.message === "string") return issue.message;
  return "";
}

function issueAction(issue: unknown): StudyReadinessAction | null {
  if (!isRecord(issue) || !isRecord(issue.action)) return null;
  return issue.action as StudyReadinessAction;
}

function issueCode(issue: unknown): string {
  return isRecord(issue) && typeof issue.code === "string" ? issue.code : "";
}

function feasibilityIssueGuidance(issue: unknown): string {
  switch (issueCode(issue)) {
    case "missing_cohort_generation":
      return "Generate the linked cohort on this CDM source, then rerun feasibility.";
    case "incomplete_cohort_generation":
      return "Wait for the source cohort generation to complete or repair the failed generation job.";
    case "empty_required_cohort":
      return "Review cohort logic or source coverage because this required role generated zero patients.";
    case "small_required_cohort":
      return "Confirm the small-cell threshold and decide whether this source can support the analysis.";
    case "missing_cdm_daimon":
    case "person_records_unavailable":
    case "missing_person_records":
    case "observation_periods_unavailable":
    case "missing_observation_periods":
      return "Review the source configuration and core OMOP CDM coverage before trusting this source.";
    case "missing_required_domain_records":
      return "Confirm whether the source has records in the domains required by this cohort role.";
    case "missing_concept_traceability":
      return "Return to linked cohorts and preserve concept-set traceability for diagnostics.";
    case "dqd_failed_checks":
      return "Review Data Quality Dashboard failures before moving this source into analysis planning.";
    case "source_freshness_unknown":
    case "source_freshness_stale":
      return "Confirm source release metadata and data freshness with the data partner.";
    default:
      return "Review the source-specific evidence and resolve this item before analysis planning.";
  }
}

function feasibilityPreviousRun(
  feasibility: StudyFeasibilityResult | undefined,
  previousFeasibility: StudyFeasibilityResult | undefined,
): StudyFeasibilityResult["previous_run"] {
  if (feasibility?.previous_run) return feasibility.previous_run;
  if (!feasibility || !previousFeasibility) return null;

  return {
    status: previousFeasibility.status,
    ready_source_count: previousFeasibility.ready_source_count,
    source_count: previousFeasibility.source_count,
    min_cell_count: previousFeasibility.min_cell_count,
    ran_at: previousFeasibility.ran_at,
    delta_ready_source_count: feasibility.ready_source_count - previousFeasibility.ready_source_count,
    delta_source_count: feasibility.source_count - previousFeasibility.source_count,
    threshold_changed: feasibility.min_cell_count !== previousFeasibility.min_cell_count,
  };
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function normalizeCohortRole(role: string): string {
  const normalized = role.trim().toLowerCase();
  if (normalized === "population" || normalized === "exposure" || normalized === "intervention") {
    return "target";
  }
  return normalized || "target";
}

function mutationError(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (isRecord(error) && isRecord(error.response) && isRecord(error.response.data)) {
    const data = error.response.data;
    const message = typeof data.message === "string" ? data.message : null;
    const issues = arrayValue(data.issues)
      .map((issue) => issueMessage(issue))
      .filter((issue) => issue !== "")
      .slice(0, 4);
    if (message && issues.length > 0) {
      return `${message} ${issues.join(" ")}`;
    }
    if (message) return message;
  }
  if (error instanceof Error) return error.message;
  return "Study design request failed.";
}
