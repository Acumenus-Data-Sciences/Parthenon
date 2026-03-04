import { useState } from "react";
import {
  Loader2,
  Plus,
  Search,
  X,
  CheckCircle2,
  Hash,
  GitBranch,
  MapPin,
  Ban,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConceptSetItemRow } from "./ConceptSetItemRow";
import {
  useResolveConceptSet,
  useAddConceptSetItem,
  useUpdateConceptSetItem,
  useRemoveConceptSetItem,
  useBulkUpdateConceptSetItems,
} from "../hooks/useConceptSets";
import type { ConceptSet } from "../types/conceptSet";
import { useVocabularySearch } from "@/features/vocabulary/hooks/useVocabularySearch";

interface ConceptSetEditorProps {
  conceptSet: ConceptSet;
}

export function ConceptSetEditor({ conceptSet }: ConceptSetEditorProps) {
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(
    new Set(),
  );

  const {
    data: resolveResult,
    isLoading: isResolving,
    refetch: refetchResolve,
  } = useResolveConceptSet(showResolve ? conceptSet.id : null);

  const addItemMutation = useAddConceptSetItem();
  const updateItemMutation = useUpdateConceptSetItem();
  const removeItemMutation = useRemoveConceptSetItem();
  const bulkUpdateMutation = useBulkUpdateConceptSetItems();

  const { data: searchResults, isLoading: isSearching } =
    useVocabularySearch(searchQuery, {});

  const items = conceptSet.items ?? [];
  const allSelected =
    items.length > 0 && selectedItemIds.size === items.length;
  const someSelected = selectedItemIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(items.map((item) => item.id)));
    }
  };

  const toggleSelectItem = (itemId: number) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleBulkUpdate = (
    field: "is_excluded" | "include_descendants" | "include_mapped",
    value: boolean,
  ) => {
    if (selectedItemIds.size === 0) return;
    bulkUpdateMutation.mutate(
      {
        setId: conceptSet.id,
        payload: {
          item_ids: Array.from(selectedItemIds),
          [field]: value,
        },
      },
      {
        onSuccess: () => {
          setSelectedItemIds(new Set());
        },
      },
    );
  };

  const handleToggle = (
    itemId: number,
    field: "is_excluded" | "include_descendants" | "include_mapped",
    value: boolean,
  ) => {
    updateItemMutation.mutate({
      setId: conceptSet.id,
      itemId,
      payload: { [field]: value },
    });
  };

  const handleRemoveItem = (itemId: number) => {
    removeItemMutation.mutate({ setId: conceptSet.id, itemId });
  };

  const handleAddConcept = (conceptId: number) => {
    addItemMutation.mutate(
      {
        setId: conceptSet.id,
        payload: {
          concept_id: conceptId,
          is_excluded: false,
          include_descendants: true,
          include_mapped: false,
        },
      },
      {
        onSuccess: () => {
          setSearchQuery("");
        },
      },
    );
  };

  const handleResolve = () => {
    setShowResolve(true);
    refetchResolve();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddPanel(!showAddPanel)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              showAddPanel
                ? "bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30"
                : "bg-[#151518] text-[#C5C0B8] border border-[#232328] hover:bg-[#1A1A1E] hover:text-[#F0EDE8]",
            )}
          >
            {showAddPanel ? <X size={14} /> : <Plus size={14} />}
            {showAddPanel ? "Close Search" : "Add Concept"}
          </button>

          <span className="text-xs text-[#8A857D]">
            {items.length} items
          </span>
        </div>

        <button
          type="button"
          onClick={handleResolve}
          disabled={isResolving}
          className="inline-flex items-center gap-2 rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#C5C0B8] hover:bg-[#1A1A1E] hover:text-[#F0EDE8] transition-colors disabled:opacity-50"
        >
          {isResolving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <CheckCircle2 size={14} />
          )}
          Resolve
          {resolveResult && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-[#2DD4BF]/15 px-2 py-0.5 text-xs font-medium text-[#2DD4BF]">
              <Hash size={10} />
              {resolveResult.count.toLocaleString()}
            </span>
          )}
        </button>
      </div>

      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="flex items-center gap-2 rounded-lg border border-[#2DD4BF]/20 bg-[#2DD4BF]/5 px-4 py-2">
          <span className="text-xs font-medium text-[#2DD4BF]">
            {selectedItemIds.size} selected
          </span>
          <div className="mx-2 h-4 w-px bg-[#232328]" />
          <button
            type="button"
            onClick={() => handleBulkUpdate("include_descendants", true)}
            disabled={bulkUpdateMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-[#C5C0B8] bg-[#1A1A1F] border border-[#232328] hover:bg-[#232328] transition-colors disabled:opacity-50"
          >
            <GitBranch size={11} />
            Descendants On
          </button>
          <button
            type="button"
            onClick={() => handleBulkUpdate("include_descendants", false)}
            disabled={bulkUpdateMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-[#C5C0B8] bg-[#1A1A1F] border border-[#232328] hover:bg-[#232328] transition-colors disabled:opacity-50"
          >
            <GitBranch size={11} className="opacity-40" />
            Descendants Off
          </button>
          <button
            type="button"
            onClick={() => handleBulkUpdate("include_mapped", true)}
            disabled={bulkUpdateMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-[#C5C0B8] bg-[#1A1A1F] border border-[#232328] hover:bg-[#232328] transition-colors disabled:opacity-50"
          >
            <MapPin size={11} />
            Mapped On
          </button>
          <button
            type="button"
            onClick={() => handleBulkUpdate("include_mapped", false)}
            disabled={bulkUpdateMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-[#C5C0B8] bg-[#1A1A1F] border border-[#232328] hover:bg-[#232328] transition-colors disabled:opacity-50"
          >
            <MapPin size={11} className="opacity-40" />
            Mapped Off
          </button>
          <button
            type="button"
            onClick={() => handleBulkUpdate("is_excluded", true)}
            disabled={bulkUpdateMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-[#E85A6B] bg-[#1A1A1F] border border-[#232328] hover:bg-[#232328] transition-colors disabled:opacity-50"
          >
            <Ban size={11} />
            Exclude
          </button>
          <button
            type="button"
            onClick={() => handleBulkUpdate("is_excluded", false)}
            disabled={bulkUpdateMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-[#2DD4BF] bg-[#1A1A1F] border border-[#232328] hover:bg-[#232328] transition-colors disabled:opacity-50"
          >
            <Check size={11} />
            Include
          </button>
          {bulkUpdateMutation.isPending && (
            <Loader2 size={12} className="animate-spin text-[#8A857D] ml-1" />
          )}
        </div>
      )}

      {/* Add Concept Panel */}
      {showAddPanel && (
        <div className="rounded-lg border border-[#232328] bg-[#1A1A1E] p-4">
          <h4 className="text-sm font-semibold text-[#F0EDE8] mb-3">
            Search Vocabulary
          </h4>

          {/* Search Input */}
          <div className="relative mb-3">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search concepts by name or code..."
              className={cn(
                "w-full rounded-lg pl-9 pr-8 py-2 text-sm",
                "bg-[#0E0E11] border border-[#232328]",
                "text-[#F0EDE8] placeholder:text-[#5A5650]",
                "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
                "transition-colors",
              )}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5650] hover:text-[#C5C0B8] transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Search Results */}
          <div className="max-h-64 overflow-y-auto rounded-lg border border-[#232328] bg-[#151518]">
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin text-[#8A857D]" />
              </div>
            ) : searchQuery.length < 2 ? (
              <div className="flex items-center justify-center py-8 text-xs text-[#5A5650]">
                Type at least 2 characters to search
              </div>
            ) : !searchResults || searchResults.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-xs text-[#5A5650]">
                No concepts found
              </div>
            ) : (
              <div className="divide-y divide-[#232328]">
                {searchResults.map((concept) => {
                  const isStandard = concept.standard_concept === "S";
                  const alreadyAdded = items.some(
                    (item) => item.concept_id === concept.concept_id,
                  );

                  return (
                    <button
                      key={concept.concept_id}
                      type="button"
                      onClick={() => handleAddConcept(concept.concept_id)}
                      disabled={alreadyAdded || addItemMutation.isPending}
                      className={cn(
                        "flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors",
                        alreadyAdded
                          ? "opacity-50 cursor-not-allowed bg-[#151518]"
                          : "hover:bg-[#1C1C20]",
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-['IBM_Plex_Mono',monospace] text-xs tabular-nums text-[#C9A227]">
                            {concept.concept_id}
                          </span>
                          {isStandard && (
                            <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-[#2DD4BF]/15 text-[#2DD4BF]">
                              S
                            </span>
                          )}
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#60A5FA]/15 text-[#60A5FA]">
                            {concept.domain_id}
                          </span>
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#C9A227]/15 text-[#C9A227]">
                            {concept.vocabulary_id}
                          </span>
                        </div>
                        <p className="text-sm text-[#F0EDE8] truncate mt-0.5">
                          {concept.concept_name}
                        </p>
                      </div>
                      {alreadyAdded ? (
                        <span className="text-[10px] text-[#5A5650] shrink-0">
                          Added
                        </span>
                      ) : (
                        <Plus
                          size={14}
                          className="text-[#8A857D] shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resolve Result Panel */}
      {showResolve && resolveResult && (
        <div className="rounded-lg border border-[#2DD4BF]/20 bg-[#2DD4BF]/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[#2DD4BF]" />
            <p className="text-sm text-[#2DD4BF]">
              Resolved to{" "}
              <span className="font-semibold">
                {resolveResult.count.toLocaleString()}
              </span>{" "}
              concept{resolveResult.count !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Items Table */}
      {items.length > 0 ? (
        <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#1C1C20]">
                  <th className="px-3 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el)
                          el.indeterminate =
                            someSelected && !allSelected;
                      }}
                      onChange={toggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-[#323238] bg-[#0E0E11] text-[#2DD4BF] focus:ring-[#2DD4BF]/40 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                    Concept ID
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                    Domain
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                    Vocabulary
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                    Standard
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                    Excluded
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                    Descendants
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                    Mapped
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <ConceptSetItemRow
                    key={item.id}
                    item={item}
                    index={i}
                    isSelected={selectedItemIds.has(item.id)}
                    onSelectionChange={toggleSelectItem}
                    onToggle={handleToggle}
                    onRemove={handleRemoveItem}
                    isUpdating={updateItemMutation.isPending}
                    isRemoving={removeItemMutation.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-12">
          <Search size={24} className="text-[#323238] mb-3" />
          <p className="text-sm text-[#8A857D]">No concepts added yet</p>
          <p className="mt-1 text-xs text-[#5A5650]">
            Click &ldquo;Add Concept&rdquo; to search and add concepts to this
            set
          </p>
        </div>
      )}
    </div>
  );
}
