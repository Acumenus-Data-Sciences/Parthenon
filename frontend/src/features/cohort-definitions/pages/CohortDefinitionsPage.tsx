import { useState, useEffect } from "react";
import { Wand2, Upload, X, Search, Stethoscope, LayoutGrid, List } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CohortDefinitionList } from "../components/CohortDefinitionList";
import { CohortStatsBar } from "../components/CohortStatsBar";
import { ImportCohortModal } from "../components/ImportCohortModal";
import { CreateFromBundleModal } from "../components/CreateFromBundleModal";
import { CohortWizardModal } from "../components/wizard/CohortWizardModal";
import { useCohortDefinitions } from "../hooks/useCohortDefinitions";
import { getCohortTags } from "../api/cohortApi";
import { HelpButton } from "@/features/help";
import TagFilterBar from "@/components/ui/TagFilterBar";

export default function CohortDefinitionsPage() {
  const queryClient = useQueryClient();
  const [showImport, setShowImport] = useState(false);
  const [showFromBundle, setShowFromBundle] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<"domain" | "flat">("domain");
  const [tierFilter, setTierFilter] = useState<string | null>(null);

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

  // Fetch the same paginated data to extract Solr facets (TanStack Query deduplicates)
  const { data: listData } = useCohortDefinitions({
    page: 1,
    limit: 20,
    tags: activeTags.length > 0 ? activeTags : undefined,
    search: debouncedSearch || undefined,
  });
  const facets = listData?.facets;

  const handleCreate = () => {
    setWizardOpen(true);
  };

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  // Stats bar quick-filter
  const [statFilter, setStatFilter] = useState<"generated" | "public" | null>(null);

  const handleStatClick = (key: string) => {
    if (key === "total") {
      setStatFilter(null);
    } else if (key === "generated" || key === "public") {
      setStatFilter((prev) => (prev === key ? null : key));
    }
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
            className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors"
          >
            <Wand2 size={16} />
            Cohort Wizard
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <CohortStatsBar onStatClick={handleStatClick} activeKey={statFilter ?? undefined} />

      {/* Search bar + View toggle + Tier filter */}
      <div className="flex items-center gap-4">
        {/* Search (left) */}
        <div className="relative w-64 mr-auto">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search cohort definitions..."
            className="w-full rounded-lg pl-10 pr-8 py-2 text-sm bg-[#151518] border border-[#232328] text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/15 transition-colors"
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

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-[#1C1C20] p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("domain")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "domain"
                ? "bg-[#232328] text-[#F0EDE8] shadow-sm"
                : "text-[#8A857D] hover:text-[#C5C0B8]"
            }`}
          >
            <LayoutGrid size={12} />
            By Domain
          </button>
          <button
            type="button"
            onClick={() => setViewMode("flat")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "flat"
                ? "bg-[#232328] text-[#F0EDE8] shadow-sm"
                : "text-[#8A857D] hover:text-[#C5C0B8]"
            }`}
          >
            <List size={12} />
            Flat List
          </button>
        </div>

        {/* Tier filter pills */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#5A5650]">Tier:</span>
          {[
            { value: null, label: "All" },
            { value: "study-ready", label: "Study-Ready" },
            { value: "validated", label: "Validated" },
            { value: "draft", label: "Draft" },
          ].map((opt) => {
            const isActive = tierFilter === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => setTierFilter(opt.value)}
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-[#2DD4BF] bg-[#2DD4BF]/10 text-[#2DD4BF]"
                    : "border-[#2A2A30] bg-[#1A1A1F] text-[#8A857D] hover:border-[#3A3A42]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tag filter chips */}
      {tags && tags.length > 0 && (
        <TagFilterBar
          tags={tags}
          activeTags={activeTags}
          onToggle={toggleTag}
          onClear={() => setActiveTags([])}
          facets={facets?.tags}
          color="teal"
        />
      )}

      {/* Solr facet chips: status */}
      {facets?.status && Object.keys(facets.status).length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#5A5650]">Status:</span>
          {Object.entries(facets.status).map(([value, count]) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs bg-[#1A1A1F] text-[#8A857D] border border-[#2A2A30]"
            >
              {value}
              <span className="text-[10px] opacity-60">({count})</span>
            </span>
          ))}
        </div>
      )}

      {/* Solr facet chips: author */}
      {facets?.author_name && Object.keys(facets.author_name).length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#5A5650]">Author:</span>
          {Object.entries(facets.author_name).map(([value, count]) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs bg-[#1A1A1F] text-[#8A857D] border border-[#2A2A30]"
            >
              {value}
              <span className="text-[10px] opacity-60">({count})</span>
            </span>
          ))}
        </div>
      )}

      {/* List */}
      <CohortDefinitionList
        tags={activeTags.length > 0 ? activeTags : undefined}
        search={debouncedSearch || undefined}
        isPublic={statFilter === "public" || undefined}
        withGenerations={statFilter === "generated" || undefined}
        onCreateFromBundle={() => setShowFromBundle(true)}
        groupBy={viewMode === "domain" ? "domain" : null}
        tierFilter={tierFilter}
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

      {/* Cohort Wizard modal */}
      {wizardOpen && <CohortWizardModal onClose={() => setWizardOpen(false)} />}
    </div>
  );
}
