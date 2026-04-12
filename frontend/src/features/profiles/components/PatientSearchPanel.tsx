import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Loader2,
  X,
  Database,
  ChevronDown,
  User,
  Hash,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { usePersonSearch } from "../hooks/useProfiles";

interface PatientSearchPanelProps {
  onSelectPerson: (sourceId: number, personId: number) => void;
  /** Pre-selected source (from parent, overrides internal source picker when set) */
  sourceId?: number | null;
}

function computeAge(yearOfBirth: number): number {
  return new Date().getFullYear() - yearOfBirth;
}

export function PatientSearchPanel({
  onSelectPerson,
  sourceId: externalSourceId,
}: PatientSearchPanelProps) {
  const [internalSourceId, setInternalSourceId] = useState<number | null>(null);
  const sourceId = externalSourceId !== undefined ? externalSourceId : internalSourceId;

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const {
    data: results,
    isLoading,
    isFetching,
  } = usePersonSearch(sourceId, query);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (personId: number) => {
    if (sourceId) {
      onSelectPerson(sourceId, personId);
      setQuery("");
      setIsOpen(false);
    }
  };

  const hasResults = results && results.length > 0;
  const showDropdown =
    isOpen &&
    sourceId &&
    query.trim().length >= 1 &&
    (isLoading || isFetching || hasResults || (results && results.length === 0));

  return (
    <div className="space-y-3">
      {/* Source selector — only shown when not controlled externally */}
      {externalSourceId === undefined && (
        <div>
          <label className="block text-xs font-medium text-[#8A857D] mb-1">
            Data Source
          </label>
          <div className="relative">
            <Database
              size={12}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
            />
            <select
              value={internalSourceId ?? ""}
              onChange={(e) => setInternalSourceId(Number(e.target.value) || null)}
              disabled={loadingSources}
              className={cn(
                "w-full appearance-none rounded-lg border border-[#232328] bg-[#0E0E11] pl-8 pr-8 py-2 text-sm",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
              )}
            >
              <option value="">Select a data source...</option>
              {sources?.map((src) => (
                <option key={src.id} value={src.id}>
                  {src.source_name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
            />
          </div>
        </div>
      )}

      {/* Search input + dropdown */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={
              sourceId
                ? "Search by person ID or MRN..."
                : "Select a data source first"
            }
            disabled={!sourceId}
            className={cn(
              "w-full rounded-lg border pl-9 pr-8 py-2.5 text-sm transition-colors",
              "bg-[#0E0E11] text-[#F0EDE8] placeholder:text-[#5A5650]",
              !sourceId
                ? "border-[#232328] opacity-50 cursor-not-allowed"
                : "border-[#232328] focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30",
            )}
          />
          {/* Loading / clear */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {(isLoading || isFetching) && query.trim() ? (
              <Loader2 size={13} className="animate-spin text-[#5A5650]" />
            ) : query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setIsOpen(false);
                  inputRef.current?.focus();
                }}
                className="text-[#5A5650] hover:text-[#C5C0B8] transition-colors"
              >
                <X size={13} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Search type hints */}
        {sourceId && !query && (
          <div className="flex items-center gap-3 mt-1.5 px-1">
            <span className="inline-flex items-center gap-1 text-[10px] text-[#5A5650]">
              <Hash size={9} /> Person ID
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-[#5A5650]">
              <CreditCard size={9} /> MRN / Source Value
            </span>
            <span className="text-[10px] text-[#3A3A40]">
              (names not in OMOP CDM)
            </span>
          </div>
        )}

        {/* Results dropdown */}
        {showDropdown && (
          <div
            className={cn(
              "absolute left-0 right-0 top-full mt-1 z-50",
              "rounded-lg border border-[#323238] bg-[#0E0E11] shadow-2xl overflow-hidden",
            )}
          >
            {isLoading && !results ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={18} className="animate-spin text-[#8A857D]" />
              </div>
            ) : !hasResults ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <User size={20} className="text-[#323238] mb-2" />
                <p className="text-sm text-[#8A857D]">
                  No patients found for &ldquo;{query}&rdquo;
                </p>
                <p className="mt-1 text-xs text-[#5A5650]">
                  Try a different person ID or MRN
                </p>
              </div>
            ) : (
              <div>
                <div className="px-3 py-1.5 border-b border-[#1C1C20]">
                  <p className="text-[10px] text-[#5A5650]">
                    {results.length} result{results.length !== 1 ? "s" : ""}
                    {results.length === 20 ? " (showing first 20)" : ""}
                  </p>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-[#1C1C20]">
                  {results.map((person) => (
                    <button
                      key={person.person_id}
                      type="button"
                      onClick={() => handleSelect(person.person_id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#1C1C20] transition-colors text-left"
                    >
                      {/* Avatar */}
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#2DD4BF]/10 shrink-0">
                        <User size={13} className="text-[#2DD4BF]" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#2DD4BF] font-['IBM_Plex_Mono',monospace]">
                            #{person.person_id}
                          </span>
                          <span className="text-xs text-[#8A857D]">
                            {person.gender} · {computeAge(person.year_of_birth)} yrs ({person.year_of_birth})
                          </span>
                        </div>
                        {person.person_source_value && (
                          <p className="text-xs text-[#5A5650] truncate mt-0.5">
                            <span className="text-[#3A3A40]">MRN:</span>{" "}
                            {person.person_source_value}
                          </p>
                        )}
                      </div>

                      {/* Race tag */}
                      {person.race && person.race !== "Unknown" && (
                        <span className="text-[10px] text-[#5A5650] shrink-0">
                          {person.race}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
