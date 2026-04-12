import { useState, useEffect, useRef } from "react";
import { searchPhenotypes } from "@/features/study-agent/api";
import type { PhenotypeSearchResult } from "@/features/study-agent/api";

interface SelectedPhenotype {
  id: string;
  name: string;
  description: string;
  expression: Record<string, unknown>;
}

interface PhenotypeLibrarySearchProps {
  onSelectPhenotype: (phenotype: SelectedPhenotype) => void;
}

export function PhenotypeLibrarySearch({ onSelectPhenotype }: PhenotypeLibrarySearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PhenotypeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchPhenotypes(query, 10);
        setResults(data);
      } catch {
        setError("Failed to search phenotype library. Please try again.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleSelect(result: PhenotypeSearchResult) {
    const id = String(result.cohortId);
    setSelectedId(id);
    onSelectPhenotype({
      id,
      name: result.name,
      description: result.description,
      expression: { cohortId: result.cohortId, name: result.name },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
        Phenotype Library
      </p>

      {/* Search input */}
      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the OHDSI Phenotype Library (1,100+ validated phenotypes)"
          className="w-full bg-surface-raised/60 border border-border-default rounded pl-8 pr-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-[#2DD4BF]/60"
        />
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#2DD4BF]/40 border-t-[#2DD4BF] rounded-full animate-spin" />
        )}
      </div>

      {/* Error state */}
      {error && (
        <p className="text-[11px] text-[#9B1B30]">{error}</p>
      )}

      {/* Empty state */}
      {!loading && !error && query.trim() && results.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-zinc-500">
          <svg
            className="w-8 h-8 text-zinc-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-xs">No phenotypes found for "{query}"</p>
        </div>
      )}

      {/* Default empty state (no query yet) */}
      {!loading && !error && !query.trim() && (
        <div className="flex flex-col items-center gap-2 py-8 text-zinc-500">
          <svg
            className="w-8 h-8 text-zinc-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <p className="text-xs text-center">
            Search the OHDSI Phenotype Library
            <br />
            <span className="text-zinc-600">1,100+ validated phenotypes</span>
          </p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
          {results.map((result) => {
            const id = String(result.cohortId);
            const isSelected = selectedId === id;
            return (
              <div
                key={id}
                className={`rounded border px-3 py-2.5 flex items-start justify-between gap-3 transition-colors ${
                  isSelected
                    ? "border-[#2DD4BF]/50 bg-teal-900/10"
                    : "border-border-default/50 bg-surface-raised/40 hover:bg-surface-raised/70"
                }`}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-xs font-semibold text-zinc-200 leading-snug">{result.name}</p>
                  <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                    {result.description || "No description available."}
                  </p>
                  {result.tags && result.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {result.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-surface-accent/50 text-zinc-400 border border-border-default"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleSelect(result)}
                  className={`shrink-0 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                    isSelected
                      ? "bg-[#2DD4BF]/20 text-[#2DD4BF] border-[#2DD4BF]/40"
                      : "bg-surface-accent/50 text-zinc-300 border-border-hover hover:bg-surface-accent hover:text-zinc-100"
                  }`}
                >
                  {isSelected ? "Selected" : "Select"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
