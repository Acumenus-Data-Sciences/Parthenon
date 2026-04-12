import { useState, useRef, useCallback, useEffect } from "react";
import apiClient from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConceptResult {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  standard_concept: string | null;
}

interface ConceptSearchInlineProps {
  onSelect: (conceptId: number, conceptName: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConceptSearchInline({ onSelect }: ConceptSearchInlineProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ConceptResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await apiClient.get<ConceptResult[]>(
        "/vocabulary/semantic/autocomplete",
        { params: { q } },
      );
      setResults(Array.isArray(data) ? data : []);
      setIsOpen(true);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => search(val), 300);
    },
    [search],
  );

  const handleSelect = useCallback(
    (concept: ConceptResult) => {
      onSelect(concept.concept_id, concept.concept_name);
      setQuery("");
      setResults([]);
      setIsOpen(false);
    },
    [onSelect],
  );

  return (
    <div ref={containerRef} className="relative mt-2">
      <label className="text-[10px] uppercase text-gray-500 tracking-wide block mb-1">
        Concept Search
      </label>
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => {
          if (results.length > 0) setIsOpen(true);
        }}
        placeholder="Search OMOP concepts..."
        className="w-full bg-[#1C1C20] border border-[#2E2E35] rounded px-3 py-1.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#2DD4BF]"
      />
      {isLoading && (
        <div className="absolute right-3 top-[28px]">
          <svg
            className="animate-spin h-4 w-4 text-[#2DD4BF]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}
      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-[#1C1C20] border border-[#2E2E35] rounded-lg shadow-lg">
          {results.map((concept) => (
            <li key={concept.concept_id}>
              <button
                type="button"
                onClick={() => handleSelect(concept)}
                className="w-full text-left px-3 py-2 hover:bg-[#232328] transition-colors flex items-center gap-2"
              >
                <span className="text-xs text-gray-500 font-mono min-w-[60px]">
                  {concept.concept_id}
                </span>
                <span className="text-sm text-white flex-1 truncate">
                  {concept.concept_name}
                </span>
                <span className="text-[10px] text-gray-500">{concept.domain_id}</span>
                <span className="text-[10px] text-gray-600">{concept.vocabulary_id}</span>
                {concept.standard_concept === "S" && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#2DD4BF]/20 text-[#2DD4BF] font-medium">
                    S
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
