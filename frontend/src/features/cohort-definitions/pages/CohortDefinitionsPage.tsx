import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, Upload, X, Search, Stethoscope } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CohortDefinitionList } from "../components/CohortDefinitionList";
import { CohortStatsBar } from "../components/CohortStatsBar";
import { ImportCohortModal } from "../components/ImportCohortModal";
import { CreateFromBundleModal } from "../components/CreateFromBundleModal";
import { useCreateCohortDefinition } from "../hooks/useCohortDefinitions";
import { getCohortTags } from "../api/cohortApi";
import { HelpButton } from "@/features/help";

const defaultExpression = {
  ConceptSets: [],
  PrimaryCriteria: {
    CriteriaList: [],
    ObservationWindow: { PriorDays: 0, PostDays: 0 },
  },
  QualifiedLimit: { Type: "First" as const },
  ExpressionLimit: { Type: "First" as const },
  CollapseSettings: { CollapseType: "ERA" as const, EraPad: 0 },
};

export default function CohortDefinitionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createMutation = useCreateCohortDefinition();
  const [isCreating, setIsCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showFromBundle, setShowFromBundle] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: tags } = useQuery({
    queryKey: ["cohort-tags"],
    queryFn: getCohortTags,
    staleTime: 30_000,
  });

  const handleCreate = () => {
    setIsCreating(true);
    createMutation.mutate(
      {
        name: "Untitled Cohort Definition",
        expression_json: defaultExpression,
      },
      {
        onSuccess: (def) => {
          navigate(`/cohort-definitions/${def.id}`);
        },
        onSettled: () => {
          setIsCreating(false);
        },
      },
    );
  };

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">
            Cohort Definitions
          </h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Define and manage cohort definitions for population-level studies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton helpKey="cohort-builder" />
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
            onClick={() => setShowFromBundle(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A30] bg-[#151518] px-4 py-2.5 text-sm font-medium text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#3A3A42] transition-colors"
          >
            <Stethoscope size={16} />
            From Bundle
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
            New Cohort Definition
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <CohortStatsBar />

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
        />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search cohort definitions..."
          className="w-full rounded-lg pl-10 pr-3 py-2.5 text-sm bg-[#151518] border border-[#232328] text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5650] hover:text-[#8A857D]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tag filter chips */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#5A5650]">Filter by tag:</span>
          {tags.map((tag) => {
            const active = activeTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors ${
                  active
                    ? "bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30"
                    : "bg-[#1A1A1F] text-[#8A857D] border border-[#2A2A30] hover:border-[#3A3A42]"
                }`}
              >
                {tag}
                {active && <X size={10} />}
              </button>
            );
          })}
          {activeTags.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTags([])}
              className="text-xs text-[#5A5650] hover:text-[#8A857D] transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* List */}
      <CohortDefinitionList
        tags={activeTags.length > 0 ? activeTags : undefined}
        search={debouncedSearch || undefined}
        onCreateFromBundle={() => setShowFromBundle(true)}
      />

      {/* Import modal */}
      {showImport && (
        <ImportCohortModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            queryClient.invalidateQueries({ queryKey: ["cohort-definitions"] });
            queryClient.invalidateQueries({ queryKey: ["cohort-tags"] });
          }}
        />
      )}

      {/* Create from Bundle modal */}
      <CreateFromBundleModal
        open={showFromBundle}
        onClose={() => setShowFromBundle(false)}
      />
    </div>
  );
}
