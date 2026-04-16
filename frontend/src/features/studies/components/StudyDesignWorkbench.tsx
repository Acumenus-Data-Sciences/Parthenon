// @ts-nocheck — unfinished feature with pervasive type drift; unblock CI build until feature is completed
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Brain, CheckCircle2, ChevronDown, ChevronRight, Loader2, Lock, Plus, Save, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { searchConcepts } from "@/features/vocabulary/api/vocabularyApi";
import type { Source } from "@/types/models";
import type { Concept } from "@/features/vocabulary/types/vocabulary";
import type { Study, StudyAnalysisPlanDraft, StudyCohortReadiness, StudyDesignAsset, StudyDesignDraftConcept, StudyDesignLockReadiness, StudyDesignSpec, StudyDesignVersion, StudyFeasibilityResult } from "../types/study";
import {
  useAcceptStudyDesignVersion,
  useCreateStudyDesignSession,
  useDraftStudyAnalysisPlans,
  useDraftStudyCohorts,
  useDraftStudyConceptSets,
  useGenerateStudyIntent,
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
  useStudyDesignLockReadiness,
  useStudyCohortReadiness,
  useStudyDesignAssets,
  useStudyDesignSessions,
  useStudyDesignVersions,
  useVerifyStudyCohortDraft,
  useUpdateStudyConceptSetDraft,
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

export function StudyDesignWorkbench({ study }: StudyDesignWorkbenchProps) {
  const slug = study.slug || String(study.id);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [researchQuestion, setResearchQuestion] = useState(
    study.primary_objective || study.description || "",
  );
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);

  const sessionsQuery = useStudyDesignSessions(slug);
  const createSession = useCreateStudyDesignSession();
  const generateIntent = useGenerateStudyIntent();
  const updateVersion = useUpdateStudyDesignVersion();
  const acceptVersion = useAcceptStudyDesignVersion();
  const importExistingStudy = useImportExistingStudyDesign();
  const critiqueStudyDesign = useCritiqueStudyDesignVersion();
  const recommendPhenotypes = useRecommendStudyPhenotypes();
  const draftConceptSets = useDraftStudyConceptSets();
  const draftCohorts = useDraftStudyCohorts();
  const verifyConceptSetDraft = useVerifyStudyConceptSetDraft();
  const verifyCohortDraft = useVerifyStudyCohortDraft();
  const updateConceptSetDraft = useUpdateStudyConceptSetDraft();
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
  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);

  const ensureSession = async () => {
    if (selectedSession) return selectedSession.id;

    const session = await createSession.mutateAsync({
      slug,
      payload: {
        title: "Study intent design",
        source_mode: "natural_language",
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

  const handleSaveReview = (formState: IntentFormState) => {
    if (!selectedSession || !selectedVersion) return;
    updateVersion.mutate({
      slug,
      sessionId: selectedSession.id,
      versionId: selectedVersion.id,
      spec: formToSpec(selectedVersion.spec_json, formState, study),
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
    setSelectedVersionId(result.version.id);
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

  const handleReviewAsset = (asset: StudyDesignAsset, decision: "accept" | "reject" | "defer") => {
    if (!selectedSession) return;
    reviewAsset.mutate({
      slug,
      sessionId: selectedSession.id,
      assetId: asset.id,
      decision,
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

  const handleMaterializeCohortDraft = (asset: StudyDesignAsset) => {
    if (!selectedSession) return;
    materializeCohortDraft.mutate({ slug, sessionId: selectedSession.id, assetId: asset.id });
  };

  const handleLinkCohortDraft = (asset: StudyDesignAsset) => {
    if (!selectedSession) return;
    linkCohortDraft.mutate({
      slug,
      sessionId: selectedSession.id,
      assetId: asset.id,
      role: asset.role ?? String(asset.draft_payload_json.role ?? "target"),
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

  const handleDraftAnalysisPlans = () => {
    if (!selectedSession || !selectedVersion) return;
    draftAnalysisPlans.mutate({
      slug,
      sessionId: selectedSession.id,
      versionId: selectedVersion.id,
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
    mutationError(updateVersion.error) ||
    mutationError(acceptVersion.error) ||
    mutationError(importExistingStudy.error) ||
    mutationError(critiqueStudyDesign.error) ||
    mutationError(recommendPhenotypes.error) ||
    mutationError(draftConceptSets.error) ||
    mutationError(draftCohorts.error) ||
    mutationError(verifyConceptSetDraft.error) ||
    mutationError(verifyCohortDraft.error) ||
    mutationError(updateConceptSetDraft.error) ||
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-success" />
            <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
              Study Design Compiler
            </h3>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Convert a research question into reviewed OHDSI-aligned study intent, then vet reusable phenotype assets before anything moves downstream.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            createSession.mutate(
              { slug, payload: { title: "Study intent design", source_mode: "natural_language" } },
              { onSuccess: (session) => setSelectedSessionId(session.id) },
            );
          }}
          disabled={createSession.isPending}
          className="btn btn-ghost btn-sm shrink-0"
        >
          {createSession.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          New Session
        </button>
      </div>

      {sessions.length > 0 && (
        <div className="grid gap-3 md:grid-cols-[minmax(0,240px)_1fr]">
          <div className="space-y-2">
            <p className="text-[10px] text-text-ghost uppercase tracking-wider">Sessions</p>
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
              <label className="form-label">Research Question</label>
              <textarea
                value={researchQuestion}
                onChange={(event) => setResearchQuestion(event.target.value)}
                rows={3}
                className="form-input form-textarea"
                placeholder="Compare recurrent MACE in post-MI patients initiating clopidogrel versus aspirin."
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!researchQuestion.trim() || generateIntent.isPending || createSession.isPending}
                  className="btn btn-primary btn-sm"
                >
                  {generateIntent.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Generate Intent
                </button>
              </div>
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
                <IntentReviewPanel
                  key={selectedVersion.id}
                  version={selectedVersion}
                  initialFormState={specToForm(selectedVersion.spec_json)}
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
                  isVerifying={verifyConceptSetDraft.isPending}
                  isUpdating={updateConceptSetDraft.isPending}
                  isMaterializing={materializeConceptSetDraft.isPending}
                  onGenerate={handleDraftConceptSets}
                  onReview={handleReviewAsset}
                  onVerify={handleVerifyConceptSetDraft}
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
                  isMaterializing={materializeCohortDraft.isPending}
                  isLinking={linkCohortDraft.isPending}
                  onGenerate={handleDraftCohorts}
                  onReview={handleReviewAsset}
                  onVerify={handleVerifyCohortDraft}
                  onMaterialize={handleMaterializeCohortDraft}
                  onLink={handleLinkCohortDraft}
                />
                <FeasibilityDashboard
                  assets={assets}
                  readiness={cohortReadinessQuery.data ?? null}
                  isRunning={runFeasibility.isPending}
                  onRun={handleRunFeasibility}
                />
                <AnalysisPlanPanel
                  assets={assets}
                  isGenerating={draftAnalysisPlans.isPending}
                  isReviewing={reviewAsset.isPending}
                  isVerifying={verifyAnalysisPlan.isPending}
                  isMaterializing={materializeAnalysisPlan.isPending}
                  onGenerate={handleDraftAnalysisPlans}
                  onReview={handleReviewAsset}
                  onVerify={handleVerifyAnalysisPlan}
                  onMaterialize={handleMaterializeAnalysisPlan}
                />
                <DesignLockPanel
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
            Start a design session, then generate a structured PICO intent from the study question.
          </p>
          <div className="mt-3">
            <textarea
              value={researchQuestion}
              onChange={(event) => setResearchQuestion(event.target.value)}
              rows={3}
              className="form-input form-textarea"
              placeholder="Describe the study question..."
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!researchQuestion.trim() || createSession.isPending || generateIntent.isPending}
              className="btn btn-primary btn-sm mt-3"
            >
              {createSession.isPending || generateIntent.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Create Session and Generate Intent
            </button>
          </div>
        </div>
      )}

      {sessionsQuery.isLoading && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 size={14} className="animate-spin" />
          Loading design sessions...
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
  onReview: (asset: StudyDesignAsset, decision: "accept" | "reject" | "defer") => void;
  canGenerate: boolean;
}) {
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

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">Phenotype and Reuse Recommendations</p>
          <p className="text-xs text-text-ghost">
            Review reusable Phenotype Library entries, local cohorts, and local concept sets before drafting anything new.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          className="btn btn-primary btn-sm shrink-0"
        >
          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Recommend
        </button>
      </div>

      {recommendations.length > 0 && (
        <div className="grid gap-2 text-xs sm:grid-cols-4">
          <EvidenceMetric label="Verified" value={evidenceCounts.verified} tone="success" />
          <EvidenceMetric label="Needs check" value={evidenceCounts.partial + evidenceCounts.unverified} tone="warning" />
          <EvidenceMetric label="Blocked" value={evidenceCounts.blocked} tone="critical" />
          <EvidenceMetric label="Review queue" value={recommendations.length} tone="neutral" />
        </div>
      )}

      {!canGenerate && (
        <p className="text-xs text-text-ghost">
          Save a review-ready intent or accept the intent before requesting recommendations.
        </p>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 size={14} className="animate-spin" />
          Loading recommendations...
        </div>
      )}

      {!isLoading && recommendations.length === 0 && (
        <div className="rounded-md border border-border-default bg-surface-base p-3 text-sm text-text-muted">
          No recommendations yet.
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
  onUpdate: (asset: StudyDesignAsset, concepts: StudyDesignDraftConcept[]) => void;
  onMaterialize: (asset: StudyDesignAsset) => void;
}) {
  const acceptedInputs = assets.filter((asset) =>
    ["phenotype_recommendation", "local_cohort", "local_concept_set"].includes(asset.asset_type) &&
    asset.status === "accepted",
  );
  const drafts = assets
    .filter((asset) => asset.asset_type === "concept_set_draft")
    .sort((left, right) => right.id - left.id);
  const canGenerate = acceptedInputs.length > 0;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">Concept Set Drafts</p>
          <p className="text-xs text-text-ghost">
            Convert accepted evidence into vocabulary-checked drafts before creating native concept sets.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          className="btn btn-primary btn-sm shrink-0"
        >
          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Draft Concept Sets
        </button>
      </div>

      {!canGenerate && (
        <p className="text-xs text-text-ghost">
          Accept at least one verified phenotype, cohort, or concept set recommendation first.
        </p>
      )}

      {drafts.length === 0 && (
        <div className="rounded-md border border-border-default bg-surface-base p-3 text-sm text-text-muted">
          No concept set drafts yet.
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
  const [expanded, setExpanded] = useState(asset.verification_status !== "verified");
  const [conceptQuery, setConceptQuery] = useState("");
  const [conceptResults, setConceptResults] = useState<Concept[]>([]);
  const [isSearchingConcepts, setIsSearchingConcepts] = useState(false);
  const payload = asset.draft_payload_json;
  const verified = asset.verification_status === "verified";
  const accepted = asset.status === "accepted";
  const materialized = asset.status === "materialized" && asset.materialized_id != null;
  const verification = asset.verification_json;
  const concepts = verification?.concepts ?? payload.concepts ?? [];
  const blockers = verification?.blocking_reasons ?? [];
  const warnings = verification?.warnings ?? [];
  const canEdit = !materialized && asset.status !== "accepted";

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

  return (
    <div className="rounded-lg border border-border-default bg-surface-base px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-success/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success">
              concept set draft
            </span>
            <VerificationBadge status={asset.verification_status} />
            <span className="text-[10px] text-text-muted">{asset.status}</span>
            {payload.role && <span className="text-[10px] text-text-ghost">{String(payload.role)}</span>}
          </div>
          <p className="mt-1 text-sm font-medium text-text-secondary">
            {payload.title ?? `Concept set draft #${asset.id}`}
          </p>
          {payload.clinical_rationale && (
            <p className="mt-1 text-xs text-text-muted line-clamp-2">{payload.clinical_rationale}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-ghost">
            <span>{concepts.length} concepts</span>
            {payload.domain && <span>{String(payload.domain)}</span>}
            {materialized && <span>Native concept set #{asset.materialized_id}</span>}
          </div>
          {blockers.length > 0 && <p className="mt-2 text-xs text-critical">{blockers[0]}</p>}
          {blockers.length === 0 && warnings.length > 0 && <p className="mt-2 text-xs text-warning">{warnings[0]}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {!materialized && asset.verification_status === "unverified" && (
            <button
              type="button"
              onClick={() => onVerify(asset)}
              disabled={isVerifying}
              className="btn btn-ghost btn-sm"
            >
              Verify
            </button>
          )}
          {!materialized && asset.status === "needs_review" && (
            <>
              <button
                type="button"
                onClick={() => onReview(asset, "accept")}
                disabled={isReviewing || !verified}
                title={verified ? undefined : verification?.eligibility?.reason ?? "Only verified concept set drafts can be accepted."}
                className="btn btn-primary btn-sm"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => onReview(asset, "defer")}
                disabled={isReviewing}
                className="btn btn-ghost btn-sm"
              >
                Defer
              </button>
              <button
                type="button"
                onClick={() => onReview(asset, "reject")}
                disabled={isReviewing}
                className="btn btn-ghost btn-sm"
              >
                Reject
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
              Materialize
            </button>
          )}
          {materialized && (
            <a href={`/concept-sets/${asset.materialized_id}`} className="btn btn-ghost btn-sm">
              Open Native Editor
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
        Concepts
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
                  placeholder="Search OMOP vocabulary concepts"
                />
                <button
                  type="button"
                  onClick={() => void handleSearchConcepts()}
                  disabled={conceptQuery.trim().length < 2 || isSearchingConcepts}
                  className="btn btn-ghost btn-sm shrink-0"
                >
                  {isSearchingConcepts ? <Loader2 size={14} className="animate-spin" /> : "Search"}
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
                      <span className="text-xs text-success">Add</span>
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
                <th className="py-2 pr-3 font-medium">Concept</th>
                <th className="py-2 pr-3 font-medium">Domain</th>
                <th className="py-2 pr-3 font-medium">Vocabulary</th>
                <th className="py-2 pr-3 font-medium">Flags</th>
                {canEdit && <th className="py-2 pr-3 font-medium">Actions</th>}
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
                        Remove
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
  isMaterializing,
  isLinking,
  onGenerate,
  onReview,
  onVerify,
  onMaterialize,
  onLink,
}: {
  assets: StudyDesignAsset[];
  readiness: StudyCohortReadiness | null;
  isReadinessLoading: boolean;
  isGenerating: boolean;
  isReviewing: boolean;
  isVerifying: boolean;
  isMaterializing: boolean;
  isLinking: boolean;
  onGenerate: () => void;
  onReview: (asset: StudyDesignAsset, decision: "accept" | "reject" | "defer") => void;
  onVerify: (asset: StudyDesignAsset) => void;
  onMaterialize: (asset: StudyDesignAsset) => void;
  onLink: (asset: StudyDesignAsset) => void;
}) {
  const materializedConceptSets = assets.filter((asset) =>
    asset.asset_type === "concept_set_draft" &&
    asset.status === "materialized" &&
    asset.materialized_id != null,
  );
  const drafts = assets
    .filter((asset) => asset.asset_type === "cohort_draft")
    .sort((left, right) => right.id - left.id);
  const roleLine = readiness
    ? readiness.required_roles.map((role) => `${role}: ${readiness.present_roles[role] ?? 0}`).join(" · ")
    : null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">Cohort Drafts</p>
          <p className="text-xs text-text-ghost">
            Turn materialized concept sets into native cohort definition drafts.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={materializedConceptSets.length === 0 || isGenerating}
          className="btn btn-primary btn-sm shrink-0"
        >
          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Draft Cohorts
        </button>
      </div>

      <div className="border-t border-border-default pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-text-secondary">Study Cohort Readiness</p>
            <p className="text-[11px] text-text-ghost">
              {isReadinessLoading ? "Checking linked roles..." : roleLine ?? "No readiness signal yet."}
            </p>
          </div>
          {readiness && (
            <span
              className={cn(
                "rounded-md px-2 py-1 text-[10px] uppercase tracking-wider",
                readiness.ready_for_feasibility
                  ? "bg-success/10 text-success"
                  : "bg-warning/10 text-warning",
              )}
            >
              {readiness.ready_for_feasibility ? "Ready" : "Blocked"}
            </span>
          )}
        </div>
        {readiness?.blockers[0] && (
          <p className="mt-2 text-xs text-critical">{readiness.blockers[0].message}</p>
        )}
        {!readiness?.blockers[0] && readiness?.warnings[0] && (
          <p className="mt-2 text-xs text-warning">{readiness.warnings[0].message}</p>
        )}
        {readiness && (
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-ghost">
            <span>{readiness.drafts.total} drafts</span>
            <span>{readiness.drafts.materialized} materialized</span>
            <span>{readiness.drafts.linked} linked</span>
          </div>
        )}
      </div>

      {materializedConceptSets.length === 0 && (
        <p className="text-xs text-text-ghost">
          Materialize at least one verified concept set draft first.
        </p>
      )}

      {drafts.length === 0 && (
        <div className="rounded-md border border-border-default bg-surface-base p-3 text-sm text-text-muted">
          No cohort drafts yet.
        </div>
      )}

      {drafts.map((asset) => (
        <CohortDraftCard
          key={asset.id}
          asset={asset}
          isReviewing={isReviewing}
          isVerifying={isVerifying}
          isMaterializing={isMaterializing}
          isLinking={isLinking}
          onReview={onReview}
          onVerify={onVerify}
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
  isMaterializing,
  isLinking,
  onReview,
  onVerify,
  onMaterialize,
  onLink,
}: {
  asset: StudyDesignAsset;
  isReviewing: boolean;
  isVerifying: boolean;
  isMaterializing: boolean;
  isLinking: boolean;
  onReview: (asset: StudyDesignAsset, decision: "accept" | "reject" | "defer") => void;
  onVerify: (asset: StudyDesignAsset) => void;
  onMaterialize: (asset: StudyDesignAsset) => void;
  onLink: (asset: StudyDesignAsset) => void;
}) {
  const [expanded, setExpanded] = useState(asset.verification_status !== "verified");
  const payload = asset.draft_payload_json;
  const verified = asset.verification_status === "verified";
  const accepted = asset.status === "accepted";
  const materialized = asset.status === "materialized" && asset.materialized_id != null;
  const studyCohortId = typeof asset.provenance_json?.study_cohort_id === "number" ? asset.provenance_json.study_cohort_id : null;
  const verification = asset.verification_json;
  const blockers = verification?.blocking_reasons ?? [];
  const warnings = verification?.warnings ?? [];
  const conceptSetIds = payload.concept_set_ids ?? [];

  return (
    <div className="rounded-lg border border-border-default bg-surface-base px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-success/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success">
              cohort draft
            </span>
            <VerificationBadge status={asset.verification_status} />
            <span className="text-[10px] text-text-muted">{asset.status}</span>
            {payload.role && <span className="text-[10px] text-text-ghost">{String(payload.role)}</span>}
          </div>
          <p className="mt-1 text-sm font-medium text-text-secondary">
            {payload.title ?? `Cohort draft #${asset.id}`}
          </p>
          {payload.logic_description && (
            <p className="mt-1 text-xs text-text-muted line-clamp-2">{payload.logic_description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-ghost">
            <span>{conceptSetIds.length} concept sets</span>
            {materialized && <span>Native cohort #{asset.materialized_id}</span>}
            {studyCohortId != null && <span>Linked study cohort #{studyCohortId}</span>}
          </div>
          {blockers.length > 0 && <p className="mt-2 text-xs text-critical">{blockers[0]}</p>}
          {blockers.length === 0 && warnings.length > 0 && <p className="mt-2 text-xs text-warning">{warnings[0]}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {!materialized && asset.verification_status === "unverified" && (
            <button type="button" onClick={() => onVerify(asset)} disabled={isVerifying} className="btn btn-ghost btn-sm">
              Verify
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
                Accept
              </button>
              <button type="button" onClick={() => onReview(asset, "defer")} disabled={isReviewing} className="btn btn-ghost btn-sm">
                Defer
              </button>
              <button type="button" onClick={() => onReview(asset, "reject")} disabled={isReviewing} className="btn btn-ghost btn-sm">
                Reject
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
              Materialize
            </button>
          )}
          {materialized && (
            <>
              {studyCohortId == null && (
                <button
                  type="button"
                  onClick={() => onLink(asset)}
                  disabled={isLinking}
                  className="btn btn-primary btn-sm"
                >
                  Link to Study
                </button>
              )}
              <a href={`/cohort-definitions/${asset.materialized_id}`} className="btn btn-ghost btn-sm">
                Open Native Editor
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
        Lint
      </button>

      {expanded && (
        <div className="mt-3 border-t border-border-default pt-3">
          <div className="space-y-1">
            {(verification?.checks ?? []).map((check) => (
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
  isRunning,
  onRun,
}: {
  assets: StudyDesignAsset[];
  readiness: StudyCohortReadiness | null;
  isRunning: boolean;
  onRun: (sourceIds: number[], minCellCount: number) => void;
}) {
  const { data: sources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });
  const [selectedSourceIds, setSelectedSourceIds] = useState<number[]>([]);
  const [minCellCount, setMinCellCount] = useState(5);
  const selectedIds = selectedSourceIds.length > 0 ? selectedSourceIds : sources[0] ? [sources[0].id] : [];
  const feasibilityAsset = assets
    .filter((asset) => asset.asset_type === "feasibility_result")
    .sort((left, right) => right.id - left.id)[0];
  const feasibility = feasibilityAsset?.draft_payload_json as unknown as StudyFeasibilityResult | undefined;
  const canRun = selectedIds.length > 0 && readiness?.ready_for_feasibility === true;
  const attritionSources = feasibility?.sources.filter((source) =>
    source.cohorts.some((cohort) => (cohort.attrition ?? []).length > 0),
  ) ?? [];

  const toggleSource = (source: Source) => {
    setSelectedSourceIds((current) => {
      const active = current.length > 0 ? current : sources[0] ? [sources[0].id] : [];
      return active.includes(source.id)
        ? active.filter((id) => id !== source.id)
        : [...active, source.id];
    });
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">Feasibility</p>
          <p className="text-xs text-text-ghost">
            Check linked cohorts against selected CDM sources before analysis planning.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRun(selectedIds, minCellCount)}
          disabled={!canRun || isRunning}
          className="btn btn-primary btn-sm shrink-0"
        >
          {isRunning ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Run Feasibility
        </button>
      </div>

      {readiness && !readiness.ready_for_feasibility && (
        <p className="text-xs text-warning">
          Link required study cohorts before source feasibility.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-ghost">Sources</p>
          {sourcesLoading ? (
            <p className="text-xs text-text-muted">Loading sources...</p>
          ) : sources.length === 0 ? (
            <p className="text-xs text-text-muted">No CDM sources configured.</p>
          ) : (
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
          )}
        </div>
        <label className="text-xs text-text-muted">
          Small-cell threshold
          <input
            type="number"
            min={1}
            max={100}
            value={minCellCount}
            onChange={(event) => setMinCellCount(Number(event.target.value) || 5)}
            className="form-input mt-1 w-24"
          />
        </label>
      </div>

      {feasibility ? (
        <div className="border-t border-border-default pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-text-secondary">
                {feasibility.ready_source_count}/{feasibility.source_count} sources ready
              </p>
              <p className="text-[11px] text-text-ghost">
                Ran {new Date(feasibility.ran_at).toLocaleString()}
              </p>
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
          {feasibility.blockers[0] && (
            <p className="mt-2 text-xs text-critical">{feasibility.blockers[0].message}</p>
          )}
          {!feasibility.blockers[0] && feasibility.warnings[0] && (
            <p className="mt-2 text-xs text-warning">{feasibility.warnings[0].message}</p>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-text-ghost">
                <tr>
                  <th className="py-1 pr-3 font-medium">Source</th>
                  <th className="py-1 pr-3 font-medium">Status</th>
                  <th className="py-1 pr-3 font-medium">Cohorts</th>
                  <th className="py-1 pr-3 font-medium">Coverage</th>
                  <th className="py-1 pr-3 font-medium">Domains</th>
                  <th className="py-1 pr-3 font-medium">Freshness</th>
                  <th className="py-1 pr-3 font-medium">DQD</th>
                </tr>
              </thead>
              <tbody>
                {feasibility.sources.map((source) => (
                  <tr key={source.source_id} className="border-t border-border-default">
                    <td className="py-2 pr-3 text-text-secondary">{source.source_name}</td>
                    <td className="py-2 pr-3">
                      <span className={source.ready_for_analysis ? "text-success" : "text-warning"}>
                        {source.ready_for_analysis ? "Ready" : "Review"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-text-muted">
                      {source.cohorts.map((cohort) => (
                        <span key={cohort.study_cohort_id} className="mr-2 inline-block">
                          {cohort.role}: {cohort.person_count_suppressed ? `<${feasibility.min_cell_count}` : cohort.person_count ?? "none"}
                        </span>
                      ))}
                    </td>
                    <td className="py-2 pr-3 text-text-muted">
                      <span className="block">
                        {source.coverage?.date_coverage.start_date && source.coverage.date_coverage.end_date
                          ? `${source.coverage.date_coverage.start_date} to ${source.coverage.date_coverage.end_date}`
                          : "No dates"}
                      </span>
                      <span className="block text-[11px] text-text-ghost">
                        OP: {source.coverage?.observation_period.record_count ?? "none"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-text-muted">
                      {source.domain_availability
                        ? `${source.domain_availability.available_role_count}/${source.domain_availability.role_count} roles`
                        : "Unknown"}
                    </td>
                    <td className="py-2 pr-3 text-text-muted">
                      {!source.coverage || source.coverage.freshness.status === "unknown"
                        ? "Unknown"
                        : `${source.coverage.freshness.status}${source.coverage.freshness.days_since_release == null ? "" : ` (${source.coverage.freshness.days_since_release}d)`}`}
                    </td>
                    <td className="py-2 pr-3 text-text-muted">
                      {source.source_quality.dqd.pass_rate == null
                        ? "No DQD"
                        : `${source.source_quality.dqd.pass_rate}% pass`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {attritionSources.length > 0 && (
            <div className="mt-4 border-t border-border-default pt-3">
              <p className="text-xs font-semibold text-text-secondary">Attrition</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {attritionSources.map((source) => (
                  <div key={source.source_id} className="border-l border-border-default pl-3">
                    <p className="text-xs font-semibold text-text-secondary">{source.source_name}</p>
                    <div className="mt-2 space-y-1">
                      {source.cohorts.map((cohort) => (
                        <div key={cohort.study_cohort_id} className="text-[11px] text-text-muted">
                          <span className="font-medium text-text-secondary">{cohort.role}</span>
                          {(cohort.attrition ?? []).map((step) => (
                            <span key={`${cohort.study_cohort_id}-${step.name}`} className="ml-2 inline-block">
                              {step.name}: {step.person_count_suppressed ? `<${feasibility.min_cell_count}` : step.person_count ?? "none"}
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
          No feasibility evidence has been stored for this design version.
        </p>
      )}
    </div>
  );
}

function AnalysisPlanPanel({
  assets,
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
  isGenerating: boolean;
  isReviewing: boolean;
  isVerifying: boolean;
  isMaterializing: boolean;
  onGenerate: () => void;
  onReview: (asset: StudyDesignAsset, decision: "accept" | "reject" | "defer") => void;
  onVerify: (asset: StudyDesignAsset) => void;
  onMaterialize: (asset: StudyDesignAsset) => void;
}) {
  const plans = assets
    .filter((asset) => asset.asset_type === "analysis_plan")
    .sort((left, right) => (right.rank_score ?? -1) - (left.rank_score ?? -1) || right.id - left.id);
  const latestFeasibility = assets
    .filter((asset) => asset.asset_type === "feasibility_result")
    .sort((left, right) => right.id - left.id)[0];
  const canGenerate = latestFeasibility != null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">Analysis Plans</p>
          <p className="text-xs text-text-ghost">
            Compile feasible study cohorts into native HADES-compatible analysis designs.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          className="btn btn-primary btn-sm shrink-0"
        >
          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Draft Plans
        </button>
      </div>

      {!canGenerate && (
        <p className="text-xs text-text-ghost">
          Run source feasibility before drafting analysis plans.
        </p>
      )}

      {plans.length === 0 ? (
        <div className="rounded-md border border-border-default bg-surface-base p-3 text-sm text-text-muted">
          No analysis plans yet.
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map((asset) => {
            const payload = asset.draft_payload_json as unknown as Partial<StudyAnalysisPlanDraft>;
            const blockers = asset.verification_json?.blocking_reasons ?? [];
            const warnings = asset.verification_json?.warnings ?? [];
            const verified = asset.verification_status === "verified";
            const accepted = asset.status === "accepted";
            const materialized = asset.status === "materialized" && asset.materialized_id != null;
            const analysisPath = analysisDetailPath(payload.analysis_type, asset.materialized_id);

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
                      {payload.title ?? `Analysis plan #${asset.id}`}
                    </p>
                    {payload.description && (
                      <p className="mt-1 text-xs text-text-muted line-clamp-2">{payload.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-ghost">
                      <span>{payload.hades_package ?? "HADES"}</span>
                      <span>{payload.hades_capability?.installed ? "installed" : "missing"}</span>
                      <span>Feasibility: {payload.feasibility?.status ?? "unknown"}</span>
                      {materialized && analysisPath && (
                        <a href={analysisPath} className="text-success hover:text-success-light">
                          Native analysis #{asset.materialized_id}
                        </a>
                      )}
                      {materialized && !analysisPath && <span>Native analysis #{asset.materialized_id}</span>}
                    </div>
                    {blockers[0] && <p className="mt-2 text-xs text-critical">{blockers[0]}</p>}
                    {!blockers[0] && warnings[0] && <p className="mt-2 text-xs text-warning">{warnings[0]}</p>}
                  </div>

                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {!materialized && asset.verification_status === "unverified" && (
                      <button
                        type="button"
                        onClick={() => onVerify(asset)}
                        disabled={isVerifying}
                        className="btn btn-ghost btn-sm"
                      >
                        Verify
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
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => onReview(asset, "defer")}
                          disabled={isReviewing}
                          className="btn btn-ghost btn-sm"
                        >
                          Defer
                        </button>
                      </>
                    )}
                    {!materialized && accepted && (
                      <button
                        type="button"
                        onClick={() => onMaterialize(asset)}
                        disabled={isMaterializing}
                        className="btn btn-primary btn-sm"
                      >
                        Materialize
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

function DesignLockPanel({
  readiness,
  isLoading,
  isLocking,
  versionStatus,
  onLock,
}: {
  readiness: StudyDesignLockReadiness | null;
  isLoading: boolean;
  isLocking: boolean;
  versionStatus: string;
  onLock: () => void;
}) {
  const blockers = readiness?.blockers ?? [];
  const warnings = readiness?.warnings ?? [];
  const summary = readiness?.summary;
  const provenance = readiness?.provenance_summary;
  const packageArtifact = readiness?.package_artifact;
  const locked = readiness?.locked === true || versionStatus === "locked";
  const canLock = readiness?.can_lock === true && !locked;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">Package Lock</p>
          <p className="text-xs text-text-ghost">
            Freeze accepted intent, concept sets, cohorts, feasibility, and native analyses into an auditable study package.
          </p>
        </div>
        <button
          type="button"
          onClick={onLock}
          disabled={!canLock || isLocking || isLoading}
          className="btn btn-primary btn-sm shrink-0"
        >
          {isLocking ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
          {locked ? "Locked" : "Lock Package"}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-5">
        <EvidenceMetric label="Concept Sets" value={summary?.materialized_concept_sets ?? 0} tone={summary?.materialized_concept_sets ? "success" : "warning"} />
        <EvidenceMetric label="Cohorts" value={summary?.linked_cohorts ?? 0} tone={summary?.linked_cohorts ? "success" : "warning"} />
        <EvidenceMetric label="Feasibility" value={summary?.feasibility_status ?? "missing"} tone={summary?.feasibility_status === "ready" ? "success" : "warning"} />
        <EvidenceMetric label="Analyses" value={summary?.materialized_analysis_plans ?? 0} tone={summary?.materialized_analysis_plans ? "success" : "warning"} />
        <EvidenceMetric label="Packages" value={summary?.package_assets ?? 0} tone={locked ? "success" : "warning"} />
      </div>

      {isLoading && (
        <p className="text-xs text-text-ghost">Checking package readiness...</p>
      )}

      {!isLoading && blockers[0] && (
        <p className="text-xs text-critical">{blockers[0].message}</p>
      )}

      {!isLoading && !blockers[0] && warnings[0] && (
        <p className="text-xs text-warning">{warnings[0].message}</p>
      )}

      {!isLoading && readiness?.status === "ready" && (
        <p className="text-xs text-success">Ready to lock.</p>
      )}

      {!isLoading && locked && (
        <div className="space-y-2">
          <p className="text-xs text-success">Locked package is available in study artifacts.</p>
          {packageArtifact?.url && (
            <a href={packageArtifact.url} className="btn btn-ghost btn-sm inline-flex">
              Download package summary
            </a>
          )}
        </div>
      )}

      {provenance && (
        <div className="grid gap-2 sm:grid-cols-4">
          <EvidenceMetric label="AI Events" value={provenance.ai_events ?? 0} tone="neutral" />
          <EvidenceMetric label="Reviewed" value={provenance.reviewed_assets ?? 0} tone="neutral" />
          <EvidenceMetric label="Verified" value={provenance.verified_assets ?? 0} tone="success" />
          <EvidenceMetric label="Manifest" value={provenance.package_manifest_sha256 ? "signed" : "pending"} tone={provenance.package_manifest_sha256 ? "success" : "neutral"} />
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
  const importedAssets = assets.filter((asset) => asset.asset_type.startsWith("imported_"));
  const critiqueAssets = assets.filter((asset) => asset.asset_type === "design_critique");
  const latestCritique = critiqueAssets[0]?.draft_payload_json as { message?: string; severity?: string; code?: string } | undefined;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">Current Study Assets</p>
          <p className="text-xs text-text-ghost">
            Bring manually built cohorts and analyses into this design path, then review gaps without changing existing records.
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
            Import Current
          </button>
          <button
            type="button"
            onClick={onCritique}
            disabled={isCritiquing || !canCritique}
            className="btn btn-primary btn-sm"
          >
            {isCritiquing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Critique
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <EvidenceMetric label="Imported" value={importedAssets.length} tone={importedAssets.length > 0 ? "success" : "neutral"} />
        <EvidenceMetric label="Critiques" value={critiqueAssets.length} tone={critiqueAssets.length > 0 ? "warning" : "neutral"} />
        <EvidenceMetric label="Blocked" value={critiqueAssets.filter((asset) => asset.draft_payload_json.severity === "blocking").length} tone="critical" />
      </div>

      {latestCritique?.message && (
        <p className={cn("text-xs", latestCritique.severity === "blocking" ? "text-critical" : "text-warning")}>
          {latestCritique.message}
        </p>
      )}

      {importedAssets.length > 0 && (
        <div className="flex flex-wrap gap-2 text-[10px] text-text-ghost">
          {importedAssets.slice(0, 6).map((asset) => (
            <span key={asset.id} className="rounded-md border border-border-default px-2 py-1">
              {asset.asset_type.replace("imported_", "").replace(/_/g, " ")}
              {asset.role ? ` · ${asset.role}` : ""}
            </span>
          ))}
        </div>
      )}
    </div>
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

function RecommendationCard({
  asset,
  isReviewing,
  onReview,
}: {
  asset: StudyDesignAsset;
  isReviewing: boolean;
  onReview: (asset: StudyDesignAsset, decision: "accept" | "reject" | "defer") => void;
}) {
  const [expanded, setExpanded] = useState(asset.verification_status !== "verified");
  const payload = asset.draft_payload_json;
  const score = typeof payload.score === "number" ? Math.round(payload.score * 100) : null;
  const rankScore = typeof asset.rank_score === "number" ? Math.round(asset.rank_score) : null;
  const typeLabel = asset.asset_type.replace(/_/g, " ");
  const reviewed = ["accepted", "rejected", "deferred"].includes(asset.status);
  const verified = asset.verification_status === "verified";
  const verification = asset.verification_json;
  const verificationChecks = verification?.checks ?? [];
  const blockers = verification?.blocking_reasons ?? [];
  const warnings = verification?.warnings ?? [];
  const rawSource = verification?.source_summary?.source ?? asset.rank_score_json?.source ?? asset.provenance_json?.source;
  const source = rawSource == null ? null : String(rawSource);
  const acceptDisabledReason = verified
    ? null
    : verification?.eligibility?.reason ?? "Only deterministically verified recommendations can be accepted.";

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
                Rank {rankScore}
              </span>
            )}
            {score != null && <span className="text-[10px] text-text-ghost">{score}% match</span>}
            <VerificationBadge status={asset.verification_status} />
            {asset.status !== "needs_review" && (
              <span className="text-[10px] text-text-muted">{asset.status}</span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-text-secondary">
            {payload.title ?? `Recommendation #${asset.id}`}
          </p>
          {payload.description && (
            <p className="mt-1 text-xs text-text-muted line-clamp-2">{payload.description}</p>
          )}
          {payload.rationale && (
            <p className="mt-1 text-xs text-text-ghost">{payload.rationale}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-text-ghost">
            {source && <span>{sourceLabel(source)}</span>}
            {payload.external_id != null && <span>OHDSI #{String(payload.external_id)}</span>}
            {payload.domain && <span>{String(payload.domain)}</span>}
            {payload.has_expression === true && <span>Computable</span>}
            {payload.is_imported === true && <span>Imported</span>}
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
        </div>

        {!reviewed && (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => onReview(asset, "accept")}
              disabled={isReviewing || !verified}
              title={acceptDisabledReason ?? undefined}
              className="btn btn-primary btn-sm"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => onReview(asset, "defer")}
              disabled={isReviewing}
              className="btn btn-ghost btn-sm"
            >
              Defer
            </button>
            <button
              type="button"
              onClick={() => onReview(asset, "reject")}
              disabled={isReviewing}
              className="btn btn-ghost btn-sm"
            >
              Reject
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
        Evidence
      </button>

      {expanded && (
        <div className="mt-3 border-t border-border-default pt-3">
          <div className="grid gap-3 md:grid-cols-2">
            <EvidenceBlock title="Source">
              <EvidenceLine label="Origin" value={source ? sourceLabel(source) : "Unknown"} />
              <EvidenceLine label="Matched term" value={verification?.source_summary?.matched_term ?? null} />
              <EvidenceLine label="Canonical record" value={verification?.canonical_summary?.title ?? "No canonical record"} />
            </EvidenceBlock>
            <EvidenceBlock title="Governance">
              <EvidenceLine label="Eligibility" value={verification?.eligibility?.can_accept ? "Acceptable" : "Blocked or needs review"} />
              <EvidenceLine label="Policy" value={verification?.acceptance_policy ?? asset.rank_score_json?.policy ?? null} />
              <EvidenceLine label="Next actions" value={(verification?.accepted_downstream_actions ?? []).join(", ")} />
            </EvidenceBlock>
          </div>

          {asset.rank_score_json?.components && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider text-text-ghost">Rank components</p>
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
              <p className="text-[10px] uppercase tracking-wider text-text-ghost">Verifier checks</p>
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
  const label = status === "verified"
    ? "Verified"
    : status === "partial"
      ? "Needs check"
      : status === "blocked"
        ? "Blocked"
        : "Unverified";
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

function formatRankComponent(value: number): string {
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
      invalid_reason: concept.invalid_reason,
    },
  };
}

function conceptDraftPayload(asset: StudyDesignAsset, concepts: StudyDesignDraftConcept[]) {
  const payload = asset.draft_payload_json;

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
  const [formState, setFormState] = useState(initialFormState);
  const lint = version.lint_results_json;
  const isImmutable = ["accepted", "compiled", "locked"].includes(version.status);
  const isReady = lint?.status === "ready";

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-secondary">Intent Review</p>
          <p className="text-xs text-text-ghost">Version {version.version_number} · {version.status}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSave(formState)}
            disabled={isSaving || isImmutable}
            className="btn btn-ghost btn-sm"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Review
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={isAccepting || isImmutable || !isReady}
            className="btn btn-primary btn-sm"
          >
            {isAccepting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Accept Intent
          </button>
        </div>
      </div>

      {lint && lint.issues.length > 0 && (
        <div className="space-y-2">
          {lint.issues.map((issue, index) => (
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
        <Field label="Primary Objective" value={formState.primaryObjective} onChange={(value) => setFormState({ ...formState, primaryObjective: value })} />
        <Field label="Population" value={formState.population} onChange={(value) => setFormState({ ...formState, population: value })} />
        <Field label="Exposure" value={formState.exposure} onChange={(value) => setFormState({ ...formState, exposure: value })} />
        <Field label="Comparator" value={formState.comparator} onChange={(value) => setFormState({ ...formState, comparator: value })} />
        <Field label="Primary Outcome" value={formState.outcome} onChange={(value) => setFormState({ ...formState, outcome: value })} />
        <Field label="Time At Risk" value={formState.time} onChange={(value) => setFormState({ ...formState, time: value })} />
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        className="form-input form-textarea"
      />
    </div>
  );
}

function specToForm(spec: StudyDesignSpec): IntentFormState {
  return {
    researchQuestion: spec.study.research_question ?? "",
    primaryObjective: spec.study.primary_objective ?? "",
    population: spec.pico.population?.summary ?? "",
    exposure: spec.pico.intervention_or_exposure?.summary ?? "",
    comparator: spec.pico.comparator?.summary ?? "",
    outcome: spec.pico.outcomes?.[0]?.summary ?? "",
    time: spec.pico.time?.summary ?? "",
  };
}

function formToSpec(spec: StudyDesignSpec, form: IntentFormState, study: Study): StudyDesignSpec {
  return {
    ...spec,
    study: {
      ...spec.study,
      title: spec.study.title || study.title,
      short_title: spec.study.short_title ?? study.short_title,
      research_question: form.researchQuestion || spec.study.research_question || study.primary_objective || "",
      primary_objective: form.primaryObjective,
      study_design: spec.study.study_design || study.study_design || "observational",
      study_type: spec.study.study_type || study.study_type || "custom",
      target_population_summary: form.population,
    },
    pico: {
      ...spec.pico,
      population: { ...(spec.pico.population ?? {}), summary: form.population },
      intervention_or_exposure: { ...(spec.pico.intervention_or_exposure ?? {}), summary: form.exposure },
      comparator: { ...(spec.pico.comparator ?? {}), summary: form.comparator },
      outcomes: [{ ...(spec.pico.outcomes?.[0] ?? {}), summary: form.outcome, primary: true }],
      time: { ...(spec.pico.time ?? {}), summary: form.time },
    },
  };
}

function mutationError(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Study design request failed.";
}
