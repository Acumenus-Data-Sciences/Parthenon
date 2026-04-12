import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, Upload, Stethoscope, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { ConceptSetList } from "../components/ConceptSetList";
import { ConceptSetStatsBar } from "../components/ConceptSetStatsBar";
import { ImportConceptSetModal } from "../components/ImportConceptSetModal";
import { CreateFromBundleModal } from "../components/CreateFromBundleModal";
import { useCreateConceptSet } from "../hooks/useConceptSets";
import { getConceptSetTags } from "../api/conceptSetApi";
import { HelpButton } from "@/features/help";
import TagFilterBar from "@/components/ui/TagFilterBar";

export default function ConceptSetsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createMutation = useCreateConceptSet();
  const [isCreating, setIsCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showBundle, setShowBundle] = useState(false);

  // Search + tag filters
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // Stats bar quick-filter
  const [statFilter, setStatFilter] = useState<"with_items" | "public" | null>(null);

  const handleStatClick = (key: string) => {
    if (key === "total") {
      setStatFilter(null);
    } else if (key === "with_items" || key === "public") {
      setStatFilter((prev) => (prev === key ? null : key));
    }
  };

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch available tags
  const { data: allTags } = useQuery({
    queryKey: ["concept-set-tags"],
    queryFn: getConceptSetTags,
  });

  const tags = useMemo(() => allTags ?? [], [allTags]);

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  const handleCreate = () => {
    setIsCreating(true);
    createMutation.mutate(
      { name: "Untitled Concept Set" },
      {
        onSuccess: (cs) => {
          navigate(`/concept-sets/${cs.id}`);
        },
        onSettled: () => {
          setIsCreating(false);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Concept Sets</h1>
          <p className="mt-1 text-sm text-text-muted">
            Define and manage reusable concept sets for cohort definitions and
            analyses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton helpKey="concept-set-builder" />
          <button
            type="button"
            onClick={() => setShowBundle(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-secondary hover:border-surface-highlight transition-colors"
          >
            <Stethoscope size={16} />
            From Bundle
          </button>
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-secondary hover:border-surface-highlight transition-colors"
          >
            <Upload size={16} />
            Import
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors disabled:opacity-50"
          >
            {isCreating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            New Concept Set
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <ConceptSetStatsBar onStatClick={handleStatClick} activeKey={statFilter ?? undefined} />

      {/* Search + Tag Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search concept sets..."
            className={cn(
              "w-full rounded-lg pl-9 pr-8 py-2 text-sm",
              "bg-surface-base border border-border-default",
              "text-text-primary placeholder:text-text-ghost",
              "focus:outline-none focus:border-success focus:ring-1 focus:ring-[#2DD4BF]/40",
              "transition-colors",
            )}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-ghost hover:text-text-secondary transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tag chips */}
        {tags.length > 0 && (
          <TagFilterBar
            tags={tags}
            activeTags={selectedTags}
            onToggle={toggleTag}
            onClear={() => setSelectedTags([])}
            color="gold"
          />
        )}
      </div>

      {/* List */}
      <ConceptSetList
        search={search}
        tags={selectedTags}
        isPublic={statFilter === "public" || undefined}
        withItems={statFilter === "with_items" || undefined}
        onCreateFromBundle={() => setShowBundle(true)}
      />

      {/* Import modal */}
      <ImportConceptSetModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: ["concept-sets"] });
        }}
      />

      {/* Bundle modal */}
      <CreateFromBundleModal
        open={showBundle}
        onClose={() => setShowBundle(false)}
      />
    </div>
  );
}
