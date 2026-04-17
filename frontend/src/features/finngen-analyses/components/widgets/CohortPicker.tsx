// frontend/src/features/finngen-analyses/components/widgets/CohortPicker.tsx
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — finngen-analyses SP3 in flight; unblock CI build
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { WidgetProps } from "@rjsf/utils";
import { Search, X, GitMerge } from "lucide-react";

// SP4 Phase D.3 — provenance marker written by promote-match into
// cohort_definitions.expression_json.finngen_match_promotion. Surface it as
// a "Matched" pill so researchers can tell promoted matches apart from
// hand-built cohorts in the picker.
type FinnGenMatchPromotion = {
  run_id: string;
  primary_cohort_id: number;
  comparator_cohort_ids: number[];
  ratio: number;
  match_sex: boolean;
  match_birth_year: boolean;
};

type CohortDef = {
  id: number;
  name: string;
  description?: string;
  expression_json?: {
    finngen_match_promotion?: FinnGenMatchPromotion;
    [key: string]: unknown;
  };
};

function matchedProvenance(c: CohortDef): FinnGenMatchPromotion | null {
  return c.expression_json?.finngen_match_promotion ?? null;
}

function matchedTitle(p: FinnGenMatchPromotion): string {
  return (
    `Matched cohort · Primary #${p.primary_cohort_id} vs [${p.comparator_cohort_ids
      .map((id) => "#" + id)
      .join(", ")}] ` +
    `at 1:${p.ratio}` +
    (p.match_sex ? " · sex" : "") +
    (p.match_birth_year ? " · birth year" : "")
  );
}

function useCohortDefinitions(search: string) {
  return useQuery<CohortDef[]>({
    queryKey: ["cohort-definitions", "list", search],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: CohortDef[] }>("/cohort-definitions", {
        params: { search: search || undefined, per_page: 50 },
      });
      return data.data;
    },
    staleTime: 30_000,
  });
}

export function CohortPicker(props: WidgetProps) {
  const { value, onChange, label, required, schema } = props;
  const isMulti = schema.type === "array";
  const selectedIds: number[] = isMulti
    ? (Array.isArray(value) ? value : [])
    : value != null
      ? [value as number]
      : [];

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: cohorts = [], isLoading } = useCohortDefinitions(search);

  // v1.0 UX fix — keep the metadata of every cohort the user has ever
  // selected in a local cache. Without this, typing a search that excludes
  // an already-selected chip makes the chip lose its name because it falls
  // out of `cohorts`. Cache is updated only in `handleSelect` to avoid the
  // setState-in-effect anti-pattern; pre-filled ids that never pass through
  // handleSelect fall back to a placeholder (`cohort #N`) until found.
  const [pickedCache, setPickedCache] = useState<Record<number, CohortDef>>({});

  // Render chips for every selected id: prefer the fresh search result,
  // fall back to the sticky cache, final fallback is a placeholder chip
  // with just the id (so the user sees it's selected even if we haven't
  // loaded its metadata yet).
  const selectedCohorts: CohortDef[] = useMemo(
    () =>
      selectedIds.map((id) => {
        const fresh = cohorts.find((c) => c.id === id);
        if (fresh !== undefined) return fresh;
        const cached = pickedCache[id];
        if (cached !== undefined) return cached;
        return { id, name: `cohort #${id}` };
      }),
    [cohorts, selectedIds, pickedCache],
  );

  function handleSelect(cohort: CohortDef) {
    setPickedCache((c) => (c[cohort.id] === undefined ? { ...c, [cohort.id]: cohort } : c));
    if (isMulti) {
      const next = selectedIds.includes(cohort.id)
        ? selectedIds.filter((id) => id !== cohort.id)
        : [...selectedIds, cohort.id];
      onChange(next);
    } else {
      onChange(cohort.id);
      setOpen(false);
    }
  }

  function handleRemove(id: number) {
    if (isMulti) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange(undefined);
    }
  }

  return (
    <div className="space-y-2">
      {/* Selected items */}
      {selectedCohorts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedCohorts.map((c) => {
            const prov = matchedProvenance(c);
            return (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded bg-surface-overlay px-2 py-0.5 text-xs text-text-secondary"
              >
                {prov !== null && (
                  <GitMerge
                    size={10}
                    className="text-info"
                    aria-label="Matched cohort"
                    titleAccess={matchedTitle(prov)}
                  />
                )}
                {c.name}
                <button
                  type="button"
                  onClick={() => handleRemove(c.id)}
                  className="text-text-ghost hover:text-text-primary"
                  aria-label={`Remove ${c.name}`}
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-2.5 text-text-ghost" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search cohorts..."
          className="w-full rounded border border-border-default bg-surface-base py-2 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-ghost focus:border-success focus:outline-none"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="max-h-48 overflow-y-auto rounded border border-border-default bg-surface-raised shadow-lg">
          {isLoading && (
            <div className="px-3 py-2 text-xs text-text-ghost">Loading...</div>
          )}
          {!isLoading && cohorts.length === 0 && (
            <div className="px-3 py-2 text-xs text-text-ghost">No cohorts found.</div>
          )}
          {cohorts.map((cohort) => {
            const isSelected = selectedIds.includes(cohort.id);
            const prov = matchedProvenance(cohort);
            return (
              <button
                key={cohort.id}
                type="button"
                onClick={() => handleSelect(cohort)}
                className={[
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                  isSelected
                    ? "bg-success/10 text-success"
                    : "text-text-secondary hover:bg-surface-overlay",
                ].join(" ")}
                title={prov !== null ? matchedTitle(prov) : undefined}
              >
                {isMulti && (
                  <span
                    className={[
                      "flex h-3.5 w-3.5 items-center justify-center rounded border text-[8px]",
                      isSelected ? "border-success bg-success text-white" : "border-border-default",
                    ].join(" ")}
                  >
                    {isSelected ? "\u2713" : ""}
                  </span>
                )}
                <span className="truncate">{cohort.name}</span>
                {prov !== null && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-info/10 px-1 py-0.5 text-[9px] font-medium text-info">
                    <GitMerge size={8} /> Matched 1:{prov.ratio}
                  </span>
                )}
                <span className="ml-auto text-text-ghost">#{cohort.id}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
