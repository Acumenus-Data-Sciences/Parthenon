import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useConditions, useConditionCategories } from "../hooks/useGis";
import type { ConditionItem } from "../types";
import { getDiseaseSearchTitle } from "../lib/i18n";

interface DiseaseSelectorProps {
  selectedConceptId: number | null;
  onSelect: (conceptId: number, name: string) => void;
}

export function DiseaseSelector({ selectedConceptId, onSelect }: DiseaseSelectorProps) {
  const { t } = useTranslation("app");
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [mode, setMode] = useState<"picks" | "categories" | "search">("picks");

  const { data: topConditions } = useConditions({ limit: 10 });
  const { data: categories } = useConditionCategories();
  const { data: searchResults } = useConditions(
    search.length >= 2 ? { search, limit: 20 } : undefined
  );
  const { data: categoryConditions } = useConditions(
    expandedCategory ? { category: expandedCategory, limit: 30 } : undefined
  );

  const selectedName = useMemo(() => {
    if (!selectedConceptId) return null;
    const all = [...(topConditions ?? []), ...(searchResults ?? []), ...(categoryConditions ?? [])];
    return all.find((c) => c.concept_id === selectedConceptId)?.name ?? null;
  }, [selectedConceptId, topConditions, searchResults, categoryConditions]);

  return (
    <div className="space-y-2 rounded-lg border border-border-default bg-surface-raised p-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-ghost">
        {t("gis.diseaseSelector.title")}
      </span>

      {selectedName && (
        <p className="text-sm font-medium text-accent">{selectedName}</p>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-text-ghost" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value.length >= 2) setMode("search");
          }}
          placeholder={t("gis.diseaseSelector.searchPlaceholder")}
          className="w-full rounded border border-border-default bg-surface-base py-1.5 pl-7 pr-2 text-xs text-text-primary placeholder:text-text-ghost focus:border-accent/50 focus:outline-none"
        />
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1">
        <button
          onClick={() => { setMode("picks"); setSearch(""); }}
          className={`rounded px-2 py-0.5 text-[10px] ${
            mode === "picks" ? "bg-accent/20 text-accent" : "text-text-ghost hover:text-text-muted"
          }`}
        >
          {t("gis.diseaseSelector.top")}
        </button>
        <button
          onClick={() => { setMode("categories"); setSearch(""); }}
          className={`rounded px-2 py-0.5 text-[10px] ${
            mode === "categories" ? "bg-accent/20 text-accent" : "text-text-ghost hover:text-text-muted"
          }`}
        >
          {t("gis.diseaseSelector.categories")}
        </button>
      </div>

      {/* Quick picks */}
      {mode === "picks" && topConditions && (
        <div className="flex flex-wrap gap-1">
          {topConditions.map((c) => (
            <ConditionPill
              key={c.concept_id}
              condition={c}
              selected={c.concept_id === selectedConceptId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {/* Category browser */}
      {mode === "categories" && categories && (
        <div className="max-h-48 space-y-0.5 overflow-y-auto">
          {categories.map((cat) => (
            <div key={cat.category}>
              <button
                onClick={() =>
                  setExpandedCategory(expandedCategory === cat.category ? null : cat.category)
                }
                className="flex w-full items-center justify-between rounded px-2 py-1 text-xs hover:bg-surface-elevated"
              >
                <span className="text-text-muted">{cat.category}</span>
                <span className="flex items-center gap-1 text-text-ghost">
                  {cat.condition_count}
                  {expandedCategory === cat.category ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </span>
              </button>
              {expandedCategory === cat.category && categoryConditions && (
                <div className="ml-2 space-y-0.5 border-l border-border-default pl-2">
                  {categoryConditions.map((c) => (
                    <button
                      key={c.concept_id}
                      onClick={() => onSelect(c.concept_id, c.name)}
                      className={`flex w-full items-center justify-between rounded px-2 py-0.5 text-xs ${
                        c.concept_id === selectedConceptId
                          ? "bg-accent/20 text-accent"
                          : "text-text-muted hover:bg-surface-elevated"
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="ml-1 text-text-ghost">{c.patient_count.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Search results */}
      {mode === "search" && searchResults && (
        <div className="max-h-48 space-y-0.5 overflow-y-auto">
          {searchResults.length === 0 ? (
            <p className="px-2 py-1 text-xs text-text-ghost">
              {t("gis.diseaseSelector.noMatches")}
            </p>
          ) : (
            searchResults.map((c) => (
              <button
                key={c.concept_id}
                onClick={() => onSelect(c.concept_id, c.name)}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-xs ${
                  c.concept_id === selectedConceptId
                    ? "bg-accent/20 text-accent"
                    : "text-text-muted hover:bg-surface-elevated"
                }`}
              >
                <span className="truncate">{c.name}</span>
                <span className="ml-1 text-text-ghost">{c.patient_count.toLocaleString()}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ConditionPill({
  condition,
  selected,
  onSelect,
}: {
  condition: ConditionItem;
  selected: boolean;
  onSelect: (id: number, name: string) => void;
}) {
  const { t } = useTranslation("app");
  return (
    <button
      onClick={() => onSelect(condition.concept_id, condition.name)}
      title={getDiseaseSearchTitle(t, condition.patient_count)}
      className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
        selected
          ? "bg-accent/20 font-medium text-accent"
          : "bg-surface-elevated text-text-ghost hover:text-text-muted"
      }`}
    >
      {condition.name}
    </button>
  );
}
