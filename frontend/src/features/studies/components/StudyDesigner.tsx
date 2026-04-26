import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileJson,
  GitBranch,
  Loader2,
  Lock,
  PackageCheck,
  Plus,
  Save,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { formatDateTime } from "@/i18n/format";
import { cn } from "@/lib/utils";
import type { Study, StudyAnalysisEntry, StudyDesignAsset, StudyDesignVersion } from "../types/study";
import {
  useUpdateStudy,
  useAddStudyAnalysis,
  useRemoveStudyAnalysis,
  useStudyAnalyses,
  useAcceptStudyDesignVersion,
  useCreateStudyDesignSession,
  useCritiqueStudyDesignVersion,
  useGenerateStudyDesignIntent,
  useImportStudyDesignProtocol,
  useImportExistingStudyDesign,
  useLockStudyDesignVersion,
  useStudyDesignAssets,
  useStudyDesignLockReadiness,
  useStudyDesignSessions,
  useStudyDesignVersions,
  useUpdateStudyDesignVersion,
} from "../hooks/useStudies";
import { useCharacterizations } from "@/features/analyses/hooks/useCharacterizations";
import { useIncidenceRates } from "@/features/analyses/hooks/useIncidenceRates";
import { usePathways } from "@/features/pathways/hooks/usePathways";
import { useEstimations } from "@/features/estimation/hooks/useEstimations";
import { usePredictions } from "@/features/prediction/hooks/usePredictions";

const STUDY_TYPES = [
  "characterization",
  "population_level_estimation",
  "patient_level_prediction",
  "drug_utilization",
  "quality_improvement",
  "comparative_effectiveness",
  "safety_surveillance",
  "custom",
];

const ANALYSIS_TYPES = [
  "characterization",
  "incidence-rate",
  "pathway",
  "estimation",
  "prediction",
];

interface StudyDesignerProps {
  study: Study;
}

interface IntentReviewState {
  researchQuestion: string;
  primaryObjective: string;
  population: string;
  exposure: string;
  comparator: string;
  outcome: string;
  timeAtRisk: string;
  studyType: string;
  studyDesign: string;
  hypothesis: string;
}

interface BasicInfoState {
  studySignature: string;
  title: string;
  description: string;
  studyType: string;
}

interface IntentReviewFormState {
  versionSignature: string;
  values: IntentReviewState;
}

export function StudyDesigner({ study }: StudyDesignerProps) {
  const { t } = useTranslation("app");
  const protocolInputRef = useRef<HTMLInputElement | null>(null);
  const currentBasicInfo = studyToBasicInfoState(study);
  const [basicInfoState, setBasicInfoState] = useState<BasicInfoState>(currentBasicInfo);

  const [addType, setAddType] = useState("characterization");
  const [addId, setAddId] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [optimisticVersion, setOptimisticVersion] = useState<StudyDesignVersion | null>(null);
  const [researchQuestion, setResearchQuestion] = useState(
    study.primary_objective || study.description || study.title || "",
  );

  const updateMutation = useUpdateStudy();
  const addAnalysisMutation = useAddStudyAnalysis();
  const removeAnalysisMutation = useRemoveStudyAnalysis();
  const createDesignSession = useCreateStudyDesignSession();
  const generateIntent = useGenerateStudyDesignIntent();
  const importProtocol = useImportStudyDesignProtocol();
  const importExistingDesign = useImportExistingStudyDesign();
  const updateDesignVersion = useUpdateStudyDesignVersion();
  const critiqueDesign = useCritiqueStudyDesignVersion();
  const acceptDesign = useAcceptStudyDesignVersion();
  const lockDesign = useLockStudyDesignVersion();

  const { data: studyAnalyses } = useStudyAnalyses(study.slug);
  const { data: designSessions } = useStudyDesignSessions(study.slug);
  const activeSession = designSessions?.find((session) => session.id === selectedSessionId) ?? designSessions?.[0] ?? null;
  const { data: designVersions } = useStudyDesignVersions(study.slug, activeSession?.id ?? null);
  const activeVersion = designVersions?.find((version) => version.id === selectedVersionId)
    ?? (optimisticVersion?.id === selectedVersionId ? optimisticVersion : null)
    ?? designVersions?.[0]
    ?? activeSession?.active_version
    ?? null;
  const { data: designAssets } = useStudyDesignAssets(study.slug, activeSession?.id ?? null);
  const { data: lockReadiness } = useStudyDesignLockReadiness(
    study.slug,
    activeSession?.id ?? null,
    activeVersion?.id ?? null,
  );

  const { data: charData } = useCharacterizations(1);
  const { data: irData } = useIncidenceRates(1);
  const { data: pathwayData } = usePathways(1);
  const { data: estData } = useEstimations(1);
  const { data: predData } = usePredictions(1);

  const intentReview = useMemo(
    () => versionToIntentReview(activeVersion, study),
    [activeVersion, study],
  );
  const intentReviewSignature = useMemo(
    () => versionReviewSignature(activeVersion, study),
    [activeVersion, study],
  );
  const [reviewFormState, setReviewFormState] = useState<IntentReviewFormState>({
    versionSignature: intentReviewSignature,
    values: intentReview,
  });

  if (basicInfoState.studySignature !== currentBasicInfo.studySignature) {
    setBasicInfoState(currentBasicInfo);
  }

  if (reviewFormState.versionSignature !== intentReviewSignature) {
    setReviewFormState({
      versionSignature: intentReviewSignature,
      values: intentReview,
    });
  }

  const title = basicInfoState.title;
  const description = basicInfoState.description;
  const studyType = basicInfoState.studyType;
  const reviewState = reviewFormState.values;
  const setTitle = (value: string) => setBasicInfoState((state) => ({ ...state, title: value }));
  const setDescription = (value: string) => setBasicInfoState((state) => ({ ...state, description: value }));
  const setStudyType = (value: string) => setBasicInfoState((state) => ({ ...state, studyType: value }));
  const setReviewState = (values: IntentReviewState) => {
    setReviewFormState((state) => ({ ...state, values }));
  };

  const getAnalysisOptions = () => {
    switch (addType) {
      case "characterization":
        return charData?.items?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "incidence-rate":
        return irData?.items?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "pathway":
        return (
          pathwayData?.items?.map((a) => ({ id: a.id, name: a.name })) ?? []
        );
      case "estimation":
        return estData?.items?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "prediction":
        return predData?.items?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      default:
        return [];
    }
  };

  const handleSave = () => {
    if (!title.trim()) return;
    updateMutation.mutate({
      idOrSlug: study.slug || study.id,
      payload: {
        title: title.trim(),
        description: description.trim(),
        study_type: studyType,
      },
    });
  };

  const handleAddAnalysis = () => {
    if (!addId) return;
    addAnalysisMutation.mutate(
      {
        slug: study.slug,
        payload: { analysis_type: addType, analysis_id: addId },
      },
      {
        onSuccess: () => setAddId(null),
      },
    );
  };

  const handleRemoveAnalysis = (entry: StudyAnalysisEntry) => {
    removeAnalysisMutation.mutate({
      slug: study.slug,
      entryId: entry.id,
    });
  };

  const ensureDesignSession = async (sourceMode = "study_designer") => {
    if (activeSession) return activeSession;
    const session = await createDesignSession.mutateAsync({
      slug: study.slug,
      payload: {
        title: t("studies.designer.defaultSessionTitle", { title: study.title }),
        source_mode: sourceMode,
      },
    });
    setSelectedSessionId(session.id);
    return session;
  };

  const handleGenerateIntent = async () => {
    if (!researchQuestion.trim()) return;
    const session = await ensureDesignSession();
    const version = await generateIntent.mutateAsync({
      slug: study.slug,
      sessionId: session.id,
      researchQuestion: researchQuestion.trim(),
    });
    setOptimisticVersion(version);
    setSelectedVersionId(version.id);
  };

  const handleProtocolUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const session = await ensureDesignSession("protocol_upload");
    const version = await importProtocol.mutateAsync({
      slug: study.slug,
      sessionId: session.id,
      file,
    });
    const nextReview = versionToIntentReview(version, study);
    setOptimisticVersion(version);
    setSelectedVersionId(version.id);
    setResearchQuestion(nextReview.researchQuestion || researchQuestion);
    setReviewFormState({
      versionSignature: versionReviewSignature(version, study),
      values: nextReview,
    });
  };

  const handleImportExisting = async () => {
    const session = await ensureDesignSession();
    const version = await importExistingDesign.mutateAsync({
      slug: study.slug,
      sessionId: session.id,
    });
    setOptimisticVersion(version);
    setSelectedVersionId(version.id);
  };

  const handleSaveIntentReview = () => {
    if (!activeSession || !activeVersion) return;

    updateDesignVersion.mutate(
      {
        slug: study.slug,
        sessionId: activeSession.id,
        versionId: activeVersion.id,
        payload: intentReviewPayload(activeVersion, reviewState, study),
      },
      {
        onSuccess: (version) => {
          setSelectedVersionId(version.id);
          setResearchQuestion(reviewState.researchQuestion);
        },
      },
    );
  };

  const handleCritique = () => {
    if (!activeSession || !activeVersion) return;
    critiqueDesign.mutate({
      slug: study.slug,
      sessionId: activeSession.id,
      versionId: activeVersion.id,
    });
  };

  const handleAcceptDesign = () => {
    if (!activeSession || !activeVersion) return;
    acceptDesign.mutate({
      slug: study.slug,
      sessionId: activeSession.id,
      versionId: activeVersion.id,
    });
  };

  const handleLockDesign = () => {
    if (!activeSession || !activeVersion) return;
    lockDesign.mutate({
      slug: study.slug,
      sessionId: activeSession.id,
      versionId: activeVersion.id,
    });
  };

  const isSaving = updateMutation.isPending;
  const designBusy = createDesignSession.isPending
    || generateIntent.isPending
    || importProtocol.isPending
    || importExistingDesign.isPending
    || updateDesignVersion.isPending
    || critiqueDesign.isPending
    || acceptDesign.isPending
    || lockDesign.isPending;
  const analysisOptions = getAnalysisOptions();
  const versionAssets = (designAssets ?? []).filter((asset) => asset.version_id === activeVersion?.id);
  const designAssetCounts = summarizeDesignAssets(versionAssets);
  const blockedAssets = versionAssets.filter((asset) => asset.verification_status === "blocked");
  const packageSha = asString(lockReadiness?.provenance_summary?.package_manifest_sha256);
  const activeError = mutationError(createDesignSession.error)
    || mutationError(generateIntent.error)
    || mutationError(importProtocol.error)
    || mutationError(updateDesignVersion.error)
    || mutationError(importExistingDesign.error)
    || mutationError(critiqueDesign.error)
    || mutationError(acceptDesign.error)
    || mutationError(lockDesign.error)
    || mutationError(updateMutation.error)
    || mutationError(addAnalysisMutation.error)
    || mutationError(removeAnalysisMutation.error);

  return (
    <div className="space-y-6">
      <div className="panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bot size={18} style={{ color: "var(--accent)" }} />
              <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
                {t("studies.designer.title")}
              </h3>
            </div>
            <p className="mt-2 max-w-3xl" style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              {t("studies.designer.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-info">
              {t("studies.designer.badges.session", {
                value: activeSession?.id ?? t("studies.designer.messages.new"),
              })}
            </span>
            <span className="badge badge-success">
              {t("studies.designer.badges.version", {
                value: activeVersion?.version_number ?? t("studies.designer.messages.none"),
              })}
            </span>
            <span className={cn("badge", activeVersion?.status === "locked" ? "badge-critical" : "badge-warning")}>
              {activeVersion?.status
                ? t(`studies.designer.versionStatuses.${activeVersion.status}`, {
                  defaultValue: humanize(activeVersion.status),
                })
                : t("studies.designer.messages.notStarted")}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
          <div className="space-y-3">
            <div>
              <label className="form-label">{t("studies.workbench.researchQuestion")}</label>
              <textarea
                value={researchQuestion}
                onChange={(event) => setResearchQuestion(event.target.value)}
                rows={3}
                className="form-input form-textarea"
                placeholder={t("studies.designer.researchQuestionPlaceholder")}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={protocolInputRef}
                type="file"
                accept=".doc,.docx,.pdf,.md,.markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown"
                className="sr-only"
                onChange={handleProtocolUpload}
              />
              <button
                type="button"
                onClick={() => protocolInputRef.current?.click()}
                disabled={designBusy}
                className="btn btn-secondary btn-sm"
              >
                {importProtocol.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {t("studies.designer.actions.uploadProtocol")}
              </button>
              <button
                type="button"
                onClick={handleGenerateIntent}
                disabled={designBusy || researchQuestion.trim().length < 10}
                className="btn btn-primary btn-sm"
              >
                {generateIntent.isPending ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                {t("studies.workbench.generateIntent")}
              </button>
              <button
                type="button"
                onClick={handleImportExisting}
                disabled={designBusy}
                className="btn btn-secondary btn-sm"
              >
                {importExistingDesign.isPending ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
                {t("studies.workbench.actions.importCurrent")}
              </button>
              <button
                type="button"
                onClick={handleCritique}
                disabled={designBusy || !activeVersion}
                className="btn btn-secondary btn-sm"
              >
                {critiqueDesign.isPending ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                {t("studies.workbench.actions.critique")}
              </button>
              <button
                type="button"
                onClick={handleAcceptDesign}
                disabled={designBusy || !activeVersion || activeVersion.status === "locked"}
                className="btn btn-secondary btn-sm"
              >
                {t("studies.workbench.actions.acceptIntent")}
              </button>
              <button
                type="button"
                onClick={handleLockDesign}
                disabled={designBusy || !activeVersion || activeVersion.status === "locked" || !lockReadiness?.ready}
                className="btn btn-primary btn-sm"
              >
                {lockDesign.isPending ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                {t("studies.workbench.actions.lockPackage")}
              </button>
            </div>
            {activeVersion && (
              <IntentReviewPanel
                state={reviewState}
                onChange={setReviewState}
                onSave={handleSaveIntentReview}
                isSaving={updateDesignVersion.isPending}
                isLocked={activeVersion.status === "locked"}
              />
            )}
            {activeError && (
              <div className="rounded-lg border border-critical/40 bg-critical/10 p-3 text-sm text-critical">
                {activeError}
              </div>
            )}
          </div>

          <div
            className="rounded-lg p-3"
            style={{ border: "1px solid var(--border-default)", background: "var(--surface-overlay)" }}
          >
            <div className="grid grid-cols-2 gap-3">
              <CompilerMetric label={t("studies.designer.metrics.assets")} value={versionAssets.length} />
              <CompilerMetric label={t("studies.workbench.labels.verified")} value={designAssetCounts.verified} />
              <CompilerMetric label={t("studies.workbench.labels.blocked")} value={designAssetCounts.blocked} />
              <CompilerMetric label={t("studies.workbench.labels.reviewed")} value={lockReadiness?.provenance_summary?.reviewed_assets ?? 0} />
            </div>
            <div className="mt-3 space-y-2" style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              {(lockReadiness?.blocking_reasons?.length ?? 0) > 0 ? (
                lockReadiness?.blocking_reasons?.slice(0, 3).map((reason) => (
                  <p key={reason}>{reason}</p>
                ))
              ) : (
                <p>
                  {lockReadiness?.ready
                    ? t("studies.workbench.messages.readyToLock")
                    : t("studies.designer.messages.createOrImport")}
                </p>
              )}
              {lockReadiness?.package_artifact?.url && (
                <a className="link" href={lockReadiness.package_artifact.url}>
                  {t("studies.designer.actions.downloadLockedPackage")}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {lockReadiness?.ready ? (
                <CheckCircle2 size={18} style={{ color: "var(--success)" }} />
              ) : (
                <AlertTriangle size={18} style={{ color: "var(--warning)" }} />
              )}
              <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
                {t("studies.designer.sections.verificationGates")}
              </h3>
            </div>
            <p className="mt-2 max-w-3xl" style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              {t("studies.designer.descriptions.verificationGates")}
            </p>
          </div>
          <span className={cn("badge", lockReadiness?.ready ? "badge-success" : "badge-warning")}>
            {lockReadiness?.ready
              ? t("studies.workbench.messages.ready")
              : t("studies.designer.messages.needsEvidence")}
          </span>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
          <div className="space-y-3">
            <GateRow
              label={t("studies.designer.gates.designIntent")}
              ready={activeVersion?.status === "accepted" || activeVersion?.status === "locked"}
              detail={activeVersion?.accepted_at
                ? t("studies.designer.gates.acceptedAt", { time: formatDateTime(activeVersion.accepted_at) })
                : t("studies.designer.gates.acceptResearchQuestion")}
            />
            <GateRow
              label={t("studies.workbench.labels.cohorts")}
              ready={lockReadiness?.cohorts?.ready ?? false}
              detail={t("studies.designer.gates.verifiedMaterializedCohorts", {
                count: lockReadiness?.cohorts?.materialized_verified_count ?? 0,
              })}
            />
            <GateRow
              label={t("studies.workbench.labels.feasibility")}
              ready={lockReadiness?.feasibility_ready ?? false}
              detail={lockReadiness?.feasibility_ready
                ? t("studies.designer.gates.feasibilityReady")
                : t("studies.designer.gates.runFeasibility")}
            />
            <GateRow
              label={t("studies.designer.gates.analysisPlan")}
              ready={lockReadiness?.analysis_plan_ready ?? false}
              detail={lockReadiness?.analysis_plan_ready
                ? t("studies.designer.gates.analysisPlanReady")
                : t("studies.designer.gates.verifyAnalysisPlan")}
            />
          </div>

          <div
            className="p-3"
            style={{ border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", background: "var(--surface-overlay)" }}
          >
            <div className="flex items-center gap-2">
              <PackageCheck size={16} style={{ color: "var(--accent)" }} />
              <h4 style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 600 }}>
                {t("studies.designer.sections.packageProvenance")}
              </h4>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3" style={{ fontSize: "var(--text-xs)" }}>
              <ProvenanceItem
                label={t("studies.designer.labels.version")}
                value={activeVersion
                  ? t("studies.designer.labels.versionStatus", {
                    version: activeVersion.version_number,
                    status: t(`studies.designer.versionStatuses.${activeVersion.status}`, {
                      defaultValue: humanize(activeVersion.status),
                    }),
                  })
                  : t("studies.designer.messages.noVersion")}
              />
              <ProvenanceItem label={t("studies.workbench.labels.aiEvents")} value={String(lockReadiness?.provenance_summary?.ai_events ?? 0)} />
              <ProvenanceItem label={t("studies.designer.labels.verifiedAssets")} value={String(lockReadiness?.provenance_summary?.verified_assets ?? 0)} />
              <ProvenanceItem label={t("studies.workbench.labels.manifest")} value={packageSha ? shortHash(packageSha) : t("studies.workbench.messages.pending")} />
            </dl>
            {lockReadiness?.package_artifact?.url && (
              <a className="btn btn-secondary btn-sm mt-3" href={lockReadiness.package_artifact.url}>
                <FileJson size={14} />
                {t("studies.designer.actions.downloadPackage")}
              </a>
            )}
          </div>
        </div>

        {(lockReadiness?.blocking_reasons?.length ?? 0) > 0 && (
          <div className="mt-4 space-y-2">
            {lockReadiness?.blocking_reasons?.map((reason) => (
              <div
                key={reason}
                className="flex items-start gap-2 p-3"
                style={{ border: "1px solid var(--warning-border)", borderRadius: "var(--radius-sm)", background: "var(--warning-bg)" }}
              >
                <AlertTriangle size={14} style={{ color: "var(--warning-light)", marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
              {t("studies.designer.sections.assetEvidence")}
            </h3>
            <p className="mt-2 max-w-3xl" style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              {t("studies.designer.descriptions.assetEvidence")}
            </p>
          </div>
          <span className={cn("badge", blockedAssets.length > 0 ? "badge-critical" : "badge-success")}>
            {blockedAssets.length > 0
              ? t("studies.designer.messages.blockedCount", { count: blockedAssets.length })
              : t("studies.designer.messages.noBlockers")}
          </span>
        </div>

        {versionAssets.length === 0 ? (
          <p className="mt-4" style={{ fontSize: "var(--text-sm)", color: "var(--text-ghost)" }}>
            {t("studies.designer.messages.startEvidenceReview")}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {versionAssets.map((asset) => (
              <AssetEvidenceRow key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </div>

      {/* Name & Description */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          {t("studies.designer.sections.basicInformation")}
        </h3>
        <div className="space-y-3 mt-3">
          <div>
            <label className="form-label">{t("studies.designer.labels.title")}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("studies.designer.placeholders.studyTitle")}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">{t("studies.designer.labels.description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("studies.designer.placeholders.optionalDescription")}
              rows={2}
              className="form-input form-textarea"
            />
          </div>
          <div>
            <label className="form-label">{t("studies.designer.labels.studyType")}</label>
            <select
              value={studyType}
              onChange={(e) => setStudyType(e.target.value)}
              className="form-input form-select"
            >
              {STUDY_TYPES.map((st) => (
                <option key={st} value={st}>
                  {t(`studies.detail.studyTypes.${st}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Add Analysis */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          {t("studies.designer.sections.addAnalysis")}
        </h3>
        <div className="flex items-end gap-3 mt-3">
          <div className="flex-1">
            <label className="form-label">{t("studies.designer.labels.analysisType")}</label>
            <select
              value={addType}
              onChange={(e) => {
                setAddType(e.target.value);
                setAddId(null);
              }}
              className="form-input form-select"
            >
              {ANALYSIS_TYPES.map((at) => (
                <option key={at} value={at}>
                  {t(`studies.designer.analysisTypes.${at}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="form-label">{t("studies.designer.labels.analysis")}</label>
            <select
              value={addId ?? ""}
              onChange={(e) =>
                setAddId(Number(e.target.value) || null)
              }
              className="form-input form-select"
            >
              <option value="">{t("studies.designer.placeholders.selectAnalysis")}</option>
              {analysisOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleAddAnalysis}
            disabled={!addId || addAnalysisMutation.isPending}
            className="btn btn-primary btn-sm"
          >
            {addAnalysisMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            {t("studies.designer.actions.add")}
          </button>
        </div>
      </div>

      {/* Current Analyses */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          {t("studies.designer.sections.studyAnalyses", { count: studyAnalyses?.length ?? 0 })}
        </h3>
        {!studyAnalyses || studyAnalyses.length === 0 ? (
          <p className="mt-2" style={{ fontSize: "var(--text-xs)", color: "var(--text-ghost)" }}>
            {t("studies.designer.messages.noAnalyses")}
          </p>
        ) : (
          <div className="space-y-2 mt-3">
            {studyAnalyses.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg px-3 py-2"
                style={{ border: "1px solid var(--border-default)", background: "var(--surface-overlay)" }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "badge",
                      entry.analysis_type === "estimation"
                        ? "badge-critical"
                        : entry.analysis_type === "prediction"
                          ? "badge-warning"
                          : "badge-info",
                    )}
                  >
                    {entry.analysis_type}
                  </span>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                    {entry.analysis?.name ?? t("studies.designer.messages.analysisFallback", { id: entry.analysis_id })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAnalysis(entry)}
                  disabled={removeAnalysisMutation.isPending}
                  style={{ color: "var(--text-muted)", transition: "color 150ms" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--critical)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !title.trim()}
          className="btn btn-primary"
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {t("studies.designer.actions.saveChanges")}
        </button>
      </div>
    </div>
  );
}

function IntentReviewPanel({
  state,
  onChange,
  onSave,
  isSaving,
  isLocked,
}: {
  state: IntentReviewState;
  onChange: (state: IntentReviewState) => void;
  onSave: () => void;
  isSaving: boolean;
  isLocked: boolean;
}) {
  const { t } = useTranslation("app");
  const update = (key: keyof IntentReviewState, value: string) => {
    onChange({ ...state, [key]: value });
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-overlay p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-text-secondary">
          {t("studies.designer.sections.intentReview")}
        </h4>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || isLocked}
          className="btn btn-secondary btn-sm"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {t("studies.designer.actions.saveIntent")}
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <IntentReviewField
          label={t("studies.workbench.researchQuestion")}
          value={state.researchQuestion}
          disabled={isLocked}
          onChange={(value) => update("researchQuestion", value)}
        />
        <IntentReviewField
          label={t("studies.workbench.labels.primaryObjective")}
          value={state.primaryObjective}
          disabled={isLocked}
          onChange={(value) => update("primaryObjective", value)}
        />
        <IntentReviewField
          label={t("studies.workbench.labels.population")}
          value={state.population}
          disabled={isLocked}
          onChange={(value) => update("population", value)}
        />
        <IntentReviewField
          label={t("studies.workbench.labels.exposure")}
          value={state.exposure}
          disabled={isLocked}
          onChange={(value) => update("exposure", value)}
        />
        <IntentReviewField
          label={t("studies.workbench.labels.comparator")}
          value={state.comparator}
          disabled={isLocked}
          onChange={(value) => update("comparator", value)}
        />
        <IntentReviewField
          label={t("studies.workbench.labels.primaryOutcome")}
          value={state.outcome}
          disabled={isLocked}
          onChange={(value) => update("outcome", value)}
        />
        <IntentReviewField
          label={t("studies.workbench.labels.timeAtRisk")}
          value={state.timeAtRisk}
          disabled={isLocked}
          onChange={(value) => update("timeAtRisk", value)}
        />
        <IntentReviewField
          label={t("studies.designer.labels.hypothesis")}
          value={state.hypothesis}
          disabled={isLocked}
          onChange={(value) => update("hypothesis", value)}
        />
        <div>
          <label className="form-label">{t("studies.designer.labels.studyType")}</label>
          <select
            value={state.studyType}
            onChange={(event) => update("studyType", event.target.value)}
            className="form-input form-select"
            disabled={isLocked}
          >
            {STUDY_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`studies.detail.studyTypes.${type}`, { defaultValue: humanize(type) })}
              </option>
            ))}
          </select>
        </div>
        <IntentReviewField
          label={t("studies.designer.labels.studyDesign")}
          value={state.studyDesign}
          rows={1}
          disabled={isLocked}
          onChange={(value) => update("studyDesign", value)}
        />
      </div>
    </div>
  );
}

function IntentReviewField({
  label,
  value,
  onChange,
  rows = 2,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="form-input form-textarea"
        disabled={disabled}
      />
    </div>
  );
}

function summarizeDesignAssets(assets: StudyDesignAsset[]) {
  return assets.reduce(
    (summary, asset) => {
      if (asset.verification_status === "verified") summary.verified += 1;
      if (asset.verification_status === "blocked") summary.blocked += 1;
      if (asset.status === "accepted") summary.accepted += 1;
      return summary;
    },
    { verified: 0, blocked: 0, accepted: 0 },
  );
}

function CompilerMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: "var(--text-lg)", color: "var(--text-primary)", fontWeight: 700 }}>
        {value}
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-ghost)" }}>
        {label}
      </div>
    </div>
  );
}

function GateRow({ label, ready, detail }: { label: string; ready: boolean; detail: string }) {
  return (
    <div
      className="flex items-start gap-3 p-3"
      style={{ border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", background: "var(--surface-overlay)" }}
    >
      {ready ? (
        <CheckCircle2 size={16} style={{ color: "var(--success)", marginTop: 2, flexShrink: 0 }} />
      ) : (
        <AlertTriangle size={16} style={{ color: "var(--warning)", marginTop: 2, flexShrink: 0 }} />
      )}
      <div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{detail}</div>
      </div>
    </div>
  );
}

function ProvenanceItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ color: "var(--text-ghost)" }}>{label}</dt>
      <dd className="mt-1 break-words" style={{ color: "var(--text-primary)", fontWeight: 600 }}>{value}</dd>
    </div>
  );
}

function AssetEvidenceRow({ asset }: { asset: StudyDesignAsset }) {
  const { t } = useTranslation("app");
  const checks = getChecks(asset.verification_json);
  const messages = getStringArray(asset.verification_json, "messages");
  const missingConceptIds = getNumberArray(asset.verification_json, "missing_concept_ids");
  const invalidVocabularyIds = getNumberArray(asset.verification_json, "invalid_vocabulary_concept_ids");
  const invalidLocalIds = getUnknownArray(asset.verification_json, "invalid_local_concept_ids");
  const failedChecks = checks.filter((check) => !check.pass);
  const statusClass = asset.verification_status === "verified"
    ? "badge-success"
    : asset.verification_status === "blocked"
      ? "badge-critical"
      : "badge-warning";

  return (
    <div
      className="p-3"
      style={{ border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", background: "var(--surface-overlay)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("badge", statusClass)}>{humanize(asset.verification_status)}</span>
            <span className="badge badge-info">{humanize(asset.asset_type)}</span>
            {asset.role && <span className="badge badge-inactive">{humanize(asset.role)}</span>}
          </div>
          <div className="mt-2" style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 600 }}>
            {assetTitle(asset)}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            <span>{t("studies.designer.messages.assetId", { id: asset.id })}</span>
            {asset.materialized_id && (
              <span> · {t("studies.designer.messages.materializedId", { id: asset.materialized_id })}</span>
            )}
            {asset.verified_at && (
              <span> · {t("studies.designer.messages.verifiedAt", { time: formatDateTime(asset.verified_at) })}</span>
            )}
          </div>
        </div>
        {asset.verification_status === "verified" ? (
          <CheckCircle2 size={18} style={{ color: "var(--success)", flexShrink: 0 }} />
        ) : asset.verification_status === "blocked" ? (
          <AlertTriangle size={18} style={{ color: "var(--critical)", flexShrink: 0 }} />
        ) : (
          <ShieldCheck size={18} style={{ color: "var(--warning)", flexShrink: 0 }} />
        )}
      </div>

      {messages.length > 0 && (
        <div className="mt-3 space-y-1">
          {messages.map((message) => (
            <p key={message} style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
              {message}
            </p>
          ))}
        </div>
      )}

      {failedChecks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {failedChecks.map((check) => (
            <span key={check.key} className="badge badge-critical">
              {humanize(check.key)}
            </span>
          ))}
        </div>
      )}

      {(missingConceptIds.length > 0 || invalidVocabularyIds.length > 0 || invalidLocalIds.length > 0) && (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <ConceptIdList label={t("studies.designer.labels.missingOmopIds")} values={missingConceptIds} />
          <ConceptIdList label={t("studies.designer.labels.deprecatedOmopIds")} values={invalidVocabularyIds} />
          <ConceptIdList label={t("studies.designer.labels.invalidDraftIds")} values={invalidLocalIds.map(String)} />
        </div>
      )}

      {checks.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {checks.map((check) => (
            <div key={check.key} className="flex items-center gap-2" style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              <span className={cn("status-dot", check.pass ? "success" : "critical")} />
              <span>{humanize(check.key)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConceptIdList({ label, values }: { label: string; values: Array<number | string> }) {
  if (values.length === 0) return null;

  return (
    <div
      className="p-2"
      style={{ border: "1px solid var(--critical-border)", borderRadius: "var(--radius-sm)", background: "var(--critical-bg)" }}
    >
      <div style={{ fontSize: "var(--text-xs)", color: "var(--critical-light)", fontWeight: 600 }}>{label}</div>
      <div className="mt-1 break-words font-mono" style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)" }}>
        {values.join(", ")}
      </div>
    </div>
  );
}

function assetTitle(asset: StudyDesignAsset): string {
  const payloadTitle = asString(asset.draft_payload_json?.title);
  if (payloadTitle) return payloadTitle;

  return humanize(asset.asset_type);
}

function studyToBasicInfoState(study: Study): BasicInfoState {
  const description = study.description ?? "";
  const studyType = study.study_type || "characterization";

  return {
    studySignature: [study.id, study.title, description, studyType].join("\u0000"),
    title: study.title,
    description,
    studyType,
  };
}

function versionReviewSignature(version: StudyDesignVersion | null, study: Study): string {
  if (!version) return ["study", study.id, study.title, study.primary_objective ?? ""].join("\u0000");

  return [
    version.id,
    version.status,
    JSON.stringify(version.intent_json ?? {}),
    JSON.stringify(version.normalized_spec_json ?? {}),
  ].join("\u0000");
}

function versionToIntentReview(version: StudyDesignVersion | null, study: Study): IntentReviewState {
  const intent = asRecord(version?.intent_json);
  const spec = asRecord(version?.normalized_spec_json);
  const intentPico = asRecord(intent.pico);
  const specPico = asRecord(spec.pico);
  const specStudy = asRecord(spec.study);

  return {
    researchQuestion: firstString(
      intent.research_question,
      specStudy.research_question,
      study.primary_objective,
      study.description,
      study.title,
    ),
    primaryObjective: firstString(intent.primary_objective, specStudy.primary_objective, study.primary_objective),
    population: firstString(
      intentPico.population,
      nestedSummary(specPico.population),
      specStudy.target_population_summary,
    ),
    exposure: firstString(
      intentPico.intervention,
      intentPico.exposure,
      nestedSummary(specPico.intervention_or_exposure),
      nestedSummary(specPico.intervention),
    ),
    comparator: firstString(intentPico.comparator, nestedSummary(specPico.comparator)),
    outcome: firstString(
      intentPico.outcome,
      firstOutcomeSummary(specPico.outcomes),
    ),
    timeAtRisk: firstString(
      intentPico.time_at_risk,
      intentPico.time,
      nestedSummary(specPico.time),
    ),
    studyType: firstString(intent.analysis_family, specStudy.study_type, study.study_type, "custom"),
    studyDesign: firstString(specStudy.study_design, study.study_design, "observational"),
    hypothesis: firstString(intent.hypothesis, specStudy.hypothesis, study.hypothesis),
  };
}

function intentReviewPayload(
  version: StudyDesignVersion,
  state: IntentReviewState,
  study: Study,
): {
  intent_json: Record<string, unknown>;
  normalized_spec_json: Record<string, unknown>;
  status: "draft" | "review_ready";
} {
  const intent = {
    ...asRecord(version.intent_json),
    research_question: state.researchQuestion,
    study_title: study.title,
    analysis_family: state.studyType,
    primary_objective: state.primaryObjective,
    hypothesis: state.hypothesis,
    pico: {
      ...asRecord(asRecord(version.intent_json).pico),
      population: state.population,
      intervention: state.exposure,
      comparator: state.comparator,
      outcome: state.outcome,
      time_at_risk: state.timeAtRisk,
    },
    known_gaps: ["AI-derived fields require review and canonical OHDSI asset verification."],
  };
  const existingSpec = asRecord(version.normalized_spec_json);
  const existingStudy = asRecord(existingSpec.study);
  const existingPico = asRecord(existingSpec.pico);
  const normalizedSpec = {
    ...existingSpec,
    study: {
      ...existingStudy,
      title: existingStudy.title ?? study.title,
      short_title: existingStudy.short_title ?? study.short_title,
      research_question: state.researchQuestion,
      primary_objective: state.primaryObjective,
      hypothesis: state.hypothesis,
      study_type: state.studyType,
      study_design: state.studyDesign,
      target_population_summary: state.population,
    },
    pico: {
      ...existingPico,
      population: state.population,
      intervention: state.exposure,
      comparator: state.comparator,
      outcome: state.outcome,
      time_at_risk: state.timeAtRisk,
    },
  };
  const reviewReady = state.researchQuestion.trim() !== ""
    && state.population.trim() !== ""
    && state.outcome.trim() !== "";

  return {
    intent_json: intent,
    normalized_spec_json: normalizedSpec,
    status: reviewReady ? "review_ready" : "draft",
  };
}

function getChecks(json: Record<string, unknown> | null): Array<{ key: string; pass: boolean }> {
  const checks = isRecord(json?.checks) ? json.checks : null;
  if (!checks) return [];

  return Object.entries(checks)
    .filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
    .map(([key, pass]) => ({ key, pass }));
}

function getStringArray(json: Record<string, unknown> | null, key: string): string[] {
  return getUnknownArray(json, key).filter((item): item is string => typeof item === "string");
}

function getNumberArray(json: Record<string, unknown> | null, key: string): number[] {
  return getUnknownArray(json, key)
    .filter((item): item is number | string => typeof item === "number" || typeof item === "string")
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function getUnknownArray(json: Record<string, unknown> | null, key: string): unknown[] {
  const value = json?.[key];
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }

  return "";
}

function nestedSummary(value: unknown): string {
  if (typeof value === "string") return value;

  return firstString(asRecord(value).summary);
}

function firstOutcomeSummary(value: unknown): string {
  if (!Array.isArray(value)) return "";

  for (const outcome of value) {
    const summary = nestedSummary(outcome);
    if (summary) return summary;
  }

  return "";
}

function mutationError(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;

  const responseData = asRecord(asRecord(error).response ? asRecord(asRecord(error).response).data : null);
  const responseMessage = firstString(responseData.message, responseData.error);
  if (responseMessage) return responseMessage;

  if (error instanceof Error) return error.message;
  return "Study Designer request failed.";
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortHash(value: string): string {
  return value.length > 12 ? `${value.slice(0, 12)}...` : value;
}
