import { useState } from "react";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useConcept,
  useConceptAncestors,
  useConceptRelationships,
  useConceptMapsFrom,
} from "@/features/vocabulary/hooks/useVocabularySearch";

type Tab = "info" | "hierarchy" | "relationships" | "maps-from";

const TABS: { id: Tab; label: string }[] = [
  { id: "info", label: "Info" },
  { id: "hierarchy", label: "Hierarchy" },
  { id: "relationships", label: "Relationships" },
  { id: "maps-from", label: "Maps From" },
];

export interface ConceptSetItemDetailExpanderProps {
  conceptId: number;
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
      <span className="text-xs text-text-primary">{value ?? "--"}</span>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-6">
      <Loader2 size={16} className="animate-spin text-success" />
    </div>
  );
}

export function ConceptSetItemDetailExpander({
  conceptId,
}: ConceptSetItemDetailExpanderProps) {
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [relationshipsPage, setRelationshipsPage] = useState(1);

  const { data: concept, isLoading: isLoadingConcept } = useConcept(conceptId);
  const { data: ancestors, isLoading: isLoadingAncestors } = useConceptAncestors(
    activeTab === "hierarchy" ? conceptId : null,
  );
  const { data: relationships, isLoading: isLoadingRels } = useConceptRelationships(
    activeTab === "relationships" ? conceptId : null,
    relationshipsPage,
  );
  const { data: mapsFrom, isLoading: isLoadingMaps } = useConceptMapsFrom(
    activeTab === "maps-from" ? conceptId : null,
  );

  return (
    <div className="border-t border-teal-400/20 bg-surface-base px-4 py-3">
      {/* Tab Bar */}
      <div className="flex items-center gap-0.5 mb-3 border-b border-border-default">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-3 py-2 text-xs uppercase tracking-wide transition-colors",
              activeTab === tab.id
                ? "text-success font-medium"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-success" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* Info Tab */}
        {activeTab === "info" && (
          <div className="space-y-3">
            {isLoadingConcept ? (
              <LoadingSpinner />
            ) : !concept ? (
              <p className="text-xs text-critical">Failed to load concept</p>
            ) : (
              <>
                {/* 2-column info grid */}
                <div className="grid grid-cols-2 gap-3 rounded border border-border-default bg-surface-raised p-3">
                  <InfoField label="Full Name" value={concept.concept_name} />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold">
                      Vocabulary
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-text-primary">
                        {concept.vocabulary_id}
                      </span>
                      <span className="font-['IBM_Plex_Mono',monospace] text-[10px] tabular-nums text-accent">
                        {concept.concept_code}
                      </span>
                      {concept.standard_concept === "S" && (
                        <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-success/15 text-success">
                          Standard
                        </span>
                      )}
                    </div>
                  </div>
                  <InfoField label="Concept Class" value={concept.concept_class_id} />
                  <InfoField label="Domain" value={concept.domain_id} />
                </div>

                {/* Synonyms — full width if present */}
                {concept.synonyms && concept.synonyms.length > 0 && (
                  <div className="rounded border border-border-default bg-surface-raised p-3">
                    <span className="text-[10px] uppercase tracking-wider text-text-ghost font-semibold block mb-2">
                      Synonyms
                    </span>
                    <ul className="space-y-0.5">
                      {concept.synonyms.map(
                        (syn: { concept_synonym_name: string }, i: number) => (
                          <li key={i} className="text-xs text-text-secondary">
                            {syn.concept_synonym_name}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Hierarchy Tab */}
        {activeTab === "hierarchy" && (
          <div>
            {isLoadingAncestors ? (
              <LoadingSpinner />
            ) : !ancestors || ancestors.length === 0 ? (
              <p className="text-xs text-text-ghost">No ancestors found</p>
            ) : (
              <div className="space-y-0.5">
                {ancestors.map(
                  (
                    anc: {
                      concept_id: number;
                      concept_name: string;
                      min_levels_of_separation?: number;
                    },
                    i: number,
                  ) => {
                    const depth = anc.min_levels_of_separation ?? i;
                    const isCurrent = anc.concept_id === conceptId;
                    return (
                      <div
                        key={anc.concept_id}
                        className="flex items-center gap-1"
                        style={{ paddingLeft: `${depth * 12}px` }}
                      >
                        {depth > 0 && (
                          <span className="text-text-ghost text-xs select-none">
                            →
                          </span>
                        )}
                        <span
                          className={cn(
                            "text-xs",
                            isCurrent
                              ? "font-semibold text-text-primary"
                              : "text-text-secondary",
                          )}
                        >
                          {anc.concept_name}
                        </span>
                        <span className="font-['IBM_Plex_Mono',monospace] text-[10px] tabular-nums text-accent ml-1">
                          {anc.concept_id}
                        </span>
                      </div>
                    );
                  },
                )}
                {/* Current concept bolded at the leaf */}
                {concept && !ancestors.some((a: { concept_id: number }) => a.concept_id === conceptId) && (
                  <div
                    className="flex items-center gap-1"
                    style={{ paddingLeft: `${(ancestors.length) * 12}px` }}
                  >
                    <span className="text-text-ghost text-xs select-none">→</span>
                    <span className="text-xs font-semibold text-text-primary">
                      {concept?.concept_name}
                    </span>
                    <span className="font-['IBM_Plex_Mono',monospace] text-[10px] tabular-nums text-accent ml-1">
                      {conceptId}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Relationships Tab */}
        {activeTab === "relationships" && (() => {
          const totalPages = relationships
            ? Math.max(1, Math.ceil(relationships.total / relationships.limit))
            : 1;
          return (
            <div>
              {isLoadingRels ? (
                <LoadingSpinner />
              ) : !relationships?.items || relationships.items.length === 0 ? (
                <p className="text-xs text-text-ghost">No relationships found</p>
              ) : (
                <div className="rounded border border-border-default bg-surface-raised overflow-hidden">
                  <div className="divide-y divide-border-default">
                    {relationships.items.map(
                      (rel: {
                        relationship_id: string;
                        concept_id_2: number;
                        related_concept: {
                          concept_id: number;
                          concept_name: string;
                          domain_id: string;
                          vocabulary_id: string;
                        };
                      }) => (
                        <div
                          key={`${rel.relationship_id}-${rel.concept_id_2}`}
                          className="flex items-center gap-2 px-3 py-1.5"
                        >
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium bg-domain-observation/15 text-domain-observation shrink-0">
                            {rel.relationship_id}
                          </span>
                          <span className="font-['IBM_Plex_Mono',monospace] text-[10px] tabular-nums text-accent shrink-0">
                            {rel.related_concept.concept_id}
                          </span>
                          <span className="text-xs text-text-primary truncate flex-1">
                            {rel.related_concept.concept_name}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-3 py-1.5 border-t border-border-default">
                      <p className="text-[10px] text-text-ghost">
                        Page {relationshipsPage} of {totalPages} &mdash;{" "}
                        {relationships.total} total
                      </p>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            setRelationshipsPage((p) => Math.max(1, p - 1))
                          }
                          disabled={relationshipsPage <= 1}
                          className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft size={12} />
                        </button>
                        <span className="text-[10px] text-text-secondary px-1">
                          {relationshipsPage} / {totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRelationshipsPage((p) =>
                              Math.min(totalPages, p + 1),
                            )
                          }
                          disabled={relationshipsPage >= totalPages}
                          className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Maps From Tab */}
        {activeTab === "maps-from" && (
          <div>
            {isLoadingMaps ? (
              <LoadingSpinner />
            ) : !mapsFrom?.data || mapsFrom.data.length === 0 ? (
              <p className="text-xs text-text-ghost">
                No source codes map to this concept
              </p>
            ) : (
              <div className="rounded border border-border-default bg-surface-raised overflow-hidden">
                <div className="divide-y divide-border-default">
                  {mapsFrom.data.map(
                    (
                      entry: {
                        concept_id: number;
                        concept_code: string;
                        concept_name: string;
                        vocabulary_id: string;
                        concept_class_id?: string;
                      },
                    ) => (
                      <div
                        key={entry.concept_id}
                        className="flex items-center gap-2 px-3 py-1.5"
                      >
                        <span className="font-['IBM_Plex_Mono',monospace] text-[10px] tabular-nums text-accent shrink-0">
                          {entry.concept_code}
                        </span>
                        <span className="text-xs text-text-primary truncate flex-1">
                          {entry.concept_name}
                        </span>
                        <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-accent/15 text-accent shrink-0">
                          {entry.vocabulary_id}
                        </span>
                      </div>
                    ),
                  )}
                </div>
                {mapsFrom.total > mapsFrom.data.length && (
                  <div className="px-3 py-1.5 border-t border-border-default text-center">
                    <p className="text-[10px] text-text-ghost">
                      Showing {mapsFrom.data.length} of {mapsFrom.total} source
                      codes
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
