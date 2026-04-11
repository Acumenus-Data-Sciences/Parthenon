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
        <div className="mb-1 text-[13px] font-medium text-text-secondary">
          Demographics{" "}
          <span className="text-[11px] text-text-ghost">(optional)</span>
        </div>
        <p className="text-[13px] text-text-muted">
          Any age, gender, race, or ethnicity restrictions?
        </p>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-base p-4">
        <div className="flex flex-col gap-5">
          {/* Age */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-text-secondary">
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
                className="w-[80px] rounded-md border border-surface-highlight bg-surface-overlay px-3 py-2 text-center text-[13px] text-accent outline-none focus:border-accent"
              />
              <span className="text-[13px] text-text-muted">to</span>
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
                className="w-[80px] rounded-md border border-surface-highlight bg-surface-overlay px-3 py-2 text-center text-[13px] text-accent outline-none focus:border-accent"
              />
              <span className="text-[13px] text-text-muted">years</span>
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-text-secondary">
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
                      ? "bg-success font-medium text-surface-base"
                      : "border border-border-default text-text-muted hover:border-surface-highlight"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Race */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-text-secondary">
              Race
            </label>
            <div className="flex flex-wrap gap-2">
              {RACE_OPTIONS.map((r) => (
                <label
                  key={r.conceptId}
                  className="flex items-center gap-1.5 text-[12px] text-text-muted"
                >
                  <input
                    type="checkbox"
                    checked={races.includes(r.conceptId)}
                    onChange={() => updateField("Race", toggleInArray(races, r.conceptId))}
                    className="accent-success"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          {/* Ethnicity */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-text-secondary">
              Ethnicity
            </label>
            <div className="flex flex-wrap gap-2">
              {ETHNICITY_OPTIONS.map((e) => (
                <label
                  key={e.conceptId}
                  className="flex items-center gap-1.5 text-[12px] text-text-muted"
                >
                  <input
                    type="checkbox"
                    checked={ethnicities.includes(e.conceptId)}
                    onChange={() => updateField("Ethnicity", toggleInArray(ethnicities, e.conceptId))}
                    className="accent-success"
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
