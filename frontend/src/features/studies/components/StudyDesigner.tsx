import { useState } from "react";
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
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Study, StudyAnalysisEntry, StudyDesignAsset } from "../types/study";
import {
  useUpdateStudy,
  useAddStudyAnalysis,
  useRemoveStudyAnalysis,
  useStudyAnalyses,
  useAcceptStudyDesignVersion,
  useCreateStudyDesignSession,
  useCritiqueStudyDesignVersion,
  useGenerateStudyDesignIntent,
  useImportExistingStudyDesign,
  useLockStudyDesignVersion,
  useStudyDesignAssets,
  useStudyDesignLockReadiness,
  useStudyDesignSessions,
  useStudyDesignVersions,
} from "../hooks/useStudies";
import { useCharacterizations } from "@/features/analyses/hooks/useCharacterizations";
import { useIncidenceRates } from "@/features/analyses/hooks/useIncidenceRates";
import { usePathways } from "@/features/pathways/hooks/usePathways";
import { useEstimations } from "@/features/estimation/hooks/useEstimations";
import { usePredictions } from "@/features/prediction/hooks/usePredictions";

const STUDY_TYPES = [
  { value: "characterization", label: "Characterization" },
  { value: "population_level_estimation", label: "Population-Level Estimation" },
  { value: "patient_level_prediction", label: "Patient-Level Prediction" },
  { value: "drug_utilization", label: "Drug Utilization" },
  { value: "quality_improvement", label: "Quality Improvement" },
  { value: "comparative_effectiveness", label: "Comparative Effectiveness" },
  { value: "safety_surveillance", label: "Safety Surveillance" },
  { value: "custom", label: "Custom" },
];

const ANALYSIS_TYPES = [
  { value: "characterization", label: "Characterization" },
  { value: "incidence-rate", label: "Incidence Rate" },
  { value: "pathway", label: "Pathway" },
  { value: "estimation", label: "Estimation" },
  { value: "prediction", label: "Prediction" },
];

interface StudyDesignerProps {
  study: Study;
}

export function StudyDesigner({ study }: StudyDesignerProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [studyType, setStudyType] = useState("characterization");

  const [addType, setAddType] = useState("characterization");
  const [addId, setAddId] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [researchQuestion, setResearchQuestion] = useState(
    study.primary_objective || study.description || study.title || "",
  );

  const updateMutation = useUpdateStudy();
  const addAnalysisMutation = useAddStudyAnalysis();
  const removeAnalysisMutation = useRemoveStudyAnalysis();
  const createDesignSession = useCreateStudyDesignSession();
  const generateIntent = useGenerateStudyDesignIntent();
  const importExistingDesign = useImportExistingStudyDesign();
  const critiqueDesign = useCritiqueStudyDesignVersion();
  const acceptDesign = useAcceptStudyDesignVersion();
  const lockDesign = useLockStudyDesignVersion();

  const { data: studyAnalyses } = useStudyAnalyses(study.slug);
  const { data: designSessions } = useStudyDesignSessions(study.slug);
  const activeSession = designSessions?.find((session) => session.id === selectedSessionId) ?? designSessions?.[0] ?? null;
  const { data: designVersions } = useStudyDesignVersions(study.slug, activeSession?.id ?? null);
  const activeVersion = designVersions?.find((version) => version.id === selectedVersionId)
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

  const ensureDesignSession = async () => {
    if (activeSession) return activeSession;
    const session = await createDesignSession.mutateAsync({
      slug: study.slug,
      payload: {
        title: `${study.title} OHDSI design`,
        source_mode: "study_designer",
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
    setSelectedVersionId(version.id);
  };

  const handleImportExisting = async () => {
    const session = await ensureDesignSession();
    const version = await importExistingDesign.mutateAsync({
      slug: study.slug,
      sessionId: session.id,
    });
    setSelectedVersionId(version.id);
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
    || importExistingDesign.isPending
    || critiqueDesign.isPending
    || acceptDesign.isPending
    || lockDesign.isPending;
  const analysisOptions = getAnalysisOptions();
  const versionAssets = (designAssets ?? []).filter((asset) => asset.version_id === activeVersion?.id);
  const designAssetCounts = summarizeDesignAssets(versionAssets);
  const blockedAssets = versionAssets.filter((asset) => asset.verification_status === "blocked");
  const packageSha = asString(lockReadiness?.provenance_summary?.package_manifest_sha256);

  return (
    <div className="space-y-6">
      <div className="panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bot size={18} style={{ color: "var(--accent)" }} />
              <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
                OHDSI Study Design Compiler
              </h3>
            </div>
            <p className="mt-2 max-w-3xl" style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              Turn a reviewed research question into traceable concept sets, cohorts, feasibility evidence, HADES-ready analysis plans, and a locked study package.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-info">Session {activeSession?.id ?? "new"}</span>
            <span className="badge badge-success">Version {activeVersion?.version_number ?? "none"}</span>
            <span className={cn("badge", activeVersion?.status === "locked" ? "badge-critical" : "badge-warning")}>
              {activeVersion?.status ?? "not started"}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
          <div className="space-y-3">
            <div>
              <label className="form-label">Research Question</label>
              <textarea
                value={researchQuestion}
                onChange={(event) => setResearchQuestion(event.target.value)}
                rows={3}
                className="form-input form-textarea"
                placeholder="Among adults with..., does..., compared with..., reduce..."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerateIntent}
                disabled={designBusy || researchQuestion.trim().length < 10}
                className="btn btn-primary btn-sm"
              >
                {generateIntent.isPending ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                Generate Intent
              </button>
              <button
                type="button"
                onClick={handleImportExisting}
                disabled={designBusy}
                className="btn btn-secondary btn-sm"
              >
                {importExistingDesign.isPending ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
                Import Current
              </button>
              <button
                type="button"
                onClick={handleCritique}
                disabled={designBusy || !activeVersion}
                className="btn btn-secondary btn-sm"
              >
                {critiqueDesign.isPending ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                Critique
              </button>
              <button
                type="button"
                onClick={handleAcceptDesign}
                disabled={designBusy || !activeVersion || activeVersion.status === "locked"}
                className="btn btn-secondary btn-sm"
              >
                Accept Intent
              </button>
              <button
                type="button"
                onClick={handleLockDesign}
                disabled={designBusy || !activeVersion || activeVersion.status === "locked" || !lockReadiness?.ready}
                className="btn btn-primary btn-sm"
              >
                {lockDesign.isPending ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                Lock Package
              </button>
            </div>
          </div>

          <div
            className="rounded-lg p-3"
            style={{ border: "1px solid var(--border-default)", background: "var(--surface-overlay)" }}
          >
            <div className="grid grid-cols-2 gap-3">
              <CompilerMetric label="Assets" value={versionAssets.length} />
              <CompilerMetric label="Verified" value={designAssetCounts.verified} />
              <CompilerMetric label="Blocked" value={designAssetCounts.blocked} />
              <CompilerMetric label="Reviewed" value={lockReadiness?.provenance_summary?.reviewed_assets ?? 0} />
            </div>
            <div className="mt-3 space-y-2" style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              {(lockReadiness?.blocking_reasons?.length ?? 0) > 0 ? (
                lockReadiness?.blocking_reasons?.slice(0, 3).map((reason) => (
                  <p key={reason}>{reason}</p>
                ))
              ) : (
                <p>{lockReadiness?.ready ? "Ready to lock." : "Create or import a design to begin."}</p>
              )}
              {lockReadiness?.package_artifact?.url && (
                <a className="link" href={lockReadiness.package_artifact.url}>
                  Download locked package
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
                Verification Gates
              </h3>
            </div>
            <p className="mt-2 max-w-3xl" style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              Resolve blockers before locking the OHDSI package.
            </p>
          </div>
          <span className={cn("badge", lockReadiness?.ready ? "badge-success" : "badge-warning")}>
            {lockReadiness?.ready ? "Ready" : "Needs evidence"}
          </span>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
          <div className="space-y-3">
            <GateRow
              label="Design intent"
              ready={activeVersion?.status === "accepted" || activeVersion?.status === "locked"}
              detail={activeVersion?.accepted_at ? `Accepted ${formatDateTime(activeVersion.accepted_at)}` : "Accept the reviewed research question."}
            />
            <GateRow
              label="Cohorts"
              ready={lockReadiness?.cohorts?.ready ?? false}
              detail={`${lockReadiness?.cohorts?.materialized_verified_count ?? 0} verified materialized cohort${(lockReadiness?.cohorts?.materialized_verified_count ?? 0) === 1 ? "" : "s"}`}
            />
            <GateRow
              label="Feasibility"
              ready={lockReadiness?.feasibility_ready ?? false}
              detail={lockReadiness?.feasibility_ready ? "Verified feasibility evidence is ready." : "Run feasibility after cohorts verify."}
            />
            <GateRow
              label="Analysis plan"
              ready={lockReadiness?.analysis_plan_ready ?? false}
              detail={lockReadiness?.analysis_plan_ready ? "Verified HADES analysis plan is ready." : "Verify and materialize an analysis plan."}
            />
          </div>

          <div
            className="p-3"
            style={{ border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", background: "var(--surface-overlay)" }}
          >
            <div className="flex items-center gap-2">
              <PackageCheck size={16} style={{ color: "var(--accent)" }} />
              <h4 style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 600 }}>
                Package Provenance
              </h4>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3" style={{ fontSize: "var(--text-xs)" }}>
              <ProvenanceItem label="Version" value={activeVersion ? `v${activeVersion.version_number} ${activeVersion.status}` : "No version"} />
              <ProvenanceItem label="AI events" value={String(lockReadiness?.provenance_summary?.ai_events ?? 0)} />
              <ProvenanceItem label="Verified assets" value={String(lockReadiness?.provenance_summary?.verified_assets ?? 0)} />
              <ProvenanceItem label="Manifest" value={packageSha ? shortHash(packageSha) : "Pending"} />
            </dl>
            {lockReadiness?.package_artifact?.url && (
              <a className="btn btn-secondary btn-sm mt-3" href={lockReadiness.package_artifact.url}>
                <FileJson size={14} />
                Download package
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
              Asset Evidence
            </h3>
            <p className="mt-2 max-w-3xl" style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              Review blocked verifier output before accepting a package.
            </p>
          </div>
          <span className={cn("badge", blockedAssets.length > 0 ? "badge-critical" : "badge-success")}>
            {blockedAssets.length > 0 ? `${blockedAssets.length} blocked` : "No blockers"}
          </span>
        </div>

        {versionAssets.length === 0 ? (
          <p className="mt-4" style={{ fontSize: "var(--text-sm)", color: "var(--text-ghost)" }}>
            Generate intent or import the current study to begin evidence review.
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
          Basic Information
        </h3>
        <div className="space-y-3 mt-3">
          <div>
            <label className="form-label">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Study title"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="form-input form-textarea"
            />
          </div>
          <div>
            <label className="form-label">Study Type</label>
            <select
              value={studyType}
              onChange={(e) => setStudyType(e.target.value)}
              className="form-input form-select"
            >
              {STUDY_TYPES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Add Analysis */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Add Analysis
        </h3>
        <div className="flex items-end gap-3 mt-3">
          <div className="flex-1">
            <label className="form-label">Analysis Type</label>
            <select
              value={addType}
              onChange={(e) => {
                setAddType(e.target.value);
                setAddId(null);
              }}
              className="form-input form-select"
            >
              {ANALYSIS_TYPES.map((at) => (
                <option key={at.value} value={at.value}>
                  {at.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="form-label">Analysis</label>
            <select
              value={addId ?? ""}
              onChange={(e) =>
                setAddId(Number(e.target.value) || null)
              }
              className="form-input form-select"
            >
              <option value="">Select analysis...</option>
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
            Add
          </button>
        </div>
      </div>

      {/* Current Analyses */}
      <div className="panel">
        <h3 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
          Study Analyses ({studyAnalyses?.length ?? 0})
        </h3>
        {!studyAnalyses || studyAnalyses.length === 0 ? (
          <p className="mt-2" style={{ fontSize: "var(--text-xs)", color: "var(--text-ghost)" }}>
            No analyses added yet.
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
                    {entry.analysis?.name ?? `Analysis #${entry.analysis_id}`}
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
          Save Changes
        </button>
      </div>
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
            Asset #{asset.id}
            {asset.materialized_id ? ` · materialized #${asset.materialized_id}` : ""}
            {asset.verified_at ? ` · verified ${formatDateTime(asset.verified_at)}` : ""}
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
          <ConceptIdList label="Missing OMOP IDs" values={missingConceptIds} />
          <ConceptIdList label="Deprecated OMOP IDs" values={invalidVocabularyIds} />
          <ConceptIdList label="Invalid draft IDs" values={invalidLocalIds.map(String)} />
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

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortHash(value: string): string {
  return value.length > 12 ? `${value.slice(0, 12)}...` : value;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
