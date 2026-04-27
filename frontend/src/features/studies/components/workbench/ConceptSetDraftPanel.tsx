import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { searchConcepts } from "@/features/vocabulary/api/vocabularyApi";
import type { Concept } from "@/features/vocabulary/types/vocabulary";
import type { StudyDesignAsset, StudyDesignDraftConcept } from "../../types/study";
import { ActionGateHint } from "./shared/ActionGateHint";
import { VerificationBadge } from "./shared/VerificationBadge";
import {
  arrayValue,
  conceptFromVocabulary,
  draftConceptArray,
  draftPayloadRecord,
  isRecord,
  issueMessages,
  recordValue,
  textAt,
  textValue,
} from "./studyDesignWorkbenchHelpers";

export function ConceptSetDraftPanel({
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
  const [searchError, setSearchError] = useState<string | null>(null);
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
    setSearchError(null);
    try {
      const result = await searchConcepts({ q: conceptQuery.trim(), standard: true, limit: 8 });
      setConceptResults(result.items);
    } catch (error) {
      setConceptResults([]);
      setSearchError(
        error instanceof Error
          ? error.message
          : t("studies.workbench.messages.searchFailed"),
      );
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
              {searchError && (
                <div className="mt-2 rounded-md border border-critical/40 bg-critical/10 px-2 py-1 text-[11px] text-critical" role="alert">
                  {searchError}
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
