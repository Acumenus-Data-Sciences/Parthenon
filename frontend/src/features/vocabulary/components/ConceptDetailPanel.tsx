import { useState, useEffect } from "react";
import { Loader2, ExternalLink, ChevronLeft, ChevronRight, Copy, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
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

const TABS: { id: Tab; label: string }[] = [
  { id: "info", label: "Info" },
  { id: "relationships", label: "Relationships" },
  { id: "maps-from", label: "Maps From" },
  { id: "hierarchy", label: "Hierarchy" },
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
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [relPage, setRelPage] = useState(1);
  const [showAddToSet, setShowAddToSet] = useState(false);

  const searchContext = {
    query: new URL(window.location.href).searchParams.get("q") ?? undefined,
    domain: new URL(window.location.href).searchParams.get("domain") ?? undefined,
    vocabulary: new URL(window.location.href).searchParams.get("vocabulary") ?? undefined,
    standard: new URL(window.location.href).searchParams.get("standard") ?? undefined,
  };

  // Reset relationship page when concept changes
  useEffect(() => {
    setRelPage(1);
  }, [conceptId]);

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
        <p className="text-sm text-text-muted">Select a concept to view details</p>
        <p className="mt-1 text-xs text-text-ghost">
          Search and click a concept from the left panel
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
        <p className="text-sm text-critical">Failed to load concept</p>
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
              toast.success("Concept ID copied");
            }}
            className="p-0.5 rounded text-text-ghost hover:text-accent transition-colors"
            title="Copy concept ID"
          >
            <Copy size={12} />
          </button>
          {isStandard && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-success/15 text-success">
              Standard
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
            Add to Set
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
            {tab.label}
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
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-border-default bg-surface-overlay p-4">
                <InfoField label="Concept Code" value={concept.concept_code} />
                <InfoField label="Domain" value={concept.domain_id} />
                <InfoField label="Vocabulary" value={concept.vocabulary_id} />
                <InfoField
                  label="Concept Class"
                  value={concept.concept_class_id}
                />
                <InfoField
                  label="Standard Concept"
                  value={
                    concept.standard_concept === "S"
                      ? "Standard"
                      : concept.standard_concept === "C"
                        ? "Classification"
                        : "Non-standard"
                  }
                />
                <InfoField
                  label="Invalid Reason"
                  value={concept.invalid_reason ?? "Valid"}
                />
                <InfoField
                  label="Valid Start Date"
                  value={concept.valid_start_date}
                />
                <InfoField
                  label="Valid End Date"
                  value={concept.valid_end_date}
                />
              </div>
            </section>

            {/* Synonyms */}
            {concept.synonyms && concept.synonyms.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
                  Synonyms
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
                Ancestors
              </h3>
              {isLoadingAnc ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2
                    size={16}
                    className="animate-spin text-text-muted"
                  />
                </div>
              ) : !ancestors || ancestors.length === 0 ? (
                <p className="text-xs text-text-ghost">No ancestors found</p>
              ) : (
                <div className="rounded-lg border border-border-default bg-surface-overlay overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-overlay">
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          ID
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          Name
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          Domain
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          Vocabulary
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
                Relationships
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
                  No relationships found
                </p>
              ) : (
                <div className="rounded-lg border border-border-default bg-surface-overlay overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-overlay">
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          Relationship
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          Related ID
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          Related Name
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          Domain
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          Vocabulary
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
                      Showing {(relPage - 1) * relationships.limit + 1}–{Math.min(relPage * relationships.limit, relationships.total)} of{" "}
                      {relationships.total}
                    </p>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setRelPage((p) => Math.max(1, p - 1))}
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
                          onClick={() => setRelPage((p) => Math.min(totalPages, p + 1))}
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
              Source Codes Mapping To This Concept
            </h3>
            <p className="text-[10px] text-text-ghost mb-3">
              Source vocabulary codes (ICD-10, SNOMED, RxNorm, etc.) that map to this standard concept
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
                  No source codes map to this concept
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border-default bg-surface-overlay overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-overlay">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Code
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Vocabulary
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Class
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
                      Showing {mapsFrom.data.length} of {mapsFrom.total} source codes
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
              Concept Hierarchy
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
