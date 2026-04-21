import { cn } from "@/lib/utils";
import { ConceptSetPicker } from "./ConceptSetPicker";
import type { EndStrategy } from "../types/cohortExpression";
import { useTranslation } from "react-i18next";

interface EndStrategyEditorProps {
  value?: EndStrategy;
  onChange: (strategy: EndStrategy) => void;
}

type StrategyType = "observation" | "fixed" | "customEra";

function getStrategyType(strategy?: EndStrategy): StrategyType {
  if (!strategy) return "observation";
  if (strategy.CustomEra) return "customEra";
  if (strategy.DateOffset) return "fixed";
  return "observation";
}

export function EndStrategyEditor({
  value,
  onChange,
}: EndStrategyEditorProps) {
  const { t } = useTranslation("app");
  const strategyType = getStrategyType(value);

  const handleTypeChange = (type: StrategyType) => {
    switch (type) {
      case "observation":
        onChange({});
        break;
      case "fixed":
        onChange({
          DateOffset: {
            DateField: "StartDate",
            Offset: 0,
          },
        });
        break;
      case "customEra":
        onChange({
          CustomEra: {
            DrugCodesetId: 0,
            GapDays: 0,
            Offset: 0,
          },
        });
        break;
    }
  };

  const inputClass = cn(
    "w-24 rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-sm text-center",
    "text-text-primary focus:border-success focus:outline-none focus:ring-1 focus:ring-success/40",
    "font-['IBM_Plex_Mono',monospace] tabular-nums",
  );

  const selectClass = cn(
    "appearance-none rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-sm",
    "text-text-primary focus:border-success focus:outline-none focus:ring-1 focus:ring-success/40",
    "cursor-pointer",
  );

  return (
    <div className="space-y-4">
      {/* Strategy type radio buttons */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t("cohortDefinitions.auto.strategy_83de19")}
        </label>
        <div className="space-y-2">
          {(
            [
              {
                value: "observation",
                label: t("cohortDefinitions.auto.endOfContinuousObservation_3ac05b"),
                desc: "Cohort membership ends when the person's observation period ends",
              },
              {
                value: "fixed",
                label: t("cohortDefinitions.auto.fixedDurationFromEvent_d84644"),
                desc: "Cohort membership ends a fixed number of days from the index event",
              },
              {
                value: "customEra",
                label: t("cohortDefinitions.auto.customDrugEra_e40c69"),
                desc: "Cohort membership persists while the person is exposed to a drug",
              },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                strategyType === opt.value
                  ? "border-success/30 bg-success/5"
                  : "border-border-default bg-surface-raised hover:bg-surface-overlay",
              )}
            >
              <input
                type="radio"
                name="endStrategy"
                value={opt.value}
                checked={strategyType === opt.value}
                onChange={() => handleTypeChange(opt.value)}
                className="mt-0.5 border-border-default bg-surface-base text-success focus:ring-success/40"
              />
              <div>
                <span className="text-sm font-medium text-text-primary">
                  {opt.label}
                </span>
                <p className="text-xs text-text-ghost mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Fixed duration config */}
      {strategyType === "fixed" && value?.DateOffset && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-text-muted">{t("cohortDefinitions.auto.offsetFrom_67c774")}</label>
            <select
              value={value.DateOffset.DateField}
              onChange={(e) =>
                onChange({
                  DateOffset: {
                    ...value.DateOffset!,
                    DateField: e.target.value as "StartDate" | "EndDate",
                  },
                })
              }
              className={selectClass}
            >
              <option value="StartDate">{t("cohortDefinitions.auto.startDate_db3794")}</option>
              <option value="EndDate">{t("cohortDefinitions.auto.endDate_3c1429")}</option>
            </select>
            <label className="text-xs text-text-muted">plus</label>
            <input
              type="number"
              min={0}
              value={value.DateOffset.Offset}
              onChange={(e) =>
                onChange({
                  DateOffset: {
                    ...value.DateOffset!,
                    Offset: Math.max(0, Number(e.target.value)),
                  },
                })
              }
              className={inputClass}
            />
            <label className="text-xs text-text-muted">days</label>
          </div>
        </div>
      )}

      {/* Custom era config */}
      {strategyType === "customEra" && value?.CustomEra && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-text-muted">{t("cohortDefinitions.auto.drugConceptSet_df8db2")}</label>
            <ConceptSetPicker
              value={value.CustomEra.DrugCodesetId}
              onChange={(id) =>
                onChange({
                  CustomEra: { ...value.CustomEra!, DrugCodesetId: id },
                })
              }
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-text-muted">{t("cohortDefinitions.auto.gapDays_070b3a")}</label>
            <input
              type="number"
              min={0}
              value={value.CustomEra.GapDays}
              onChange={(e) =>
                onChange({
                  CustomEra: {
                    ...value.CustomEra!,
                    GapDays: Math.max(0, Number(e.target.value)),
                  },
                })
              }
              className={inputClass}
            />
            <label className="text-xs text-text-muted">{t("cohortDefinitions.auto.offset_dfd0a8")}</label>
            <input
              type="number"
              min={0}
              value={value.CustomEra.Offset}
              onChange={(e) =>
                onChange({
                  CustomEra: {
                    ...value.CustomEra!,
                    Offset: Math.max(0, Number(e.target.value)),
                  },
                })
              }
              className={inputClass}
            />
            <span className="text-xs text-text-muted">days</span>
          </div>
        </div>
      )}
    </div>
  );
}
