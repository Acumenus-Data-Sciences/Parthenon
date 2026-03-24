import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Trash2, MessageSquare } from "lucide-react";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useAnnotations, useDeleteAnnotation } from "../../../hooks/useAnnotationData";

export function AnnotationsView() {
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);

  const { data: sources } = useQuery({ queryKey: ["sources"], queryFn: fetchSources });
  const { data: annotations, isLoading } = useAnnotations(selectedSourceId);
  const deleteMutation = useDeleteAnnotation(selectedSourceId ?? 0);

  const handleDelete = (annotationId: number) => {
    if (!confirm("Delete this annotation?")) return;
    deleteMutation.mutate(annotationId);
  };

  return (
    <div className="space-y-4">
      {/* Source selector */}
      <div className="flex items-center gap-3">
        <select
          value={selectedSourceId ?? ""}
          onChange={(e) => setSelectedSourceId(e.target.value ? Number(e.target.value) : null)}
          className="rounded-lg border border-[#252530] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none"
        >
          <option value="">All sources</option>
          {sources?.map((s) => (
            <option key={s.id} value={s.id}>{s.source_name}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {selectedSourceId && isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-[#8A857D]" />
        </div>
      )}

      {/* Empty state */}
      {!selectedSourceId && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#151518] py-16">
          <MessageSquare size={32} className="text-[#8A857D] mb-3" />
          <p className="text-sm text-[#8A857D]">Select a source to view its annotations</p>
        </div>
      )}

      {selectedSourceId && !isLoading && (!annotations || annotations.length === 0) && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#151518] py-16">
          <MessageSquare size={32} className="text-[#8A857D] mb-3" />
          <p className="text-sm text-[#8A857D]">No annotations yet for this source</p>
        </div>
      )}

      {/* Annotation list */}
      {annotations && annotations.length > 0 && (
        <div className="space-y-3">
          {annotations.map((ann) => (
            <div
              key={ann.id}
              className="flex items-start justify-between rounded-xl border border-[#252530] bg-[#151518] p-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#C9A227]/10 px-2 py-0.5 text-xs font-medium text-[#C9A227]">
                    {ann.chart_type}
                  </span>
                  <span className="text-xs text-[#8A857D]">x = {ann.x_value}</span>
                  {ann.y_value != null && (
                    <span className="text-xs text-[#8A857D]">y = {ann.y_value}</span>
                  )}
                </div>
                <p className="text-sm text-[#F0EDE8]">{ann.annotation_text}</p>
                <div className="flex gap-3 text-xs text-[#8A857D]">
                  {ann.creator && <span>{ann.creator.name}</span>}
                  {ann.source && <span>{ann.source.source_name}</span>}
                  <span>{new Date(ann.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(ann.id)}
                disabled={deleteMutation.isPending}
                className="text-[#8A857D] hover:text-[#9B1B30] transition-colors p-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
