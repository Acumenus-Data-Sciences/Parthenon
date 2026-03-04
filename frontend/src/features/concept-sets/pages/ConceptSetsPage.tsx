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
          <h1 className="text-2xl font-bold text-[#F0EDE8]">Concept Sets</h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Define and manage reusable concept sets for cohort definitions and
            analyses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton helpKey="concept-set-builder" />
          <button
            type="button"
            onClick={() => setShowBundle(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A30] bg-[#151518] px-4 py-2.5 text-sm font-medium text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#3A3A42] transition-colors"
          >
            <Stethoscope size={16} />
            From Bundle
          </button>
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A30] bg-[#151518] px-4 py-2.5 text-sm font-medium text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#3A3A42] transition-colors"
          >
            <Upload size={16} />
            Import
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors disabled:opacity-50"
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
      <ConceptSetStatsBar />

      {/* Search + Tag Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search concept sets..."
            className={cn(
              "w-full rounded-lg pl-9 pr-8 py-2 text-sm",
              "bg-[#0E0E11] border border-[#232328]",
              "text-[#F0EDE8] placeholder:text-[#5A5650]",
              "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
              "transition-colors",
            )}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5650] hover:text-[#C5C0B8] transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tag chips */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-[#C9A227]/20 text-[#C9A227] ring-1 ring-[#C9A227]/40"
                      : "bg-[#1C1C20] text-[#8A857D] hover:text-[#C5C0B8] hover:bg-[#232328]",
                  )}
                >
                  {tag}
                </button>
              );
            })}
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-[#5A5650] hover:text-[#8A857D] transition-colors"
              >
                <X size={10} />
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* List */}
      <ConceptSetList
        search={search}
        tags={selectedTags}
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
