import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Loader2, User, Hash, CreditCard, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSourceStore } from "@/stores/sourceStore";
import { usePersonSearch } from "@/features/profiles/hooks/useProfiles";
import { useSimilarityDimensions } from "../hooks/usePatientSimilarity";
import type { SimilaritySearchParams } from "../types/patientSimilarity";
import { buildSimilarityFilters } from "../utils/similarityFilters";

interface SimilaritySearchFormProps {
  onSearch: (params: SimilaritySearchParams) => void;
  isLoading: boolean;
  sourceId: number;
  onSourceChange: (sourceId: number) => void;
  initialPersonId?: number;
  initialSourceId?: number;
  initialWeights?: Record<string, number>;
}

export function SimilaritySearchForm({
  onSearch,
  isLoading,
  sourceId,
  onSourceChange,
  initialPersonId,
  initialWeights,
}: SimilaritySearchFormProps) {
  const { sources } = useSourceStore();
  const { data: dimensions } = useSimilarityDimensions();

  const [personId, setPersonId] = useState(initialPersonId?.toString() ?? "");
  const [searchQuery, setSearchQuery] = useState(initialPersonId?.toString() ?? "");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [gender, setGender] = useState("");

  const {
    data: searchResults,
    isLoading: searchLoading,
    isFetching: searchFetching,
  } = usePersonSearch(sourceId > 0 ? sourceId : null, searchQuery);

  // Initialize weights from dimensions when they load
  useEffect(() => {
    if (!dimensions) return;
    const defaults: Record<string, number> = {};
    for (const dim of dimensions) {
      defaults[dim.key] = initialWeights?.[dim.key] ?? dim.default_weight;
    }
    setWeights(defaults);
  }, [dimensions, initialWeights]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function computeAge(yearOfBirth: number): number {
    return new Date().getFullYear() - yearOfBirth;
  }

  const handleSelectPerson = (pid: number) => {
    setPersonId(pid.toString());
    setSearchQuery(pid.toString());
    setIsDropdownOpen(false);
  };

  const hasResults = searchResults && searchResults.length > 0;
  const showDropdown =
    isDropdownOpen &&
    sourceId > 0 &&
    searchQuery.trim().length >= 1 &&
    (searchLoading || searchFetching || hasResults || (searchResults && searchResults.length === 0));

  const handleWeightChange = useCallback((key: string, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pid = parseInt(personId, 10);
    if (isNaN(pid) || sourceId <= 0) return;
    const filters = buildSimilarityFilters(ageMin, ageMax, gender);

    onSearch({
      person_id: pid,
      source_id: sourceId,
      weights: Object.keys(weights).length > 0 ? weights : undefined,
      filters,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Source Selector */}
      <div>
        <label className="block text-[10px] text-text-ghost uppercase tracking-wider mb-1.5">
          Data Source
        </label>
        <select
          value={sourceId}
          onChange={(e) => onSourceChange(parseInt(e.target.value, 10))}
          className={cn(
            "w-full rounded-lg px-3 py-2 text-sm",
            "bg-surface-base border border-border-default",
            "text-text-primary",
            "focus:outline-none focus:border-success focus:ring-1 focus:ring-[#2DD4BF]/40",
          )}
        >
          <option value={0}>Select source...</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.source_name}
            </option>
          ))}
        </select>
      </div>

      {/* Patient ID — live search */}
      <div>
        <label className="block text-[10px] text-text-ghost uppercase tracking-wider mb-1.5">
          Seed Patient ID
        </label>
        <div ref={dropdownRef} className="relative">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
            />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPersonId(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.trim().length >= 1) setIsDropdownOpen(true);
              }}
              placeholder={
                sourceId > 0
                  ? "Type person ID or MRN..."
                  : "Select a data source first"
              }
              disabled={sourceId <= 0}
              className={cn(
                "w-full rounded-lg pl-9 pr-8 py-2 text-sm",
                "bg-surface-base border border-border-default",
                "text-text-primary placeholder:text-text-ghost",
                sourceId <= 0
                  ? "opacity-50 cursor-not-allowed"
                  : "focus:outline-none focus:border-success focus:ring-1 focus:ring-[#2DD4BF]/40",
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {(searchLoading || searchFetching) && searchQuery.trim() ? (
                <Loader2 size={13} className="animate-spin text-text-ghost" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setPersonId("");
                    setIsDropdownOpen(false);
                    inputRef.current?.focus();
                  }}
                  className="text-text-ghost hover:text-text-secondary transition-colors"
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>
          </div>

          {/* Search type hints */}
          {sourceId > 0 && !searchQuery && (
            <div className="flex items-center gap-3 mt-1 px-1">
              <span className="inline-flex items-center gap-1 text-[10px] text-text-ghost">
                <Hash size={9} /> Person ID
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-text-ghost">
                <CreditCard size={9} /> MRN
              </span>
            </div>
          )}

          {/* Results dropdown */}
          {showDropdown && (
            <div
              className={cn(
                "absolute left-0 right-0 top-full mt-1 z-50",
                "rounded-lg border border-surface-highlight bg-surface-base shadow-2xl overflow-hidden",
              )}
            >
              {searchLoading && !searchResults ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-text-muted" />
                </div>
              ) : !hasResults ? (
                <div className="flex flex-col items-center py-4 px-3 text-center">
                  <User size={16} className="text-text-ghost mb-1" />
                  <p className="text-xs text-text-muted">
                    No patients found for &ldquo;{searchQuery}&rdquo;
                  </p>
                </div>
              ) : (
                <div>
                  <div className="px-3 py-1 border-b border-border-subtle">
                    <p className="text-[10px] text-text-ghost">
                      {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                      {searchResults.length === 20 ? " (showing first 20)" : ""}
                    </p>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-border-subtle">
                    {searchResults.map((person) => (
                      <button
                        key={person.person_id}
                        type="button"
                        onClick={() => handleSelectPerson(person.person_id)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-overlay transition-colors text-left"
                      >
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success/10 shrink-0">
                          <User size={11} className="text-success" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-success font-['IBM_Plex_Mono',monospace]">
                              #{person.person_id}
                            </span>
                            <span className="text-[10px] text-text-muted">
                              {person.gender} · {computeAge(person.year_of_birth)} yrs
                            </span>
                          </div>
                          {person.person_source_value && (
                            <p className="text-[10px] text-text-ghost truncate">
                              MRN: {person.person_source_value}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dimension Weight Sliders */}
      {dimensions && dimensions.length > 0 && (
        <div>
          <label className="block text-[10px] text-text-ghost uppercase tracking-wider mb-2">
            Dimension Weights
          </label>
          <div className="space-y-3">
            {dimensions.filter((d) => d.is_active).map((dim) => (
              <div key={dim.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-secondary">{dim.name}</span>
                  <span className="text-[10px] font-medium text-success tabular-nums">
                    {(weights[dim.key] ?? dim.default_weight).toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.5}
                  value={weights[dim.key] ?? dim.default_weight}
                  onChange={(e) =>
                    handleWeightChange(dim.key, parseFloat(e.target.value))
                  }
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-surface-elevated accent-[#2DD4BF]"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <label className="block text-[10px] text-text-ghost uppercase tracking-wider">
          Filters (optional)
        </label>

        {/* Age Range */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={ageMin}
            onChange={(e) => setAgeMin(e.target.value)}
            placeholder="Min age"
            className={cn(
              "w-1/2 rounded-lg px-3 py-1.5 text-xs",
              "bg-surface-base border border-border-default",
              "text-text-primary placeholder:text-text-ghost",
              "focus:outline-none focus:border-success focus:ring-1 focus:ring-[#2DD4BF]/40",
            )}
          />
          <span className="text-text-ghost text-xs">-</span>
          <input
            type="text"
            value={ageMax}
            onChange={(e) => setAgeMax(e.target.value)}
            placeholder="Max age"
            className={cn(
              "w-1/2 rounded-lg px-3 py-1.5 text-xs",
              "bg-surface-base border border-border-default",
              "text-text-primary placeholder:text-text-ghost",
              "focus:outline-none focus:border-success focus:ring-1 focus:ring-[#2DD4BF]/40",
            )}
          />
        </div>

        {/* Gender Filter */}
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className={cn(
            "w-full rounded-lg px-3 py-1.5 text-xs",
            "bg-surface-base border border-border-default",
            "text-text-primary",
            "focus:outline-none focus:border-success focus:ring-1 focus:ring-[#2DD4BF]/40",
          )}
        >
          <option value="">Any gender</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
        </select>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || !personId.trim() || sourceId <= 0}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
          "bg-primary text-text-primary hover:bg-primary-light",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Search size={16} />
        )}
        Find Similar Patients
      </button>
    </form>
  );
}
