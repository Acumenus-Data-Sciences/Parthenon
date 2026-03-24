import { useState } from "react";
import type { ChartAnnotation, StoreAnnotationPayload } from "../../../types/ares";

interface CreateModeProps {
  mode: "create";
  chartType: string;
  chartContext: Record<string, unknown>;
  xValue: string;
  onSave: (payload: StoreAnnotationPayload) => void;
  onCancel: () => void;
}

interface EditModeProps {
  mode: "edit";
  annotation: ChartAnnotation;
  onSave: (text: string) => void;
  onCancel: () => void;
}

type AnnotationPopoverProps = CreateModeProps | EditModeProps;

export function AnnotationPopover(props: AnnotationPopoverProps) {
  const [text, setText] = useState(
    props.mode === "edit" ? props.annotation.annotation_text : "",
  );

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (props.mode === "create") {
      props.onSave({
        chart_type: props.chartType,
        chart_context: props.chartContext,
        x_value: props.xValue,
        annotation_text: trimmed,
      });
    } else {
      props.onSave(trimmed);
    }
  };

  return (
    <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 shadow-xl space-y-2 w-64">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add annotation..."
        rows={3}
        className="w-full rounded-lg border border-[#252530] bg-[#0E0E11] px-2 py-1.5 text-sm text-[#F0EDE8] placeholder-[#8A857D] focus:border-[#C9A227] focus:outline-none resize-none"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded px-2 py-1 text-xs text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!text.trim()}
          className="rounded bg-[#C9A227] px-3 py-1 text-xs font-medium text-[#0E0E11] hover:bg-[#e0b82e] disabled:opacity-50 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
