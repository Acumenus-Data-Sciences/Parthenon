import { useState } from "react";
import { useCohortDefinitions } from "@/features/cohort-definitions/hooks/useCohortDefinitions";

interface CohortPickerProps {
  selectedIds: number[];
  primaryId: number | null;
  onSelectionChange: (ids: number[]) => void;
  onPrimaryChange: (id: number | null) => void;
}

export function CohortPicker({
  selectedIds,
  primaryId,
  onSelectionChange,
  onPrimaryChange,
}: CohortPickerProps) {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError } = useCohortDefinitions({
    limit: 200,
    with_generations: true,
  });

  const cohorts = data?.items ?? [];

  const filtered = cohorts.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.description ?? "").toLowerCase().includes(q)
    );
  });

  function toggleCohort(id: number) {
    if (selectedIds.includes(id)) {
      const next = selectedIds.filter((x) => x !== id);
      onSelectionChange(next);
      if (primaryId === id) {
        onPrimaryChange(next[0] ?? null);
      }
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  }

  function handleSetPrimary(id: number) {
    if (!selectedIds.includes(id)) return;
    onPrimaryChange(primaryId === id ? null : id);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-20 text-text-ghost text-xs">
        Loading cohorts…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-20 text-[#9B1B30] text-xs">
        Failed to load cohort definitions.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Search */}
      <input
        type="text"
        placeholder="Search cohorts…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-surface-raised/60 border border-border-default rounded px-3 py-1.5 text-xs text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-[#2DD4BF]/60"
      />

      {/* List */}
      <div className="overflow-y-auto max-h-80 flex flex-col gap-1 pr-1">
        {filtered.length === 0 && (
          <p className="text-xs text-text-ghost text-center py-6">
            {search ? "No cohorts match your search." : "No cohort definitions found."}
          </p>
        )}

        {filtered.map((cohort) => {
          const isSelected = selectedIds.includes(cohort.id);
          const isPrimary = primaryId === cohort.id;
          const subjectCount = cohort.latest_generation?.person_count ?? null;

          return (
            <div
              key={cohort.id}
              onClick={() => toggleCohort(cohort.id)}
              className={`relative flex items-start gap-3 rounded px-3 py-2.5 cursor-pointer transition-colors ${
                isSelected
                  ? "border border-[#2DD4BF]/50 bg-teal-900/10"
                  : "border border-border-default/50 bg-surface-raised/40 hover:bg-surface-raised/70"
              }`}
            >
              {/* Checkbox */}
              <div
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  isSelected
                    ? "border-[#2DD4BF] bg-[#2DD4BF]/20"
                    : "border-border-hover bg-surface-raised"
                }`}
              >
                {isSelected && (
                  <svg
                    className="w-2.5 h-2.5 text-[#2DD4BF]"
                    fill="none"
                    viewBox="0 0 10 10"
                  >
                    <path
                      d="M1.5 5.5l2.5 2.5 4.5-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-text-primary truncate">
                    {cohort.name}
                  </span>
                  {isPrimary && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#C9A227]/20 text-[#C9A227] border border-[#C9A227]/30 font-medium">
                      Primary
                    </span>
                  )}
                  {subjectCount != null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-accent/60 text-text-muted border border-border-hover/30">
                      {subjectCount.toLocaleString()} subjects
                    </span>
                  )}
                </div>
                {cohort.description && (
                  <p className="text-[11px] text-text-ghost mt-0.5 line-clamp-2">
                    {cohort.description}
                  </p>
                )}
              </div>

              {/* Set as Primary button — only when selected */}
              {isSelected && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetPrimary(cohort.id);
                  }}
                  className={`shrink-0 text-[10px] px-2 py-1 rounded border transition-colors ${
                    isPrimary
                      ? "border-[#C9A227]/50 text-[#C9A227] bg-[#C9A227]/10"
                      : "border-border-hover text-text-muted hover:border-[#C9A227]/50 hover:text-[#C9A227]"
                  }`}
                >
                  {isPrimary ? "Primary ✓" : "Set as Primary"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
