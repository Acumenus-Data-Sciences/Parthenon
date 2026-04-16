// frontend/src/features/finngen-workbench/components/CohortPicker.tsx
//
// Polish 1 — typeahead picker against app.cohort_definitions. Replaces the
// raw number input + window.prompt that were used during Phase B/D scaffolding.
import { useEffect, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { useCohortById, useCohortSearch } from "../hooks/useCohortSearch";

interface CohortPickerProps {
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  /** Compact mode shrinks the input — used inline in the OperationBuilder. */
  compact?: boolean;
  /** Optional id list to exclude from results (e.g. cohorts already in the form). */
  excludeIds?: number[];
}

const DEBOUNCE_MS = 200;

export function CohortPicker({
  value,
  onChange,
  placeholder = "search cohorts…",
  compact = false,
  excludeIds = [],
}: CohortPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  // Debounce the query to keep the API quiet.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  // Close dropdown on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const search = useCohortSearch(debouncedQuery);
  const selected = useCohortById(value);

  const exclude = new Set(excludeIds);
  const results = (search.data ?? []).filter((r) => !exclude.has(r.id));

  function pick(id: number) {
    onChange(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className={["relative", compact ? "inline-block" : "block"].join(" ")} ref={wrapRef}>
      {value !== null ? (
        <div className="flex items-center gap-1.5 rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs">
          <span className="font-mono text-text-ghost">#{value}</span>
          <span className="text-text-primary truncate max-w-[180px]">
            {selected.data?.name ?? "…"}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-1 text-text-ghost hover:text-error transition-colors"
            aria-label="Clear cohort"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 rounded border border-border-default bg-surface-overlay px-2">
          <Search size={12} className="text-text-ghost" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className={[
              "bg-transparent py-1 text-xs outline-none placeholder:text-text-ghost",
              compact ? "w-40" : "w-full",
            ].join(" ")}
          />
          {search.isPending && debouncedQuery.length > 0 && (
            <Loader2 size={10} className="animate-spin text-text-ghost" />
          )}
        </div>
      )}

      {open && value === null && (
        <div className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto rounded border border-border-default bg-surface-raised shadow-lg">
          {debouncedQuery.length === 0 && (
            <p className="px-3 py-2 text-[10px] text-text-ghost">Start typing to search…</p>
          )}
          {debouncedQuery.length > 0 && results.length === 0 && !search.isPending && (
            <p className="px-3 py-2 text-[10px] text-text-ghost">No matches.</p>
          )}
          {results.map((cohort) => (
            <button
              key={cohort.id}
              type="button"
              onClick={() => pick(cohort.id)}
              className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-overlay transition-colors"
            >
              <span className="font-mono text-[10px] text-text-ghost">#{cohort.id}</span>
              <span className="flex-1 truncate text-text-primary">{cohort.name}</span>
              {cohort.latest_generation?.person_count !== undefined &&
                cohort.latest_generation?.person_count !== null && (
                  <span className="text-[10px] text-text-ghost">
                    {cohort.latest_generation.person_count.toLocaleString()} subj
                  </span>
                )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
