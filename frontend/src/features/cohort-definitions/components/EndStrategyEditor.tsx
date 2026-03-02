import { cn } from "@/lib/utils";
import { ConceptSetPicker } from "./ConceptSetPicker";
import type { EndStrategy } from "../types/cohortExpression";

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
    "w-24 rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-1.5 text-sm text-center",
    "text-[#F0EDE8] focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/40",
    "font-['IBM_Plex_Mono',monospace] tabular-nums",
  );

  const selectClass = cn(
    "appearance-none rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-1.5 text-sm",
    "text-[#F0EDE8] focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/40",
    "cursor-pointer",
  );

  return (
    <div className="space-y-4">
      {/* Strategy type radio buttons */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
          Strategy
        </label>
        <div className="space-y-2">
          {(
            [
              {
                value: "observation",
                label: "End of continuous observation",
                desc: "Cohort membership ends when the person's observation period ends",
              },
              {
                value: "fixed",
                label: "Fixed duration from event",
                desc: "Cohort membership ends a fixed number of days from the index event",
              },
              {
                value: "customEra",
                label: "Custom drug era",
                desc: "Cohort membership persists while the person is exposed to a drug",
              },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                strategyType === opt.value
                  ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/5"
                  : "border-[#232328] bg-[#151518] hover:bg-[#1C1C20]",
              )}
            >
              <input
                type="radio"
                name="endStrategy"
                value={opt.value}
                checked={strategyType === opt.value}
                onChange={() => handleTypeChange(opt.value)}
                className="mt-0.5 border-[#232328] bg-[#0E0E11] text-[#2DD4BF] focus:ring-[#2DD4BF]/40"
              />
              <div>
                <span className="text-sm font-medium text-[#F0EDE8]">
                  {opt.label}
                </span>
                <p className="text-xs text-[#5A5650] mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Fixed duration config */}
      {strategyType === "fixed" && value?.DateOffset && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-[#8A857D]">Offset from</label>
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
              <option value="StartDate">Start Date</option>
              <option value="EndDate">End Date</option>
            </select>
            <label className="text-xs text-[#8A857D]">plus</label>
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
            <label className="text-xs text-[#8A857D]">days</label>
          </div>
        </div>
      )}

      {/* Custom era config */}
      {strategyType === "customEra" && value?.CustomEra && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-[#8A857D]">Drug Concept Set</label>
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
            <label className="text-xs text-[#8A857D]">Gap days</label>
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
            <label className="text-xs text-[#8A857D]">Offset</label>
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
            <span className="text-xs text-[#8A857D]">days</span>
          </div>
        </div>
      )}
    </div>
  );
}
