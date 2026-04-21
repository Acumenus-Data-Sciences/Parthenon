import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import type { DemographicFilter } from "../../types/cohortExpression";
import { useTranslation } from "react-i18next";

export function DemographicsStep() {
  const { t } = useTranslation("app");
  const { demographics, setDemographics } = useCohortWizardStore();
  const genderOptions = [
    { conceptId: 8507, label: t("cohortDefinitions.auto.male_63889c") },
    { conceptId: 8532, label: t("cohortDefinitions.auto.female_b719ce") },
  ] as const;
  const raceOptions = [
    { conceptId: 8527, label: t("cohortDefinitions.auto.white_25a817") },
    {
      conceptId: 8516,
      label: t("cohortDefinitions.auto.blackOrAfricanAmerican_ff9b5d"),
    },
    { conceptId: 8515, label: t("cohortDefinitions.auto.asian_32547b") },
    {
      conceptId: 8557,
      label: t("cohortDefinitions.auto.nativeHawaiianOrOtherPacificIslander_223ed7"),
    },
    {
      conceptId: 8657,
      label: t("cohortDefinitions.auto.americanIndianOrAlaskaNative_30d0bd"),
    },
  ] as const;
  const ethnicityOptions = [
    {
      conceptId: 38003563,
      label: t("cohortDefinitions.auto.hispanicOrLatino_1f7dba"),
    },
    {
      conceptId: 38003564,
      label: t("cohortDefinitions.auto.notHispanicOrLatino_fa7b68"),
    },
  ] as const;

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
          {t("cohortDefinitions.auto.step2Of3Demographics_b4ecd7")}{" "}
          <span className="text-[11px] text-text-ghost">{t("cohortDefinitions.auto.optional_f53d1c")}</span>
        </div>
        <p className="text-[13px] text-text-muted">
          {t("cohortDefinitions.auto.anyAgeGenderRaceOrEthnicityRestrictions_3579bf")}
        </p>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-base p-4">
        <div className="flex flex-col gap-5">
          {/* Age */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-text-secondary">
              {t("cohortDefinitions.auto.ageRange_2d0f27")}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={120}
                placeholder={t("cohortDefinitions.auto.min_78d811")}
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
                className="w-[80px] rounded-md border border-border-default bg-surface-overlay px-3 py-2 text-center text-[13px] text-accent outline-none focus:border-accent"
              />
              <span className="text-[13px] text-text-muted">to</span>
              <input
                type="number"
                min={0}
                max={120}
                placeholder={t("cohortDefinitions.auto.max_6a0613")}
                value={ageMax ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                  if (val !== undefined || ageMin !== undefined) {
                    updateField("Age", { Value: ageMin ?? 0, Op: "bt" as const, Extent: val });
                  } else {
                    updateField("Age", undefined);
                  }
                }}
                className="w-[80px] rounded-md border border-border-default bg-surface-overlay px-3 py-2 text-center text-[13px] text-accent outline-none focus:border-accent"
              />
              <span className="text-[13px] text-text-muted">years</span>
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-text-secondary">
              {t("cohortDefinitions.auto.gender_019ec3")}
            </label>
            <div className="flex gap-2">
              {genderOptions.map((g) => (
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
              {t("cohortDefinitions.auto.race_4e221f")}
            </label>
            <div className="flex flex-wrap gap-2">
              {raceOptions.map((r) => (
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
              {t("cohortDefinitions.auto.ethnicity_8919df")}
            </label>
            <div className="flex flex-wrap gap-2">
              {ethnicityOptions.map((e) => (
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
