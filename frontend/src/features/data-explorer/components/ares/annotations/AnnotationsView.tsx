import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Trash2, MessageSquare, Search, List, Clock, Reply, Send } from "lucide-react";
import { formatDate } from "@/i18n/format";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useAnnotations, useCreateAnnotation, useDeleteAnnotation } from "../../../hooks/useAnnotationData";
import AnnotationTimeline from "./AnnotationTimeline";
import type { ChartAnnotation } from "../../../types/ares";

const TAG_OPTIONS = [
  { value: undefined, labelKey: "all", color: "border-border-default text-text-muted", activeBg: "border-accent bg-accent/10 text-accent" },
  { value: "data_event", labelKey: "dataEvent", color: "border-border-default text-text-muted", activeBg: "border-success bg-success/10 text-success" },
  { value: "research_note", labelKey: "researchNote", color: "border-border-default text-text-muted", activeBg: "border-accent bg-accent/10 text-accent" },
  { value: "action_item", labelKey: "actionItem", color: "border-border-default text-text-muted", activeBg: "border-primary bg-primary/10 text-primary" },
  { value: "system", labelKey: "system", color: "border-border-default text-text-muted", activeBg: "border-info bg-domain-observation/10 text-domain-observation" },
] as const;

const TAG_BADGE_COLORS: Record<string, string> = {
  data_event: "bg-success/10 text-success",
  research_note: "bg-accent/10 text-accent",
  action_item: "bg-primary/10 text-primary",
  system: "bg-domain-observation/10 text-domain-observation",
};

const TAG_LABEL_KEYS: Record<string, string> = {
  data_event: "dataEvent",
  research_note: "researchNote",
  action_item: "actionItem",
  system: "system",
};

type ViewMode = "list" | "timeline";

function ReplyCard({ reply, onDelete }: { reply: ChartAnnotation; onDelete: (id: number) => void }) {
  const { t } = useTranslation("app");
  return (
    <div className="ml-6 flex items-start justify-between border-l-2 border-border-subtle pl-3 py-2">
      <div className="space-y-0.5">
        <p className="text-xs text-text-primary">{reply.annotation_text}</p>
        <div className="flex gap-2 text-[10px] text-text-muted">
          {reply.creator && <span>{reply.creator.name}</span>}
          <span>{formatDate(reply.created_at)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDelete(reply.id)}
        className="text-text-muted hover:text-primary transition-colors p-0.5 shrink-0"
        title={t("dataExplorer.ares.annotations.actions.delete")}
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
  const { t } = useTranslation("app");
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
    <div className="ml-6 mt-2 flex gap-2 border-l-2 border-border-subtle pl-3">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("dataExplorer.ares.annotations.replyPlaceholder")}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        className="flex-1 rounded-lg border border-border-subtle bg-surface-base px-2.5 py-1.5 text-xs text-text-primary
                   placeholder:text-text-ghost focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!text.trim() || createMutation.isPending}
        className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-surface-base hover:bg-accent-light disabled:opacity-50 transition-colors"
      >
        <Send size={12} />
      </button>
    </div>
  );
}

export function AnnotationsView() {
  const { t } = useTranslation("app");
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
    if (!confirm(t("dataExplorer.ares.annotations.confirmDelete"))) return;
    deleteMutation.mutate(annotationId);
  };

  return (
    <div className="space-y-4">
      {/* Source selector + view toggle */}
      <div className="flex items-center gap-3">
        <select
          value={selectedSourceId ?? ""}
          onChange={(e) => setSelectedSourceId(e.target.value ? Number(e.target.value) : null)}
          className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
        >
          <option value="">
            {t("dataExplorer.ares.annotations.filters.allSources")}
          </option>
          {sources?.map((s) => (
            <option key={s.id} value={s.id}>{s.source_name}</option>
          ))}
        </select>

        {/* View mode toggle */}
        <div className="flex rounded-lg border border-border-subtle bg-surface-raised">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
              viewMode === "list"
                ? "bg-accent/10 text-accent"
                : "text-text-ghost hover:text-text-muted"
            }`}
          >
            <List size={13} />
            {t("dataExplorer.ares.annotations.viewModes.list")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
              viewMode === "timeline"
                ? "bg-accent/10 text-accent"
                : "text-text-ghost hover:text-text-muted"
            }`}
          >
            <Clock size={13} />
            {t("dataExplorer.ares.annotations.viewModes.timeline")}
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
                  key={opt.labelKey}
                  type="button"
                  onClick={() => setTagFilter(opt.value)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    isActive ? opt.activeBg : opt.color + " hover:border-surface-highlight"
                  }`}
                >
                  {t(`dataExplorer.ares.annotations.tags.${opt.labelKey}`)}
                </button>
              );
            })}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-ghost" />
            <input
              type="text"
              placeholder={t("dataExplorer.ares.annotations.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-border-subtle bg-surface-raised py-1.5 pl-8 pr-3 text-sm text-text-primary
                         placeholder:text-text-ghost focus:border-success focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Loading */}
      {selectedSourceId && isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-text-muted" />
        </div>
      )}

      {/* Empty state */}
      {!selectedSourceId && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-highlight bg-surface-raised py-16">
          <MessageSquare size={32} className="text-text-muted mb-3" />
          <p className="text-sm text-text-muted">
            {t("dataExplorer.ares.annotations.empty.selectSource")}
          </p>
        </div>
      )}

      {selectedSourceId && !isLoading && (!annotations || annotations.length === 0) && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-highlight bg-surface-raised py-16">
          <MessageSquare size={32} className="text-text-muted mb-3" />
          <p className="text-sm text-text-muted">
            {t("dataExplorer.ares.annotations.empty.noAnnotations")}
          </p>
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
              className="rounded-xl border border-border-subtle bg-surface-raised p-4"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      {ann.chart_type}
                    </span>
                    {ann.tag && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TAG_BADGE_COLORS[ann.tag] ?? "bg-surface-highlight/20 text-text-muted"}`}>
                        {TAG_LABEL_KEYS[ann.tag]
                          ? t(`dataExplorer.ares.annotations.tags.${TAG_LABEL_KEYS[ann.tag]}`)
                          : ann.tag}
                      </span>
                    )}
                    <span className="text-xs text-text-muted">
                      {t("dataExplorer.ares.annotations.coordinateValue", {
                        axis: "x",
                        value: ann.x_value,
                      })}
                    </span>
                    {ann.y_value != null && (
                      <span className="text-xs text-text-muted">
                        {t("dataExplorer.ares.annotations.coordinateValue", {
                          axis: "y",
                          value: ann.y_value,
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-primary">{ann.annotation_text}</p>
                  <div className="flex gap-3 text-xs text-text-muted">
                    {ann.creator && <span>{ann.creator.name}</span>}
                    {ann.source && <span>{ann.source.source_name}</span>}
                    <span>{formatDate(ann.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setReplyingTo(replyingTo === ann.id ? null : ann.id)}
                    className="text-text-muted hover:text-success transition-colors p-1"
                    title={t("dataExplorer.ares.annotations.actions.reply")}
                  >
                    <Reply size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(ann.id)}
                    disabled={deleteMutation.isPending}
                    className="text-text-muted hover:text-primary transition-colors p-1"
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
