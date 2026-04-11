import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import type { DemographicFilter } from "../../types/cohortExpression";

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

export function DemographicsStep() {
  const { demographics, setDemographics } = useCohortWizardStore();

  const ageMin = demographics?.Age?.Value;
  const ageMax = demographics?.Age?.Extent;
  const genders = demographics?.Gender ?? [];
  const races = demographics?.Race ?? [];
  const ethnicities = demographics?.Ethnicity ?? [];

  const updateField = (
    field: keyof DemographicFilter,
    value: DemographicFilter[keyof DemographicFilter],
  ) => {
    const current: DemographicFilter = demographics ?? {};
    setDemographics({ ...current, [field]: value });
  };

  const toggleInArray = (arr: number[], id: number): number[] =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#C5C0B8]">
          Demographics{" "}
          <span className="text-[11px] text-[#5A5650]">(optional)</span>
        </div>
        <p className="text-[13px] text-[#8A857D]">
          Any age, gender, race, or ethnicity restrictions?
        </p>
      </div>

      <div className="rounded-lg border border-[#2A2A30] bg-[#0E0E11] p-4">
        <div className="flex flex-col gap-5">
          {/* Age */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-[#C5C0B8]">
              Age Range
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={120}
                placeholder="Min"
                value={ageMin ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                  if (val !== undefined) {
                    updateField("Age", { Value: val, Op: "bt" as const, Extent: ageMax });
                  } else if (ageMax !== undefined) {
                    updateField("Age", { Value: 0, Op: "bt" as const, Extent: ageMax });
                  } else {
                    updateField("Age", undefined);
                  }
                }}
                className="w-[80px] rounded-md border border-[#323238] bg-[#1C1C20] px-3 py-2 text-center text-[13px] text-[#C9A227] outline-none focus:border-[#C9A227]"
              />
              <span className="text-[13px] text-[#8A857D]">to</span>
              <input
                type="number"
                min={0}
                max={120}
                placeholder="Max"
                value={ageMax ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                  if (val !== undefined || ageMin !== undefined) {
                    updateField("Age", { Value: ageMin ?? 0, Op: "bt" as const, Extent: val });
                  } else {
                    updateField("Age", undefined);
                  }
                }}
                className="w-[80px] rounded-md border border-[#323238] bg-[#1C1C20] px-3 py-2 text-center text-[13px] text-[#C9A227] outline-none focus:border-[#C9A227]"
              />
              <span className="text-[13px] text-[#8A857D]">years</span>
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-[#C5C0B8]">
              Gender
            </label>
            <div className="flex gap-2">
              {GENDER_OPTIONS.map((g) => (
                <button
                  key={g.conceptId}
                  type="button"
                  onClick={() => updateField("Gender", toggleInArray(genders, g.conceptId))}
                  className={`rounded-md px-4 py-1.5 text-[12px] transition-colors ${
                    genders.includes(g.conceptId)
                      ? "bg-[#2DD4BF] font-medium text-[#0E0E11]"
                      : "border border-[#2A2A30] text-[#8A857D] hover:border-[#3A3A42]"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Race */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-[#C5C0B8]">
              Race
            </label>
            <div className="flex flex-wrap gap-2">
              {RACE_OPTIONS.map((r) => (
                <label
                  key={r.conceptId}
                  className="flex items-center gap-1.5 text-[12px] text-[#8A857D]"
                >
                  <input
                    type="checkbox"
                    checked={races.includes(r.conceptId)}
                    onChange={() => updateField("Race", toggleInArray(races, r.conceptId))}
                    className="accent-[#2DD4BF]"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          {/* Ethnicity */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-[#C5C0B8]">
              Ethnicity
            </label>
            <div className="flex flex-wrap gap-2">
              {ETHNICITY_OPTIONS.map((e) => (
                <label
                  key={e.conceptId}
                  className="flex items-center gap-1.5 text-[12px] text-[#8A857D]"
                >
                  <input
                    type="checkbox"
                    checked={ethnicities.includes(e.conceptId)}
                    onChange={() => updateField("Ethnicity", toggleInArray(ethnicities, e.conceptId))}
                    className="accent-[#2DD4BF]"
                  />
                  {e.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
