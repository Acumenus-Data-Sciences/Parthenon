import { useState, Fragment } from "react";
import {
  Loader2,
  Search,
  CheckCircle2,
  Hash,
  GitBranch,
  MapPin,
  Ban,
  Check,
} from "lucide-react";
import { ConceptSetItemRow } from "./ConceptSetItemRow";
import { ConceptSetItemDetailExpander } from "./ConceptSetItemDetailExpander";
import {
  useResolveConceptSet,
  useAddConceptSetItem,
  useUpdateConceptSetItem,
  useRemoveConceptSetItem,
  useBulkUpdateConceptSetItems,
} from "../hooks/useConceptSets";
import type { ConceptSet } from "../types/conceptSet";

interface ConceptSetEditorProps {
  conceptSet: ConceptSet;
}

export function ConceptSetEditor({ conceptSet }: ConceptSetEditorProps) {
  const [showResolve, setShowResolve] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(
    new Set(),
  );
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);

  const {
    data: resolveResult,
    isLoading: isResolving,
    refetch: refetchResolve,
  } = useResolveConceptSet(showResolve ? conceptSet.id : null);

  const addItemMutation = useAddConceptSetItem();
  const updateItemMutation = useUpdateConceptSetItem();
  const removeItemMutation = useRemoveConceptSetItem();
  const bulkUpdateMutation = useBulkUpdateConceptSetItems();

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

  const handleResolve = () => {
    setShowResolve(true);
    refetchResolve();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
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
                  <Fragment key={item.id}>
                    <ConceptSetItemRow
                      item={item}
                      index={i}
                      isSelected={selectedItemIds.has(item.id)}
                      isHighlighted={expandedItemId === item.id}
                      onSelectionChange={toggleSelectItem}
                      onRowClick={() => {
                        setExpandedItemId(
                          expandedItemId === item.id ? null : item.id,
                        );
                      }}
                      onToggle={handleToggle}
                      onRemove={handleRemoveItem}
                      isUpdating={updateItemMutation.isPending}
                      isRemoving={removeItemMutation.isPending}
                    />
                    {expandedItemId === item.id && (
                      <tr>
                        <td
                          colSpan={10}
                          className="p-0 border-b border-teal-400/30"
                        >
                          <div className="border-x border-teal-400/30 bg-teal-400/5">
                            <ConceptSetItemDetailExpander
                              conceptId={item.concept_id}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
            Use the search panel to find and add concepts to this set
          </p>
        </div>
      )}

    </div>
  );
}
