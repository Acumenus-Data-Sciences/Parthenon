import { type Ref } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Brain, Loader2, Lock, Plus, Sparkles, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { StudyDesignLockPanel } from "./StudyDesignLockPanel";
import { ProtocolImportProgress } from "./ProtocolImportProgress";
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
  mutationError,
  specToForm,
  versionSpec,
} from "./workbench/studyDesignWorkbenchHelpers";
import type { Study } from "../types/study";
import { useStudyDesignWorkbench } from "../hooks/useStudyDesignWorkbench";
import { tAuto } from "@/i18n/autoUserFacing";

interface StudyDesignWorkbenchProps {
  study: Study;
  /** Optional ref forwarded to the workbench title heading for focus management. */
  headingRef?: Ref<HTMLHeadingElement>;
}

export function StudyDesignWorkbench({ study, headingRef }: StudyDesignWorkbenchProps) {
  const { t } = useTranslation("app");
  const wb = useStudyDesignWorkbench(study);
  const {
    slug,
    researchQuestion,
    setResearchQuestion,
    setSelectedSessionId,
    protocolFileName,
    lockConfirmOpen,
    setLockConfirmOpen,
    lockGateMessage,
    setIntentReviewDirty,
    protocolInputRef,
    sessionsQuery,
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
  } = wb;

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
            aria-label={tAuto("uploadProtocolFile_bfb9c791")}
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
