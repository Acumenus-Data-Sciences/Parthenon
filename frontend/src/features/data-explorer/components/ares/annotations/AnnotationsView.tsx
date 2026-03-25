import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Trash2, MessageSquare, Search } from "lucide-react";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useAnnotations, useDeleteAnnotation } from "../../../hooks/useAnnotationData";

const TAG_OPTIONS = [
  { value: undefined, label: "All", color: "border-[#333] text-[#888]", activeBg: "border-[#C9A227] bg-[#C9A227]/10 text-[#C9A227]" },
  { value: "data_event", label: "Data Event", color: "border-[#333] text-[#888]", activeBg: "border-[#2DD4BF] bg-[#2DD4BF]/10 text-[#2DD4BF]" },
  { value: "research_note", label: "Research Note", color: "border-[#333] text-[#888]", activeBg: "border-[#C9A227] bg-[#C9A227]/10 text-[#C9A227]" },
  { value: "action_item", label: "Action Item", color: "border-[#333] text-[#888]", activeBg: "border-[#9B1B30] bg-[#9B1B30]/10 text-[#9B1B30]" },
  { value: "system", label: "System", color: "border-[#333] text-[#888]", activeBg: "border-[#6366F1] bg-[#6366F1]/10 text-[#6366F1]" },
] as const;

const TAG_BADGE_COLORS: Record<string, string> = {
  data_event: "bg-[#2DD4BF]/10 text-[#2DD4BF]",
  research_note: "bg-[#C9A227]/10 text-[#C9A227]",
  action_item: "bg-[#9B1B30]/10 text-[#9B1B30]",
  system: "bg-[#6366F1]/10 text-[#6366F1]",
};

const TAG_LABELS: Record<string, string> = {
  data_event: "Data Event",
  research_note: "Research Note",
  action_item: "Action Item",
  system: "System",
};

export function AnnotationsView() {
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [tagFilter, setTagFilter] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: sources } = useQuery({ queryKey: ["sources"], queryFn: fetchSources });
  const filters = {
    tag: tagFilter,
    search: debouncedSearch || undefined,
  };
  const { data: annotations, isLoading } = useAnnotations(selectedSourceId, undefined, filters);
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

      {/* Tag filter pills + search */}
      {selectedSourceId && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {TAG_OPTIONS.map((opt) => {
              const isActive = tagFilter === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setTagFilter(opt.value)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    isActive ? opt.activeBg : opt.color + " hover:border-[#555]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555]" />
            <input
              type="text"
              placeholder="Search annotations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-[#252530] bg-[#151518] py-1.5 pl-8 pr-3 text-sm text-[#F0EDE8]
                         placeholder-[#555] focus:border-[#2DD4BF] focus:outline-none"
            />
          </div>
        </div>
      )}

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
                  {ann.tag && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TAG_BADGE_COLORS[ann.tag] ?? "bg-[#333]/20 text-[#888]"}`}>
                      {TAG_LABELS[ann.tag] ?? ann.tag}
                    </span>
                  )}
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
