import { useState } from "react";
import { Loader2, ExternalLink, ChevronLeft, ChevronRight, Copy, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/i18n/format";
import {
  useConcept,
  useConceptRelationships,
  useConceptAncestors,
  useConceptMapsFrom,
} from "../hooks/useVocabularySearch";
import { useConceptHierarchy } from "../hooks/useConceptHierarchy";
import { HierarchyTree } from "./HierarchyTree";
import { AddToConceptSetModal } from "./AddToConceptSetModal";
import { toast } from "@/components/ui/Toast";

type Tab = "info" | "relationships" | "maps-from" | "hierarchy";

const TABS: { id: Tab; labelKey: string }[] = [
  { id: "info", labelKey: "info" },
  { id: "relationships", labelKey: "relationships" },
  { id: "maps-from", labelKey: "mapsFrom" },
  { id: "hierarchy", labelKey: "hierarchy" },
];

interface ConceptDetailPanelProps {
  conceptId: number | null;
  onSelectConcept?: (id: number) => void;
}

function InfoField({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">
        {label}
      </span>
      <span className="text-sm text-text-primary">
        {value ?? "--"}
      </span>
    </div>
  );
}

export function ConceptDetailPanel({ conceptId, onSelectConcept }: ConceptDetailPanelProps) {
  const { t } = useTranslation("app");
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [relPageState, setRelPageState] = useState<{
    conceptId: number | null;
    page: number;
  }>({ conceptId: null, page: 1 });
  const [showAddToSet, setShowAddToSet] = useState(false);
  const relPage = relPageState.conceptId === conceptId ? relPageState.page : 1;
  const setRelPageForConcept = (page: number) => {
    setRelPageState({ conceptId, page });
  };

  const searchContext = {
    query: new URL(window.location.href).searchParams.get("q") ?? undefined,
    domain: new URL(window.location.href).searchParams.get("domain") ?? undefined,
    vocabulary: new URL(window.location.href).searchParams.get("vocabulary") ?? undefined,
    standard: new URL(window.location.href).searchParams.get("standard") ?? undefined,
  };

  const { data: concept, isLoading } = useConcept(conceptId);
  const { data: relationships, isLoading: isLoadingRels } =
    useConceptRelationships(
      activeTab === "relationships" ? conceptId : null,
      relPage,
    );
  const { data: ancestors, isLoading: isLoadingAnc } = useConceptAncestors(
    activeTab === "info" ? conceptId : null,
  );
  const { data: hierarchy, isLoading: isLoadingHierarchy } =
    useConceptHierarchy(activeTab === "hierarchy" ? conceptId : null);
  const { data: mapsFrom, isLoading: isLoadingMapsFrom } =
    useConceptMapsFrom(activeTab === "maps-from" ? conceptId : null);

  if (!conceptId) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8">
        <ExternalLink size={32} className="text-text-ghost mb-4" />
        <p className="text-sm text-text-muted">{t("vocabulary.conceptDetail.empty.title")}</p>
        <p className="mt-1 text-xs text-text-ghost">
          {t("vocabulary.conceptDetail.empty.subtitle")}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (!concept) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-critical">{t("vocabulary.conceptDetail.errors.failedLoad")}</p>
      </div>
    );
  }

  const isStandard = concept.standard_concept === "S";

  return (
    <div className="flex flex-col h-full">
      {/* Concept Header */}
      <div className="px-6 py-5 border-b border-border-default bg-surface-raised">
        <div className="flex items-center gap-3 mb-2">
          <span className="font-['IBM_Plex_Mono',monospace] text-sm tabular-nums text-accent">
            {concept.concept_id}
          </span>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(String(concept.concept_id));
              toast.success(t("vocabulary.conceptDetail.toasts.conceptIdCopied"));
            }}
            className="p-0.5 rounded text-text-ghost hover:text-accent transition-colors"
            title={t("vocabulary.conceptDetail.actions.copyConceptId")}
          >
            <Copy size={12} />
          </button>
          {isStandard && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-success/15 text-success">
              {t("vocabulary.conceptDetail.values.standard")}
            </span>
          )}
        </div>
        <h2 className="text-xl font-semibold text-text-primary leading-snug">
          {concept.concept_name}
        </h2>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="inline-flex items-center rounded px-2 py-1 text-xs font-medium bg-info/15 text-info">
            {concept.domain_id}
          </span>
          <span className="inline-flex items-center rounded px-2 py-1 text-xs font-medium bg-accent/15 text-accent">
            {concept.vocabulary_id}
          </span>
          <span className="inline-flex items-center rounded px-2 py-1 text-xs font-medium bg-text-muted/15 text-text-muted">
            {concept.concept_class_id}
          </span>
          <button
            type="button"
            onClick={() => setShowAddToSet(true)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-success/15 text-success hover:bg-success/25 transition-colors ml-auto"
          >
            <Plus size={12} />
            {t("vocabulary.conceptDetail.actions.addToSet")}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 border-b border-border-default">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-3 py-2.5 text-xs uppercase tracking-wide transition-colors",
              activeTab === tab.id
                ? "text-text-primary font-medium"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {t(`vocabulary.conceptDetail.tabs.${tab.labelKey}`)}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {activeTab === "info" && (
          <div className="space-y-6">
            {/* Basic Info */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                {t("vocabulary.conceptDetail.sections.basicInformation")}
              </h3>
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-border-default bg-surface-overlay p-4">
                <InfoField label={t("vocabulary.conceptDetail.fields.conceptCode")} value={concept.concept_code} />
                <InfoField label={t("vocabulary.conceptDetail.fields.domain")} value={concept.domain_id} />
                <InfoField label={t("vocabulary.conceptDetail.fields.vocabulary")} value={concept.vocabulary_id} />
                <InfoField
                  label={t("vocabulary.conceptDetail.fields.conceptClass")}
                  value={concept.concept_class_id}
                />
                <InfoField
                  label={t("vocabulary.conceptDetail.fields.standardConcept")}
                  value={
                    concept.standard_concept === "S"
                      ? t("vocabulary.conceptDetail.values.standard")
                      : concept.standard_concept === "C"
                        ? t("vocabulary.conceptDetail.values.classification")
                        : t("vocabulary.conceptDetail.values.nonStandard")
                  }
                />
                <InfoField
                  label={t("vocabulary.conceptDetail.fields.invalidReason")}
                  value={concept.invalid_reason ?? t("vocabulary.conceptDetail.values.valid")}
                />
                <InfoField
                  label={t("vocabulary.conceptDetail.fields.validStartDate")}
                  value={concept.valid_start_date}
                />
                <InfoField
                  label={t("vocabulary.conceptDetail.fields.validEndDate")}
                  value={concept.valid_end_date}
                />
              </div>
            </section>

            {/* Synonyms */}
            {concept.synonyms && concept.synonyms.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                  {t("vocabulary.conceptDetail.sections.synonyms")}
                </h3>
                <div className="rounded-lg border border-border-default bg-surface-overlay p-4">
                  <ul className="space-y-1">
                    {concept.synonyms.map((syn: { concept_synonym_name: string }, i: number) => (
                      <li key={i} className="text-sm text-text-primary">
                        {syn.concept_synonym_name}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* Ancestors */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                {t("vocabulary.conceptDetail.sections.ancestors")}
              </h3>
              {isLoadingAnc ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2
                    size={16}
                    className="animate-spin text-text-muted"
                  />
                </div>
              ) : !ancestors || ancestors.length === 0 ? (
                <p className="text-xs text-text-ghost">{t("vocabulary.conceptDetail.empty.noAncestors")}</p>
              ) : (
                <div className="rounded-lg border border-border-default bg-surface-overlay overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-overlay">
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          {t("vocabulary.conceptDetail.table.id")}
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          {t("vocabulary.conceptDetail.table.name")}
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          {t("vocabulary.conceptDetail.table.domain")}
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          {t("vocabulary.conceptDetail.table.vocabulary")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ancestors.map((anc, i) => (
                        <tr
                          key={anc.concept_id}
                          onClick={() => onSelectConcept?.(anc.concept_id)}
                          className={cn(
                            "border-t border-border-default transition-colors",
                            i % 2 === 0 ? "bg-surface-overlay" : "bg-surface-raised",
                            onSelectConcept && "cursor-pointer hover:bg-surface-elevated",
                          )}
                        >
                          <td className="px-3 py-2 text-xs font-['IBM_Plex_Mono',monospace] tabular-nums text-accent">
                            {anc.concept_id}
                          </td>
                          <td className="px-3 py-2 text-xs text-text-primary">
                            {anc.concept_name}
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-info/15 text-info">
                              {anc.domain_id}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-accent/15 text-accent">
                              {anc.vocabulary_id}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "relationships" && (() => {
          const totalPages = relationships ? Math.max(1, Math.ceil(relationships.total / relationships.limit)) : 1;
          return (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                {t("vocabulary.conceptDetail.sections.relationships")}
              </h3>
              {isLoadingRels ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2
                    size={18}
                    className="animate-spin text-text-muted"
                  />
                </div>
              ) : !relationships?.items || relationships.items.length === 0 ? (
                <p className="text-xs text-text-ghost">
                  {t("vocabulary.conceptDetail.empty.noRelationships")}
                </p>
              ) : (
                <div className="rounded-lg border border-border-default bg-surface-overlay overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-overlay">
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          {t("vocabulary.conceptDetail.table.relationship")}
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          {t("vocabulary.conceptDetail.table.relatedId")}
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          {t("vocabulary.conceptDetail.table.relatedName")}
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          {t("vocabulary.conceptDetail.table.domain")}
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          {t("vocabulary.conceptDetail.table.vocabulary")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {relationships.items.map((rel, i) => (
                        <tr
                          key={`${rel.relationship_id}-${rel.concept_id_2}`}
                          onClick={() => onSelectConcept?.(rel.related_concept.concept_id)}
                          className={cn(
                            "border-t border-border-default transition-colors",
                            i % 2 === 0 ? "bg-surface-overlay" : "bg-surface-raised",
                            onSelectConcept && "cursor-pointer hover:bg-surface-elevated",
                          )}
                        >
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-domain-observation/15 text-domain-observation">
                              {rel.relationship_id}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs font-['IBM_Plex_Mono',monospace] tabular-nums text-accent">
                            {rel.related_concept.concept_id}
                          </td>
                          <td className="px-3 py-2 text-xs text-text-primary">
                            {rel.related_concept.concept_name}
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-info/15 text-info">
                              {rel.related_concept.domain_id}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-accent/15 text-accent">
                              {rel.related_concept.vocabulary_id}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Pagination */}
                  <div className="flex items-center justify-between px-3 py-2 border-t border-border-default">
                    <p className="text-[10px] text-text-ghost">
                      {t("vocabulary.conceptDetail.pagination.showingRange", {
                        start: formatNumber((relPage - 1) * relationships.limit + 1),
                        end: formatNumber(Math.min(relPage * relationships.limit, relationships.total)),
                        total: formatNumber(relationships.total),
                      })}
                    </p>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setRelPageForConcept(Math.max(1, relPage - 1))}
                          disabled={relPage <= 1}
                          className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span className="text-[10px] text-text-secondary px-1">
                          {relPage} / {totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRelPageForConcept(Math.min(totalPages, relPage + 1))}
                          disabled={relPage >= totalPages}
                          className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {activeTab === "maps-from" && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
              {t("vocabulary.conceptDetail.sections.mapsFrom")}
            </h3>
            <p className="text-[10px] text-text-ghost mb-3">
              {t("vocabulary.conceptDetail.sections.mapsFromDescription")}
            </p>
            {isLoadingMapsFrom ? (
              <div className="flex items-center justify-center py-8">
                <Loader2
                  size={18}
                  className="animate-spin text-text-muted"
                />
              </div>
            ) : !mapsFrom?.data || mapsFrom.data.length === 0 ? (
              <div className="rounded-lg border border-border-default bg-surface-overlay p-6 text-center">
                <p className="text-xs text-text-ghost">
                  {t("vocabulary.conceptDetail.empty.noSourceCodes")}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border-default bg-surface-overlay overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-overlay">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        {t("vocabulary.conceptDetail.table.code")}
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        {t("vocabulary.conceptDetail.table.name")}
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        {t("vocabulary.conceptDetail.table.vocabulary")}
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        {t("vocabulary.conceptDetail.table.class")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapsFrom.data.map((entry, i) => (
                      <tr
                        key={entry.concept_id}
                        className={cn(
                          "border-t border-border-default",
                          i % 2 === 0 ? "bg-surface-overlay" : "bg-surface-raised",
                        )}
                      >
                        <td className="px-3 py-2 text-xs font-['IBM_Plex_Mono',monospace] tabular-nums text-accent">
                          {entry.concept_code}
                        </td>
                        <td className="px-3 py-2 text-xs text-text-primary">
                          {entry.concept_name}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-accent/15 text-accent">
                            {entry.vocabulary_id}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-text-muted/15 text-text-muted">
                            {entry.concept_class_id}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mapsFrom.total > mapsFrom.data.length && (
                  <div className="px-3 py-2 border-t border-border-default text-center">
                    <p className="text-[10px] text-text-ghost">
                      {t("vocabulary.conceptDetail.pagination.showingSourceCodes", {
                        shown: formatNumber(mapsFrom.data.length),
                        total: formatNumber(mapsFrom.total),
                      })}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "hierarchy" && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
              {t("vocabulary.conceptDetail.sections.hierarchy")}
            </h3>
            <HierarchyTree
              tree={hierarchy ?? null}
              isLoading={isLoadingHierarchy}
              currentConceptId={conceptId ?? undefined}
            />
          </div>
        )}
      </div>

      {/* Add to Concept Set Modal */}
      {showAddToSet && concept && (
        <AddToConceptSetModal
          open={showAddToSet}
          onClose={() => setShowAddToSet(false)}
          conceptId={concept.concept_id}
          conceptName={concept.concept_name}
          searchContext={searchContext}
        />
      )}
    </div>
  );
}
