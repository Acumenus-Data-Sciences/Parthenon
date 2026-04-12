import type { ChartAnnotation } from "../../../types/ares";

interface AnnotationTimelineProps {
  annotations: ChartAnnotation[];
}

const TAG_COLORS: Record<string, string> = {
  data_event: "border-[#2DD4BF] bg-[#2DD4BF]/10 text-[#2DD4BF]",
  research_note: "border-[#C9A227] bg-[#C9A227]/10 text-[#C9A227]",
  action_item: "border-[#e85d75] bg-[#e85d75]/10 text-[#e85d75]",
  system: "border-[#7c8aed] bg-[#7c8aed]/10 text-[#7c8aed]",
};

export default function AnnotationTimeline({ annotations }: AnnotationTimelineProps) {
  const sorted = [...annotations].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[#555]">
        No annotations to display in timeline.
      </div>
    );
  }

  return (
    <div className="relative ml-4 border-l border-[#252530] pl-6">
      {sorted.map((ann) => (
        <div key={ann.id} className="relative mb-6">
          {/* Timeline dot */}
          <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-[#252530] bg-[#C9A227]" />

          <div className="rounded-lg border border-[#252530] bg-[#151518] p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs text-[#666]">
                {new Date(ann.created_at).toLocaleDateString()} at{" "}
                {new Date(ann.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              {ann.tag && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    TAG_COLORS[ann.tag] ?? "border-[#333] text-[#888]"
                  }`}
                >
                  {ann.tag}
                </span>
              )}
              <span className="text-xs text-[#555]">{ann.chart_type}</span>
            </div>
            <p className="text-sm text-[#ccc]">{ann.annotation_text}</p>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-[#555]">
              <span>{ann.creator?.name ?? "System"}</span>
              {ann.source?.source_name && <span>on {ann.source.source_name}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
