import { useState, useEffect, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSourceStore } from "@/stores/sourceStore";
import { useSimilarityDimensions } from "../hooks/usePatientSimilarity";
import type { SimilaritySearchParams } from "../types/patientSimilarity";

interface SimilaritySearchFormProps {
  onSearch: (params: SimilaritySearchParams) => void;
  isLoading: boolean;
  initialPersonId?: number;
  initialSourceId?: number;
  initialWeights?: Record<string, number>;
}

export function SimilaritySearchForm({
  onSearch,
  isLoading,
  initialPersonId,
  initialSourceId,
  initialWeights,
}: SimilaritySearchFormProps) {
  const { activeSourceId, defaultSourceId, sources } = useSourceStore();
  const { data: dimensions } = useSimilarityDimensions();

  const [personId, setPersonId] = useState(initialPersonId?.toString() ?? "");
  const [sourceId, setSourceId] = useState<number>(
    initialSourceId ?? activeSourceId ?? defaultSourceId ?? 0,
  );
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [gender, setGender] = useState("");

  // Initialize weights from dimensions when they load
  useEffect(() => {
    if (!dimensions) return;
    const defaults: Record<string, number> = {};
    for (const dim of dimensions) {
      defaults[dim.key] = initialWeights?.[dim.key] ?? dim.default_weight;
    }
    setWeights(defaults);
  }, [dimensions, initialWeights]);

  // Sync source when activeSourceId changes
  useEffect(() => {
    if (activeSourceId && !initialSourceId) {
      setSourceId(activeSourceId);
    }
  }, [activeSourceId, initialSourceId]);

  const handleWeightChange = useCallback((key: string, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pid = parseInt(personId, 10);
    if (isNaN(pid) || sourceId <= 0) return;

    const filters: Record<string, unknown> = {};
    const minAge = parseInt(ageMin, 10);
    const maxAge = parseInt(ageMax, 10);
    if (!isNaN(minAge)) filters.age_min = minAge;
    if (!isNaN(maxAge)) filters.age_max = maxAge;
    if (gender) filters.gender = gender;

    onSearch({
      person_id: pid,
      source_id: sourceId,
      weights: Object.keys(weights).length > 0 ? weights : undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Source Selector */}
      <div>
        <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
          Data Source
        </label>
        <select
          value={sourceId}
          onChange={(e) => setSourceId(parseInt(e.target.value, 10))}
          className={cn(
            "w-full rounded-lg px-3 py-2 text-sm",
            "bg-[#0E0E11] border border-[#232328]",
            "text-[#F0EDE8]",
            "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
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

      {/* Patient ID */}
      <div>
        <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
          Seed Patient ID
        </label>
        <input
          type="text"
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
          placeholder="e.g. 12345"
          className={cn(
            "w-full rounded-lg px-3 py-2 text-sm",
            "bg-[#0E0E11] border border-[#232328]",
            "text-[#F0EDE8] placeholder:text-[#5A5650]",
            "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
          )}
        />
      </div>

      {/* Dimension Weight Sliders */}
      {dimensions && dimensions.length > 0 && (
        <div>
          <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-2">
            Dimension Weights
          </label>
          <div className="space-y-3">
            {dimensions.filter((d) => d.is_active).map((dim) => (
              <div key={dim.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#C5C0B8]">{dim.name}</span>
                  <span className="text-[10px] font-medium text-[#2DD4BF] tabular-nums">
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
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#232328] accent-[#2DD4BF]"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider">
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
              "bg-[#0E0E11] border border-[#232328]",
              "text-[#F0EDE8] placeholder:text-[#5A5650]",
              "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
            )}
          />
          <span className="text-[#5A5650] text-xs">-</span>
          <input
            type="text"
            value={ageMax}
            onChange={(e) => setAgeMax(e.target.value)}
            placeholder="Max age"
            className={cn(
              "w-1/2 rounded-lg px-3 py-1.5 text-xs",
              "bg-[#0E0E11] border border-[#232328]",
              "text-[#F0EDE8] placeholder:text-[#5A5650]",
              "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
            )}
          />
        </div>

        {/* Gender Filter */}
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className={cn(
            "w-full rounded-lg px-3 py-1.5 text-xs",
            "bg-[#0E0E11] border border-[#232328]",
            "text-[#F0EDE8]",
            "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
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
          "bg-[#9B1B30] text-white hover:bg-[#B22040]",
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
