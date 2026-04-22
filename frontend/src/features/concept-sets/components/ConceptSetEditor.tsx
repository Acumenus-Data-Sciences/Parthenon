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
  useUpdateConceptSetItem,
  useRemoveConceptSetItem,
  useBulkUpdateConceptSetItems,
} from "../hooks/useConceptSets";
import type { ConceptSet } from "../types/conceptSet";
import { useTranslation } from "react-i18next";

interface ConceptSetEditorProps {
  conceptSet: ConceptSet;
}

export function ConceptSetEditor({ conceptSet }: ConceptSetEditorProps) {
  const { t } = useTranslation("app");
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
          <span className="text-xs text-text-muted">
            {t("conceptSets.editor.itemCount", { count: items.length })}
          </span>
        </div>

        <button
          type="button"
          onClick={handleResolve}
          disabled={isResolving}
          className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors disabled:opacity-50"
        >
          {isResolving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <CheckCircle2 size={14} />
          )}
          {t("conceptSets.editor.resolve")}
          {resolveResult && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
              <Hash size={10} />
              {resolveResult.count.toLocaleString()}
            </span>
          )}
        </button>
      </div>

      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-4 py-2">
          <span className="text-xs font-medium text-success">
            {t("conceptSets.editor.selected", { count: selectedItemIds.size })}
          </span>
          <div className="mx-2 h-4 w-px bg-surface-elevated" />
          <button
            type="button"
            onClick={() => handleBulkUpdate("include_descendants", true)}
            disabled={bulkUpdateMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-text-secondary bg-surface-overlay border border-border-default hover:bg-surface-elevated transition-colors disabled:opacity-50"
          >
            <GitBranch size={11} />
            {t("conceptSets.editor.descendantsOn")}
          </button>
          <button
            type="button"
            onClick={() => handleBulkUpdate("include_descendants", false)}
            disabled={bulkUpdateMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-text-secondary bg-surface-overlay border border-border-default hover:bg-surface-elevated transition-colors disabled:opacity-50"
          >
            <GitBranch size={11} className="opacity-40" />
            {t("conceptSets.editor.descendantsOff")}
          </button>
          <button
            type="button"
            onClick={() => handleBulkUpdate("include_mapped", true)}
            disabled={bulkUpdateMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-text-secondary bg-surface-overlay border border-border-default hover:bg-surface-elevated transition-colors disabled:opacity-50"
          >
            <MapPin size={11} />
            {t("conceptSets.editor.mappedOn")}
          </button>
          <button
            type="button"
            onClick={() => handleBulkUpdate("include_mapped", false)}
            disabled={bulkUpdateMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-text-secondary bg-surface-overlay border border-border-default hover:bg-surface-elevated transition-colors disabled:opacity-50"
          >
            <MapPin size={11} className="opacity-40" />
            {t("conceptSets.editor.mappedOff")}
          </button>
          <button
            type="button"
            onClick={() => handleBulkUpdate("is_excluded", true)}
            disabled={bulkUpdateMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-critical bg-surface-overlay border border-border-default hover:bg-surface-elevated transition-colors disabled:opacity-50"
          >
            <Ban size={11} />
            {t("conceptSets.editor.exclude")}
          </button>
          <button
            type="button"
            onClick={() => handleBulkUpdate("is_excluded", false)}
            disabled={bulkUpdateMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-success bg-surface-overlay border border-border-default hover:bg-surface-elevated transition-colors disabled:opacity-50"
          >
            <Check size={11} />
            {t("conceptSets.editor.include")}
          </button>
          {bulkUpdateMutation.isPending && (
            <Loader2 size={12} className="animate-spin text-text-muted ml-1" />
          )}
        </div>
      )}

      {/* Resolve Result Panel */}
      {showResolve && resolveResult && (
        <div className="rounded-lg border border-success/20 bg-success/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-success" />
            <p className="text-sm text-success">
              {t("conceptSets.editor.resolvedTo", { count: resolveResult.count })}
            </p>
          </div>
        </div>
      )}

      {/* Items Table */}
      {items.length > 0 ? (
        <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-overlay">
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
                      className="h-3.5 w-3.5 rounded border-surface-highlight bg-surface-base text-success focus:ring-success/40 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {t("conceptSets.editor.columns.conceptId")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {t("conceptSets.editor.columns.name")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {t("conceptSets.editor.columns.domain")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {t("conceptSets.editor.columns.vocabulary")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {t("conceptSets.editor.columns.standard")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {t("conceptSets.editor.columns.excluded")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {t("conceptSets.editor.columns.descendants")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {t("conceptSets.editor.columns.mapped")}
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    {t("conceptSets.editor.columns.actions")}
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
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-12">
          <Search size={24} className="text-text-ghost mb-3" />
          <p className="text-sm text-text-muted">{t("conceptSets.editor.emptyTitle")}</p>
          <p className="mt-1 text-xs text-text-ghost">
            {t("conceptSets.editor.emptyMessage")}
          </p>
        </div>
      )}

    </div>
  );
}
