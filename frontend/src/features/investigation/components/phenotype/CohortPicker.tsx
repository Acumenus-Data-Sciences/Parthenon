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
      <div className="flex items-center justify-center h-20 text-zinc-500 text-xs">
        Loading cohorts…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-20 text-primary text-xs">
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
        className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-success/60"
      />

      {/* List */}
      <div className="overflow-y-auto max-h-80 flex flex-col gap-1 pr-1">
        {filtered.length === 0 && (
          <p className="text-xs text-zinc-500 text-center py-6">
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
                  ? "border border-success/50 bg-teal-900/10"
                  : "border border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-800/70"
              }`}
            >
              {/* Checkbox */}
              <div
                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  isSelected
                    ? "border-success bg-success/20"
                    : "border-zinc-600 bg-zinc-800"
                }`}
              >
                {isSelected && (
                  <svg
                    className="w-2.5 h-2.5 text-success"
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
                  <span className="text-xs font-medium text-zinc-200 truncate">
                    {cohort.name}
                  </span>
                  {isPrimary && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/30 font-medium">
                      Primary
                    </span>
                  )}
                  {subjectCount != null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/60 text-zinc-400 border border-zinc-600/30">
                      {subjectCount.toLocaleString()} subjects
                    </span>
                  )}
                </div>
                {cohort.description && (
                  <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">
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
                      ? "border-accent/50 text-accent bg-accent/10"
                      : "border-zinc-600 text-zinc-400 hover:border-accent/50 hover:text-accent"
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
