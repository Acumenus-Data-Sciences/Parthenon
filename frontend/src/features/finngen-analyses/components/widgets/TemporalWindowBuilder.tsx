// frontend/src/features/finngen-analyses/components/widgets/TemporalWindowBuilder.tsx
import type { WidgetProps } from "@rjsf/utils";
import { Plus, Trash2 } from "lucide-react";
import { tAuto } from "@/i18n/autoUserFacing";

type TimeWindow = { start_day: number; end_day: number };

export function TemporalWindowBuilder(props: WidgetProps) {
  const { value, onChange } = props;
  const windows: TimeWindow[] = Array.isArray(value) ? value : [];

  function handleAdd() {
    onChange([...windows, { start_day: 0, end_day: 30 }]);
  }

  function handleRemove(idx: number) {
    onChange(windows.filter((_, i) => i !== idx));
  }

  function handleChange(idx: number, field: keyof TimeWindow, val: number) {
    onChange(
      windows.map((w, i) =>
        i === idx ? { ...w, [field]: val } : w,
      ),
    );
  }

  return (
    <div className="space-y-2">
      {windows.map((w, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-text-ghost w-12">{tAuto("from_3f66052a")}</label>
              <input
                type="number"
                value={w.start_day}
                onChange={(e) => handleChange(idx, "start_day", parseInt(e.target.value, 10) || 0)}
                className="w-full rounded border border-border-default bg-surface-base px-2 py-1 text-xs text-text-primary focus:border-success focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-text-ghost w-12">{tAuto("to_ae79ea1e")}</label>
              <input
                type="number"
                value={w.end_day}
                onChange={(e) => handleChange(idx, "end_day", parseInt(e.target.value, 10) || 0)}
                className="w-full rounded border border-border-default bg-surface-base px-2 py-1 text-xs text-text-primary focus:border-success focus:outline-none"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleRemove(idx)}
            className="text-text-ghost hover:text-critical transition-colors"
            aria-label={tAuto("removeWindow_a868f5b2")}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-1 text-xs text-success hover:text-success/80 transition-colors"
      >
        <Plus size={12} />
        {tAuto("addWindow_840e8f46")}
      </button>
    </div>
  );
}
