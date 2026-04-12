import { cn } from "@/lib/utils";
import type { DemographicFilter } from "../types/cohortExpression";

interface DemographicFilterEditorProps {
  value: DemographicFilter;
  onChange: (filter: DemographicFilter) => void;
  onRemove?: () => void;
}

// Standard OHDSI concept IDs for demographics
const GENDER_OPTIONS = [
  { conceptId: 8507, label: "Male" },
  { conceptId: 8532, label: "Female" },
] as const;

const RACE_OPTIONS = [
  { conceptId: 8527, label: "White" },
  { conceptId: 8516, label: "Black or African American" },
  { conceptId: 8515, label: "Asian" },
  { conceptId: 8557, label: "Native Hawaiian or Other Pacific Islander" },
  { conceptId: 8657, label: "American Indian or Alaska Native" },
] as const;

const ETHNICITY_OPTIONS = [
  { conceptId: 38003563, label: "Hispanic or Latino" },
  { conceptId: 38003564, label: "Not Hispanic or Latino" },
] as const;

export function DemographicFilterEditor({
  value,
  onChange,
  onRemove,
}: DemographicFilterEditorProps) {
  const inputClass = cn(
    "w-20 rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-1.5 text-sm text-center",
    "text-[#F0EDE8] focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/40",
    "font-['IBM_Plex_Mono',monospace] tabular-nums",
  );

  const toggleConcept = (
    field: "Gender" | "Race" | "Ethnicity",
    conceptId: number,
  ) => {
    const current = value[field] ?? [];
    const next = current.includes(conceptId)
      ? current.filter((id) => id !== conceptId)
      : [...current, conceptId];
    onChange({ ...value, [field]: next.length > 0 ? next : undefined });
  };

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
      {/* Age */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
          Age Range
        </label>
        <div className="flex items-center gap-3">
          <label className="text-xs text-[#8A857D]">Between</label>
          <input
            type="number"
            min={0}
            max={150}
            value={value.Age?.Value ?? ""}
            onChange={(e) => {
              const val = e.target.value === "" ? undefined : Number(e.target.value);
              if (val === undefined) {
                const { Age: _, ...rest } = value;
                onChange(rest);
              } else {
                onChange({
                  ...value,
                  Age: {
                    Value: val,
                    Op: "bt" as const,
                    Extent: value.Age?.Extent ?? 120,
                  },
                });
              }
            }}
            placeholder="Min"
            className={inputClass}
          />
          <label className="text-xs text-[#8A857D]">and</label>
          <input
            type="number"
            min={0}
            max={150}
            value={value.Age?.Extent ?? ""}
            onChange={(e) => {
              const val = e.target.value === "" ? undefined : Number(e.target.value);
              onChange({
                ...value,
                Age: {
                  Value: value.Age?.Value ?? 0,
                  Op: "bt" as const,
                  Extent: val ?? 120,
                },
              });
            }}
            placeholder="Max"
            className={inputClass}
          />
          <label className="text-xs text-[#8A857D]">years</label>
        </div>
      </div>

      {/* Gender */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
          Gender
        </label>
        <div className="flex items-center gap-3">
          {GENDER_OPTIONS.map((opt) => {
            const isSelected = (value.Gender ?? []).includes(opt.conceptId);
            return (
              <label
                key={opt.conceptId}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer transition-colors",
                  isSelected
                    ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/10 text-[#2DD4BF]"
                    : "border-[#232328] bg-[#0E0E11] text-[#8A857D] hover:text-[#C5C0B8]",
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleConcept("Gender", opt.conceptId)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </div>

      {/* Race */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
          Race
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {RACE_OPTIONS.map((opt) => {
            const isSelected = (value.Race ?? []).includes(opt.conceptId);
            return (
              <label
                key={opt.conceptId}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer transition-colors",
                  isSelected
                    ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/10 text-[#2DD4BF]"
                    : "border-[#232328] bg-[#0E0E11] text-[#8A857D] hover:text-[#C5C0B8]",
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleConcept("Race", opt.conceptId)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </div>

      {/* Ethnicity */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
          Ethnicity
        </label>
        <div className="flex items-center gap-3">
          {ETHNICITY_OPTIONS.map((opt) => {
            const isSelected = (value.Ethnicity ?? []).includes(
              opt.conceptId,
            );
            return (
              <label
                key={opt.conceptId}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer transition-colors",
                  isSelected
                    ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/10 text-[#2DD4BF]"
                    : "border-[#232328] bg-[#0E0E11] text-[#8A857D] hover:text-[#C5C0B8]",
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleConcept("Ethnicity", opt.conceptId)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </div>

      {/* Remove */}
      {onRemove && (
        <div className="pt-2 border-t border-[#232328]">
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-[#8A857D] hover:text-[#E85A6B] transition-colors"
          >
            Remove filter
          </button>
        </div>
      )}
    </div>
  );
}
