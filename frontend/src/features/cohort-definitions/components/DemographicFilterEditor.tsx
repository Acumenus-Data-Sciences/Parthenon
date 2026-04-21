import { cn } from "@/lib/utils";
import type { DemographicFilter } from "../types/cohortExpression";
import { useTranslation } from "react-i18next";

interface DemographicFilterEditorProps {
  value: DemographicFilter;
  onChange: (filter: DemographicFilter) => void;
  onRemove?: () => void;
}

export function DemographicFilterEditor({
  value,
  onChange,
  onRemove,
}: DemographicFilterEditorProps) {
  const { t } = useTranslation("app");
  const inputClass = cn(
    "w-20 rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-sm text-center",
    "text-text-primary focus:border-success focus:outline-none focus:ring-1 focus:ring-success/40",
    "font-['IBM_Plex_Mono',monospace] tabular-nums",
  );
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
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      {/* Age */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t("cohortDefinitions.auto.ageRange_2d0f27")}
        </label>
        <div className="flex items-center gap-3">
          <label className="text-xs text-text-muted">{t("cohortDefinitions.auto.between_5ccb72")}</label>
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
            placeholder={t("cohortDefinitions.auto.min_78d811")}
            className={inputClass}
          />
          <label className="text-xs text-text-muted">and</label>
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
            placeholder={t("cohortDefinitions.auto.max_6a0613")}
            className={inputClass}
          />
          <label className="text-xs text-text-muted">years</label>
        </div>
      </div>

      {/* Gender */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t("cohortDefinitions.auto.gender_019ec3")}
        </label>
        <div className="flex items-center gap-3">
          {genderOptions.map((opt) => {
            const isSelected = (value.Gender ?? []).includes(opt.conceptId);
            return (
              <label
                key={opt.conceptId}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer transition-colors",
                  isSelected
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-border-default bg-surface-base text-text-muted hover:text-text-secondary",
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
        <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t("cohortDefinitions.auto.race_4e221f")}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {raceOptions.map((opt) => {
            const isSelected = (value.Race ?? []).includes(opt.conceptId);
            return (
              <label
                key={opt.conceptId}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer transition-colors",
                  isSelected
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-border-default bg-surface-base text-text-muted hover:text-text-secondary",
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
        <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t("cohortDefinitions.auto.ethnicity_8919df")}
        </label>
        <div className="flex items-center gap-3">
          {ethnicityOptions.map((opt) => {
            const isSelected = (value.Ethnicity ?? []).includes(
              opt.conceptId,
            );
            return (
              <label
                key={opt.conceptId}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer transition-colors",
                  isSelected
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-border-default bg-surface-base text-text-muted hover:text-text-secondary",
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
        <div className="pt-2 border-t border-border-default">
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-text-muted hover:text-critical transition-colors"
          >
            {t("cohortDefinitions.auto.removeFilter_5e56e9")}
          </button>
        </div>
      )}
    </div>
  );
}
