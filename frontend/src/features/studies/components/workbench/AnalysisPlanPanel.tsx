import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  StudyAnalysisPlanDraft,
  StudyDesignAsset,
  StudyDesignVersion,
  StudyFeasibilityResult,
} from "../../types/study";
import { ActionGateHint } from "./shared/ActionGateHint";
import { VerificationBadge } from "./shared/VerificationBadge";
import {
  analysisDetailPath,
  analysisPlanIssues,
  analysisPlanParameterRows,
  draftPayloadRecord,
  formatAnalysisParameterValue,
  isRecord,
  normalizeCohortRole,
  summaryAt,
} from "./studyDesignWorkbenchHelpers";

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

export function AnalysisPlanPanel({
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
