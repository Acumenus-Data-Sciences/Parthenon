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
import { useTranslation } from "react-i18next";

export default function CohortDefinitionsPage() {
  const { t } = useTranslation("app");
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
          <h1 className="text-2xl font-bold text-text-primary">
            {t("cohortDefinitions.auto.cohortDefinitions_e84b92")}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {t("cohortDefinitions.auto.defineAndManageCohortDefinitionsForPopulationLevel_540f3a")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton helpKey="cohort-builder" />
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-secondary hover:border-surface-highlight transition-colors"
          >
            <Upload size={16} />
            {t("cohortDefinitions.auto.import_72d6d7")}
          </button>
          <button
            type="button"
            onClick={() => setShowFromBundle(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-secondary hover:border-surface-highlight transition-colors"
          >
            <Stethoscope size={16} />
            {t("cohortDefinitions.auto.fromBundle_0cfddc")}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-medium text-surface-base hover:bg-success transition-colors"
          >
            <Wand2 size={16} />
            {t("cohortDefinitions.auto.cohortWizard_e16df5")}
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
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("cohortDefinitions.auto.searchCohortDefinitions_c8a8da")}
            className="w-full rounded-lg pl-10 pr-8 py-2 text-sm bg-surface-raised border border-border-default text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/15 transition-colors"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-ghost hover:text-text-muted"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-surface-overlay p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("domain")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "domain"
                ? "bg-surface-elevated text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <LayoutGrid size={12} />
            {t("cohortDefinitions.auto.byDomain_07a813")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("flat")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "flat"
                ? "bg-surface-elevated text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <List size={12} />
            {t("cohortDefinitions.auto.flatList_53e45a")}
          </button>
        </div>

        {/* Tier filter pills */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-ghost">{t("cohortDefinitions.auto.tier_78ae42")}</span>
          {[
            { value: null, label: t("cohortDefinitions.auto.all_b1c94c") },
            { value: "study-ready", label: t("cohortDefinitions.auto.studyReady_834a5b") },
            { value: "validated", label: t("cohortDefinitions.auto.validated_536425") },
            { value: "draft", label: t("cohortDefinitions.auto.draft_f03ab1") },
          ].map((opt) => {
            const isActive = tierFilter === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => setTierFilter(opt.value)}
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-success bg-success/10 text-success"
                    : "border-border-default bg-surface-overlay text-text-muted hover:border-surface-highlight"
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
          <span className="text-xs text-text-ghost">{t("cohortDefinitions.auto.status_24a23d")}</span>
          {Object.entries(facets.status).map(([value, count]) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs bg-surface-overlay text-text-muted border border-border-default"
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
          <span className="text-xs text-text-ghost">{t("cohortDefinitions.auto.author_91401f")}</span>
          {Object.entries(facets.author_name).map(([value, count]) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs bg-surface-overlay text-text-muted border border-border-default"
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
