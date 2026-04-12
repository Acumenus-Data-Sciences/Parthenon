import { cn } from "@/lib/utils";
import type { TemporalWindow } from "../types/cohortExpression";

interface TemporalWindowEditorProps {
  value: TemporalWindow;
  onChange: (window: TemporalWindow) => void;
  label?: string;
}

const defaultWindow: TemporalWindow = {
  Start: { Days: 0, Coeff: -1 },
  End: { Days: 0, Coeff: 1 },
};

export function TemporalWindowEditor({
  value = defaultWindow,
  onChange,
  label = "Temporal Window",
}: TemporalWindowEditorProps) {
  const handleStartDays = (days: number) => {
    onChange({ ...value, Start: { ...value.Start, Days: days } });
  };

  const handleStartCoeff = (coeff: number) => {
    onChange({ ...value, Start: { ...value.Start, Coeff: coeff } });
  };

  const handleEndDays = (days: number) => {
    onChange({ ...value, End: { ...value.End, Days: days } });
  };

  const handleEndCoeff = (coeff: number) => {
    onChange({ ...value, End: { ...value.End, Coeff: coeff } });
  };

  const inputClass = cn(
    "w-20 rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-sm text-center",
    "text-text-primary focus:border-success focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/40",
    "font-['IBM_Plex_Mono',monospace] tabular-nums",
  );

  const selectClass = cn(
    "appearance-none rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-sm",
    "text-text-primary focus:border-success focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/40",
    "cursor-pointer",
  );

  return (
    <div className="space-y-3">
      <h5 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </h5>

      <div className="grid grid-cols-2 gap-3">
        {/* Start */}
        <div className="rounded-lg border border-border-default bg-surface-raised p-3 space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
            Start
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={value.Start.Days}
              onChange={(e) =>
                handleStartDays(Math.max(0, Number(e.target.value)))
              }
              className={inputClass}
            />
            <span className="text-xs text-text-muted">days</span>
            <select
              value={value.Start.Coeff}
              onChange={(e) => handleStartCoeff(Number(e.target.value))}
              className={selectClass}
            >
              <option value={-1}>before</option>
              <option value={1}>after</option>
            </select>
          </div>
        </div>

        {/* End */}
        <div className="rounded-lg border border-border-default bg-surface-raised p-3 space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
            End
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={value.End.Days}
              onChange={(e) =>
                handleEndDays(Math.max(0, Number(e.target.value)))
              }
              className={inputClass}
            />
            <span className="text-xs text-text-muted">days</span>
            <select
              value={value.End.Coeff}
              onChange={(e) => handleEndCoeff(Number(e.target.value))}
              className={selectClass}
            >
              <option value={-1}>before</option>
              <option value={1}>after</option>
            </select>
          </div>
        </div>
      </div>

      {/* Additional options */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.UseEventEnd ?? false}
            onChange={(e) =>
              onChange({ ...value, UseEventEnd: e.target.checked })
            }
            className="rounded border-border-default bg-surface-base text-success focus:ring-[#2DD4BF]/40"
          />
          <span className="text-xs text-text-muted">Use event end date</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.UseIndexEnd ?? false}
            onChange={(e) =>
              onChange({ ...value, UseIndexEnd: e.target.checked })
            }
            className="rounded border-border-default bg-surface-base text-success focus:ring-[#2DD4BF]/40"
          />
          <span className="text-xs text-text-muted">Use index end date</span>
        </label>
      </div>
    </div>
  );
}
