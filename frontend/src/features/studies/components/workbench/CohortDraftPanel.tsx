import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudyCohortReadiness, StudyDesignAsset } from "../../types/study";
import { ActionGateHint } from "./shared/ActionGateHint";
import { VerificationBadge } from "./shared/VerificationBadge";
import {
  arrayValue,
  draftPayloadRecord,
  isRecord,
  issueAction,
  issueMessage,
  issueMessages,
  normalizeCohortRole,
  recordValue,
  textValue,
  verificationCheckRows,
} from "./studyDesignWorkbenchHelpers";
import { tAuto } from "@/i18n/autoUserFacing";

export function CohortDraftPanel({
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
          {tAuto("selectARoleOnAMaterializedCohortBelow_7af9ef57")}
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
            {tAuto("missingRoles_6c99e6df")} {missingRoles.join(", ")}
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
              <p className="text-[10px] uppercase tracking-wider text-warning">{tAuto("abbyCohortRepairSuggestions_4d124709")}</p>
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
                        {tAuto("applyAbbyCohortPatch_bde8b576")}
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
                  <label htmlFor={`cohort-role-${asset.id}`} className="sr-only">{tAuto("cohortRole_7d892948")}</label>
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
