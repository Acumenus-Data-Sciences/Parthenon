import { useState, useMemo } from "react";
import { Search, Plus, Loader2, ChevronDown, SortAsc } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { BundleCard } from "./BundleCard";
import { useBundles } from "../hooks/useCareGaps";
import {
  CARE_GAP_DISEASE_CATEGORIES,
  getCareGapCategoryLabel,
} from "../lib/i18n";
import type { ConditionBundle } from "../types/careGap";

type SortField = "name" | "compliance";

interface BundleListProps {
  onCreateClick?: () => void;
}

export function BundleList({ onCreateClick }: BundleListProps) {
  const { t } = useTranslation("app");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("name");
  const categories = ["", ...CARE_GAP_DISEASE_CATEGORIES];

  const { data, isLoading } = useBundles({
    search: search || undefined,
    disease_category: category || undefined,
  });

  const sorted = useMemo(() => {
    const bundles = data?.data ?? [];
    const copy = [...bundles];
    copy.sort((a: ConditionBundle, b: ConditionBundle) => {
      if (sortBy === "compliance") {
        const aPct =
          a.latest_evaluation?.compliance_summary?.compliance_pct ?? -1;
        const bPct =
          b.latest_evaluation?.compliance_summary?.compliance_pct ?? -1;
        return bPct - aPct; // desc
      }
      return a.condition_name.localeCompare(b.condition_name);
    });
    return copy;
  }, [data?.data, sortBy]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder={t("careGaps.bundleList.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full rounded-lg border border-border-default bg-surface-raised pl-9 pr-3 py-2 text-sm",
              "text-text-primary placeholder:text-text-ghost",
              "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
            )}
          />
        </div>

        {/* Category filter */}
        <div className="relative">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={cn(
              "appearance-none rounded-lg border border-border-default bg-surface-raised pl-3 pr-8 py-2 text-sm",
              "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
              "cursor-pointer",
            )}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat
                  ? getCareGapCategoryLabel(t, cat)
                  : t("careGaps.bundleList.allCategories")}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"
          />
        </div>

        {/* Sort toggle */}
        <button
          type="button"
          onClick={() =>
            setSortBy((prev) => (prev === "name" ? "compliance" : "name"))
          }
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm",
            "text-text-muted hover:text-text-primary hover:border-surface-highlight transition-colors",
          )}
          >
          <SortAsc size={14} />
          {sortBy === "name"
            ? t("careGaps.bundleList.sortName")
            : t("careGaps.bundleList.sortCompliance")}
        </button>

        {/* Create button */}
        {onCreateClick && (
          <button
            type="button"
            onClick={onCreateClick}
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors"
          >
            <Plus size={16} />
            {t("careGaps.common.actions.newBundle")}
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
          <p className="text-sm text-text-muted">
            {t("careGaps.bundleList.noBundlesFound")}
          </p>
          <p className="mt-1 text-xs text-text-ghost">
            {search || category
              ? t("careGaps.bundleList.adjustFilters")
              : t("careGaps.bundleList.createToGetStarted")}
          </p>
        </div>
      )}

      {/* Grid */}
      {!isLoading && sorted.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((bundle) => (
            <BundleCard key={bundle.id} bundle={bundle} />
          ))}
        </div>
      )}
    </div>
  );
}
