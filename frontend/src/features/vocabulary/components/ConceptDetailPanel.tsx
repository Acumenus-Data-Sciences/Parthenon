import { useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useConcept,
  useConceptRelationships,
  useConceptAncestors,
  useConceptMapsFrom,
} from "../hooks/useVocabularySearch";
import { useConceptHierarchy } from "../hooks/useConceptHierarchy";
import { HierarchyTree } from "./HierarchyTree";

type Tab = "info" | "relationships" | "maps-from" | "hierarchy";

const TABS: { id: Tab; label: string }[] = [
  { id: "info", label: "Info" },
  { id: "relationships", label: "Relationships" },
  { id: "maps-from", label: "Maps From" },
  { id: "hierarchy", label: "Hierarchy" },
];

interface ConceptDetailPanelProps {
  conceptId: number | null;
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
      <span className="text-[10px] uppercase tracking-wider text-[#5A5650] font-semibold">
        {label}
      </span>
      <span className="text-sm text-[#F0EDE8]">
        {value ?? "--"}
      </span>
    </div>
  );
}

export function ConceptDetailPanel({ conceptId }: ConceptDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [relPage] = useState(1);

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
        <ExternalLink size={32} className="text-[#323238] mb-4" />
        <p className="text-sm text-[#8A857D]">Select a concept to view details</p>
        <p className="mt-1 text-xs text-[#5A5650]">
          Search and click a concept from the left panel
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (!concept) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-[#E85A6B]">Failed to load concept</p>
      </div>
    );
  }

  const isStandard = concept.standard_concept === "S";

  return (
    <div className="flex flex-col h-full">
      {/* Concept Header */}
      <div className="px-6 py-5 border-b border-[#232328] bg-[#151518]">
        <div className="flex items-center gap-3 mb-2">
          <span className="font-['IBM_Plex_Mono',monospace] text-sm tabular-nums text-[#C9A227]">
            {concept.concept_id}
          </span>
          {isStandard && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/15 text-[#2DD4BF]">
              Standard
            </span>
          )}
        </div>
        <h2 className="text-xl font-semibold text-[#F0EDE8] leading-snug">
          {concept.concept_name}
        </h2>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="inline-flex items-center rounded px-2 py-1 text-xs font-medium bg-[#60A5FA]/15 text-[#60A5FA]">
            {concept.domain_id}
          </span>
          <span className="inline-flex items-center rounded px-2 py-1 text-xs font-medium bg-[#C9A227]/15 text-[#C9A227]">
            {concept.vocabulary_id}
          </span>
          <span className="inline-flex items-center rounded px-2 py-1 text-xs font-medium bg-[#8A857D]/15 text-[#8A857D]">
            {concept.concept_class_id}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 border-b border-[#232328]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-3 py-2.5 text-xs uppercase tracking-wide transition-colors",
              activeTab === tab.id
                ? "text-[#F0EDE8] font-medium"
                : "text-[#8A857D] hover:text-[#C5C0B8]",
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A227]" />
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8A857D] mb-3">
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-[#232328] bg-[#1A1A1E] p-4">
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

            {/* Ancestors */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8A857D] mb-3">
                Ancestors
              </h3>
              {isLoadingAnc ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2
                    size={16}
                    className="animate-spin text-[#8A857D]"
                  />
                </div>
              ) : !ancestors || ancestors.length === 0 ? (
                <p className="text-xs text-[#5A5650]">No ancestors found</p>
              ) : (
                <div className="rounded-lg border border-[#232328] bg-[#1A1A1E] overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#1C1C20]">
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
                          ID
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
                          Name
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
                          Domain
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
                          Vocabulary
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ancestors.map((anc, i) => (
                        <tr
                          key={anc.concept_id}
                          className={cn(
                            "border-t border-[#232328]",
                            i % 2 === 0 ? "bg-[#1A1A1E]" : "bg-[#151518]",
                          )}
                        >
                          <td className="px-3 py-2 text-xs font-['IBM_Plex_Mono',monospace] tabular-nums text-[#C9A227]">
                            {anc.concept_id}
                          </td>
                          <td className="px-3 py-2 text-xs text-[#F0EDE8]">
                            {anc.concept_name}
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-[#60A5FA]/15 text-[#60A5FA]">
                              {anc.domain_id}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-[#C9A227]/15 text-[#C9A227]">
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

        {activeTab === "relationships" && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8A857D] mb-3">
              Relationships
            </h3>
            {isLoadingRels ? (
              <div className="flex items-center justify-center py-8">
                <Loader2
                  size={18}
                  className="animate-spin text-[#8A857D]"
                />
              </div>
            ) : !relationships?.items || relationships.items.length === 0 ? (
              <p className="text-xs text-[#5A5650]">
                No relationships found
              </p>
            ) : (
              <div className="rounded-lg border border-[#232328] bg-[#1A1A1E] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#1C1C20]">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
                        Relationship
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
                        Related ID
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
                        Related Name
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
                        Domain
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
                        Vocabulary
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {relationships.items.map((rel, i) => (
                      <tr
                        key={`${rel.relationship_id}-${rel.concept_id_2}`}
                        className={cn(
                          "border-t border-[#232328]",
                          i % 2 === 0 ? "bg-[#1A1A1E]" : "bg-[#151518]",
                        )}
                      >
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#A78BFA]/15 text-[#A78BFA]">
                            {rel.relationship_id}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs font-['IBM_Plex_Mono',monospace] tabular-nums text-[#C9A227]">
                          {rel.related_concept.concept_id}
                        </td>
                        <td className="px-3 py-2 text-xs text-[#F0EDE8]">
                          {rel.related_concept.concept_name}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-[#60A5FA]/15 text-[#60A5FA]">
                            {rel.related_concept.domain_id}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-[#C9A227]/15 text-[#C9A227]">
                            {rel.related_concept.vocabulary_id}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {relationships.total > relationships.items.length && (
                  <div className="px-3 py-2 border-t border-[#232328] text-center">
                    <p className="text-[10px] text-[#5A5650]">
                      Showing {relationships.items.length} of{" "}
                      {relationships.total} relationships
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "maps-from" && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8A857D] mb-1">
              Source Codes Mapping To This Concept
            </h3>
            <p className="text-[10px] text-[#5A5650] mb-3">
              Source vocabulary codes (ICD-10, SNOMED, RxNorm, etc.) that map to this standard concept
            </p>
            {isLoadingMapsFrom ? (
              <div className="flex items-center justify-center py-8">
                <Loader2
                  size={18}
                  className="animate-spin text-[#8A857D]"
                />
              </div>
            ) : !mapsFrom?.data || mapsFrom.data.length === 0 ? (
              <div className="rounded-lg border border-[#232328] bg-[#1A1A1E] p-6 text-center">
                <p className="text-xs text-[#5A5650]">
                  No source codes map to this concept
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-[#232328] bg-[#1A1A1E] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#1C1C20]">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
                        Code
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
                        Vocabulary
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8A857D]">
                        Class
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapsFrom.data.map((entry, i) => (
                      <tr
                        key={entry.concept_id}
                        className={cn(
                          "border-t border-[#232328]",
                          i % 2 === 0 ? "bg-[#1A1A1E]" : "bg-[#151518]",
                        )}
                      >
                        <td className="px-3 py-2 text-xs font-['IBM_Plex_Mono',monospace] tabular-nums text-[#C9A227]">
                          {entry.concept_code}
                        </td>
                        <td className="px-3 py-2 text-xs text-[#F0EDE8]">
                          {entry.concept_name}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-[#C9A227]/15 text-[#C9A227]">
                            {entry.vocabulary_id}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-[#8A857D]/15 text-[#8A857D]">
                            {entry.concept_class_id}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mapsFrom.total > mapsFrom.data.length && (
                  <div className="px-3 py-2 border-t border-[#232328] text-center">
                    <p className="text-[10px] text-[#5A5650]">
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
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8A857D] mb-3">
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
    </div>
  );
}
