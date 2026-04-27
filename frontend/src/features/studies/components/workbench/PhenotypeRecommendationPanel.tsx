import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudyDesignAsset } from "../../types/study";
import { ActionGateHint } from "./shared/ActionGateHint";
import { EvidenceBlock, EvidenceLine, EvidenceMetric } from "./shared/EvidenceMetric";
import { VerificationBadge } from "./shared/VerificationBadge";
import {
  arrayValue,
  draftPayloadRecord,
  formatEvidenceName,
  formatRankComponent,
  isRecord,
  issueMessages,
  recordValue,
  sourceLabel,
  textAt,
  textValue,
  valueAt,
  verificationCheckRows,
} from "./studyDesignWorkbenchHelpers";

export function PhenotypeRecommendationPanel({
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
