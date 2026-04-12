import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/Toast";
import {
  useConceptSets,
  useAddConceptSetItem,
  useCreateConceptSet,
} from "@/features/concept-sets/hooks/useConceptSets";
import type { ConceptSet } from "@/features/concept-sets/types/conceptSet";

interface AddToConceptSetModalProps {
  open: boolean;
  onClose: () => void;
  conceptId: number;
  conceptName: string;
  searchContext?: {
    query?: string;
    domain?: string;
    vocabulary?: string;
    standard?: string;
  };
}

export function AddToConceptSetModal({
  open,
  onClose,
  conceptId,
  conceptName,
  searchContext,
}: AddToConceptSetModalProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSetName, setNewSetName] = useState("");

  const { data: conceptSetsData, isLoading } = useConceptSets();
  const addItem = useAddConceptSetItem();
  const createSet = useCreateConceptSet();

  const conceptSets: ConceptSet[] = useMemo(() => {
    if (!conceptSetsData) return [];
    // Handle both paginated { items: [...] } and raw array responses
    if ("items" in conceptSetsData && Array.isArray(conceptSetsData.items)) {
      return conceptSetsData.items as ConceptSet[];
    }
    if (Array.isArray(conceptSetsData)) {
      return conceptSetsData as ConceptSet[];
    }
    return [];
  }, [conceptSetsData]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return conceptSets;
    const lower = filter.toLowerCase();
    return conceptSets.filter(
      (cs) =>
        cs.name.toLowerCase().includes(lower) ||
        (cs.description ?? "").toLowerCase().includes(lower),
    );
  }, [conceptSets, filter]);

  const buildContextParams = (): string => {
    if (!searchContext) return "";
    const params = new URLSearchParams();
    if (searchContext.query) params.set("q", searchContext.query);
    if (searchContext.domain) params.set("domain", searchContext.domain);
    if (searchContext.vocabulary) params.set("vocabulary", searchContext.vocabulary);
    if (searchContext.standard) params.set("standard", searchContext.standard);
    const str = params.toString();
    return str ? `?${str}` : "";
  };

  const handleAddToExisting = (setId: number, setName: string) => {
    addItem.mutate(
      {
        setId,
        payload: {
          concept_id: conceptId,
          is_excluded: false,
          include_descendants: true,
          include_mapped: false,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Added to "${setName}"`);
          onClose();
        },
        onError: () => {
          toast.error("Failed to add concept to set");
        },
      },
    );
  };

  const handleCreateNew = () => {
    const name = newSetName.trim() || conceptName;
    createSet.mutate(
      { name, description: "" },
      {
        onSuccess: (newSet) => {
          const setId: number =
            typeof newSet === "object" && newSet !== null && "id" in newSet
              ? (newSet as { id: number }).id
              : 0;

          if (!setId) {
            toast.error("Failed to retrieve new concept set ID");
            return;
          }

          addItem.mutate(
            {
              setId,
              payload: {
                concept_id: conceptId,
                is_excluded: false,
                include_descendants: true,
                include_mapped: false,
              },
            },
            {
              onSuccess: () => {
                toast.success(`Created "${name}" and added concept`);
                onClose();
                navigate(`/concept-sets/${setId}${buildContextParams()}`);
              },
              onError: () => {
                toast.error("Set created but failed to add concept");
                onClose();
                navigate(`/concept-sets/${setId}`);
              },
            },
          );
        },
        onError: () => {
          toast.error("Failed to create concept set");
        },
      },
    );
  };

  const handleOpenBuilder = () => {
    navigate(`/concept-sets${buildContextParams()}`);
    onClose();
  };

  if (!open) return null;

  const isPending = addItem.isPending || createSet.isPending;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal panel */}
      <div
        className={cn(
          "relative z-10 w-full max-w-md mx-4",
          "bg-surface-raised border border-white/10 rounded-xl shadow-2xl",
          "flex flex-col",
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/10">
          <div className="min-w-0 pr-4">
            <h2 className="text-base font-semibold text-text-primary">
              Add to Concept Set
            </h2>
            <p className="text-xs text-text-muted mt-0.5 truncate">
              <span className="font-['IBM_Plex_Mono',monospace] text-accent">
                {conceptId}
              </span>{" "}
              · {conceptName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 rounded-md text-text-ghost hover:text-text-primary hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-hidden">
          {/* Create New section */}
          <div>
            {!showCreateForm ? (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg",
                  "border-2 border-dashed border-success/40",
                  "text-left transition-colors",
                  "hover:border-success/70 hover:bg-success/5",
                )}
              >
                <div className="shrink-0 w-7 h-7 rounded-md bg-success/15 flex items-center justify-center">
                  <Plus size={14} className="text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-success">
                    Create New Concept Set
                  </p>
                  <p className="text-[10px] text-text-ghost">
                    Add concept and open in Builder
                  </p>
                </div>
              </button>
            ) : (
              <div
                className={cn(
                  "rounded-lg border border-success/40 bg-success/5 p-3",
                  "space-y-2",
                )}
              >
                <label className="text-[10px] font-medium text-success uppercase tracking-wide">
                  New Concept Set Name
                </label>
                <input
                  type="text"
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateNew();
                    if (e.key === "Escape") setShowCreateForm(false);
                  }}
                  placeholder={conceptName}
                  autoFocus
                  className={cn(
                    "w-full rounded-md px-3 py-1.5 text-sm",
                    "bg-surface-base border border-border-default",
                    "text-text-primary placeholder:text-text-ghost",
                    "focus:outline-none focus:border-success focus:ring-1 focus:ring-success/40",
                  )}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    disabled={isPending}
                    className={cn(
                      "flex-1 py-1.5 rounded-md text-xs font-medium transition-colors",
                      "bg-success text-surface-base hover:bg-success-dark",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "flex items-center justify-center gap-1.5",
                    )}
                  >
                    {isPending && (
                      <Loader2 size={11} className="animate-spin" />
                    )}
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-3 py-1.5 rounded-md text-xs text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] text-text-ghost uppercase tracking-wide">
              or add to existing
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Filter input */}
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
            />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter concept sets..."
              className={cn(
                "w-full rounded-lg pl-9 pr-3 py-2 text-sm",
                "bg-surface-base border border-border-default",
                "text-text-primary placeholder:text-text-ghost",
                "focus:outline-none focus:border-success focus:ring-1 focus:ring-success/40",
              )}
            />
          </div>

          {/* Set list */}
          <div className="rounded-lg border border-border-default bg-surface-base max-h-72 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={16} className="animate-spin text-text-muted" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs text-text-ghost">
                  {filter ? "No matching concept sets" : "No concept sets found"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border-default">
                {filtered.map((cs) => (
                  <button
                    key={cs.id}
                    type="button"
                    onClick={() => handleAddToExisting(cs.id, cs.name)}
                    disabled={isPending}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors",
                      "hover:bg-surface-overlay",
                      isPending && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary truncate">
                          {cs.name}
                        </p>
                        {cs.description && (
                          <p className="text-[10px] text-text-ghost truncate mt-0.5">
                            {cs.description}
                          </p>
                        )}
                        {/* Recent concept chips */}
                        {cs.recent_items &&
                          Object.keys(cs.recent_items).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {Object.entries(cs.recent_items)
                                .slice(0, 3)
                                .map(([id, name]) => (
                                  <span
                                    key={id}
                                    className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-surface-elevated text-text-muted truncate max-w-[120px]"
                                  >
                                    {name}
                                  </span>
                                ))}
                            </div>
                          )}
                      </div>
                      {/* Item count badge */}
                      {cs.items_count !== undefined && (
                        <span className="shrink-0 mt-0.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-medium bg-surface-elevated text-text-muted">
                          {cs.items_count}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between">
          <p className="text-[10px] text-text-ghost">
            Adds with Include Descendants
          </p>
          <button
            type="button"
            onClick={handleOpenBuilder}
            className="text-[10px] text-accent hover:text-accent-dark transition-colors"
          >
            Open Builder with current search →
          </button>
        </div>
      </div>
    </div>
  );
}
