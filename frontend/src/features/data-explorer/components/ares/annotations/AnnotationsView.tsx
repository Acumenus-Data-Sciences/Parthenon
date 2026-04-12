import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Trash2, MessageSquare, Search, List, Clock, Reply, Send } from "lucide-react";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useAnnotations, useCreateAnnotation, useDeleteAnnotation } from "../../../hooks/useAnnotationData";
import AnnotationTimeline from "./AnnotationTimeline";
import type { ChartAnnotation } from "../../../types/ares";

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

type ViewMode = "list" | "timeline";

function ReplyCard({ reply, onDelete }: { reply: ChartAnnotation; onDelete: (id: number) => void }) {
  return (
    <div className="ml-6 flex items-start justify-between border-l-2 border-[#252530] pl-3 py-2">
      <div className="space-y-0.5">
        <p className="text-xs text-[#F0EDE8]">{reply.annotation_text}</p>
        <div className="flex gap-2 text-[10px] text-[#8A857D]">
          {reply.creator && <span>{reply.creator.name}</span>}
          <span>{new Date(reply.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDelete(reply.id)}
        className="text-[#8A857D] hover:text-[#9B1B30] transition-colors p-0.5 shrink-0"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

function ReplyForm({
  sourceId,
  parentAnnotation,
  onClose,
}: {
  sourceId: number;
  parentAnnotation: ChartAnnotation;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const createMutation = useCreateAnnotation(sourceId);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    createMutation.mutate(
      {
        chart_type: parentAnnotation.chart_type,
        chart_context: parentAnnotation.chart_context,
        x_value: parentAnnotation.x_value,
        annotation_text: trimmed,
        parent_id: parentAnnotation.id,
      },
      {
        onSuccess: () => {
          setText("");
          onClose();
        },
      },
    );
  };

  return (
    <div className="ml-6 mt-2 flex gap-2 border-l-2 border-[#252530] pl-3">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a reply..."
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        className="flex-1 rounded-lg border border-[#252530] bg-[#0E0E11] px-2.5 py-1.5 text-xs text-[#F0EDE8]
                   placeholder-[#555] focus:border-[#C9A227] focus:outline-none"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!text.trim() || createMutation.isPending}
        className="rounded-lg bg-[#C9A227] px-2.5 py-1.5 text-xs font-medium text-[#0E0E11] hover:bg-[#e0b82e] disabled:opacity-50 transition-colors"
      >
        <Send size={12} />
      </button>
    </div>
  );
}

export function AnnotationsView() {
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [tagFilter, setTagFilter] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);

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
      {/* Source selector + view toggle */}
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

        {/* View mode toggle */}
        <div className="flex rounded-lg border border-[#252530] bg-[#151518]">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
              viewMode === "list"
                ? "bg-[#C9A227]/10 text-[#C9A227]"
                : "text-[#666] hover:text-[#888]"
            }`}
          >
            <List size={13} />
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
              viewMode === "timeline"
                ? "bg-[#C9A227]/10 text-[#C9A227]"
                : "text-[#666] hover:text-[#888]"
            }`}
          >
            <Clock size={13} />
            Timeline
          </button>
        </div>
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

      {/* Annotation list or timeline */}
      {annotations && annotations.length > 0 && viewMode === "timeline" && (
        <AnnotationTimeline annotations={annotations} />
      )}

      {annotations && annotations.length > 0 && viewMode === "list" && (
        <div className="space-y-3">
          {annotations.map((ann) => (
            <div
              key={ann.id}
              className="rounded-xl border border-[#252530] bg-[#151518] p-4"
            >
              <div className="flex items-start justify-between">
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
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setReplyingTo(replyingTo === ann.id ? null : ann.id)}
                    className="text-[#8A857D] hover:text-[#2DD4BF] transition-colors p-1"
                    title="Reply"
                  >
                    <Reply size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(ann.id)}
                    disabled={deleteMutation.isPending}
                    className="text-[#8A857D] hover:text-[#9B1B30] transition-colors p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Replies (1 level only) */}
              {ann.replies && ann.replies.length > 0 && (
                <div className="mt-2 space-y-1">
                  {ann.replies.map((reply) => (
                    <ReplyCard key={reply.id} reply={reply} onDelete={handleDelete} />
                  ))}
                </div>
              )}

              {/* Reply form */}
              {replyingTo === ann.id && selectedSourceId && (
                <ReplyForm
                  sourceId={selectedSourceId}
                  parentAnnotation={ann}
                  onClose={() => setReplyingTo(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
