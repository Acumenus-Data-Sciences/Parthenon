import { useState } from "react";
import { X, MessageSquarePlus } from "lucide-react";

interface CreateFromChartPopoverProps {
  chartType: string;
  xValue: string;
  yValue?: number;
  chartContext?: Record<string, unknown>;
  onSubmit: (data: {
    chart_type: string;
    chart_context: Record<string, unknown>;
    x_value: string;
    y_value?: number;
    annotation_text: string;
    tag?: string;
  }) => void;
  onClose: () => void;
  position?: { x: number; y: number };
}

const TAG_OPTIONS = [
  { value: "data_event", label: "Data Event", color: "border-[#2DD4BF] text-[#2DD4BF]" },
  { value: "research_note", label: "Research Note", color: "border-[#C9A227] text-[#C9A227]" },
  { value: "action_item", label: "Action Item", color: "border-[#e85d75] text-[#e85d75]" },
] as const;

export default function CreateFromChartPopover({
  chartType,
  xValue,
  yValue,
  chartContext = {},
  onSubmit,
  onClose,
  position,
}: CreateFromChartPopoverProps) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!text.trim()) return;
    setIsSubmitting(true);
    onSubmit({
      chart_type: chartType,
      chart_context: chartContext,
      x_value: xValue,
      y_value: yValue,
      annotation_text: text.trim(),
      tag,
    });
    setIsSubmitting(false);
    onClose();
  };

  const style = position
    ? { position: "absolute" as const, left: position.x, top: position.y, zIndex: 50 }
    : { zIndex: 50 };

  return (
    <div
      style={style}
      className="w-80 rounded-lg border border-[#252530] bg-[#1a1a22] p-4 shadow-xl"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquarePlus size={14} className="text-[#C9A227]" />
          <span className="text-xs font-medium text-[#ccc]">Add Note</span>
        </div>
        <button type="button" onClick={onClose} className="text-[#555] hover:text-[#888]">
          <X size={14} />
        </button>
      </div>

      {/* Context */}
      <div className="mb-3 rounded border border-[#252530] bg-[#151518] px-3 py-1.5 text-[10px] text-[#666]">
        <span className="text-[#888]">{chartType}</span> at x={xValue}
        {yValue != null && <span> y={yValue}</span>}
      </div>

      {/* Tag selector */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TAG_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTag(tag === opt.value ? undefined : opt.value)}
            className={`rounded-full border px-2.5 py-0.5 text-[10px] transition-colors ${
              tag === opt.value
                ? opt.color + " bg-white/5"
                : "border-[#333] text-[#666] hover:border-[#555]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Text input */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add your note..."
        rows={3}
        className="mb-3 w-full rounded-lg border border-[#252530] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8]
                   placeholder-[#555] focus:border-[#2DD4BF] focus:outline-none"
      />

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!text.trim() || isSubmitting}
        className="w-full rounded-lg bg-[#C9A227] px-3 py-1.5 text-xs font-medium text-[#0E0E11]
                   transition-colors hover:bg-[#d4ad2e] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSubmitting ? "Saving..." : "Add Annotation"}
      </button>
    </div>
  );
}
