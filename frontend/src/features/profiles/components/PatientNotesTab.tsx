import { useState } from "react";
import { Loader2, FileText, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Calendar, Tag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePatientNotes } from "../hooks/useProfiles";
import type { ClinicalNote } from "../types/profile";

interface PatientNotesTabProps {
  personId: number;
  sourceId: number;
}

function NoteCard({ note, isExpanded, onToggle }: { note: ClinicalNote; isExpanded: boolean; onToggle: () => void }) {
  const previewLength = 300;
  const needsTruncation = note.note_text.length > previewLength;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 hover:bg-surface-overlay transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text-primary truncate">
              {note.note_title || "Untitled Note"}
            </span>
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-medium text-info">
              <Tag size={9} />
              {note.note_class}
            </span>
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-domain-observation/10 px-2 py-0.5 text-[10px] font-medium text-domain-observation">
              {note.note_type}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Calendar size={10} />
              {note.note_date}
            </span>
            {note.provider_id && (
              <span className="inline-flex items-center gap-1">
                <User size={10} />
                Provider #{note.provider_id}
              </span>
            )}
            {note.visit_occurrence_id && (
              <span className="text-text-ghost">
                Visit #{note.visit_occurrence_id}
              </span>
            )}
            {note.language !== "Unknown" && (
              <span className="text-text-ghost">{note.language}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 mt-0.5">
          {isExpanded ? (
            <ChevronUp size={14} className="text-text-ghost" />
          ) : (
            <ChevronDown size={14} className="text-text-ghost" />
          )}
        </div>
      </button>

      {/* Body */}
      <div className="px-4 pb-3">
        <div className="rounded bg-surface-base border border-border-subtle p-3">
          <pre className="text-xs text-text-secondary whitespace-pre-wrap font-['IBM_Plex_Mono',monospace] leading-relaxed max-h-[600px] overflow-y-auto">
            {isExpanded || !needsTruncation
              ? note.note_text
              : note.note_text.slice(0, previewLength) + "..."}
          </pre>
        </div>
        {needsTruncation && !isExpanded && (
          <button
            type="button"
            onClick={onToggle}
            className="mt-2 text-[11px] text-success hover:text-success/80 transition-colors"
          >
            Show full note ({Math.ceil(note.note_text.length / 1000)}k chars)
          </button>
        )}
      </div>
    </div>
  );
}

export function PatientNotesTab({ personId, sourceId }: PatientNotesTabProps) {
  const [page, setPage] = useState(1);
  const [expandedNoteId, setExpandedNoteId] = useState<number | null>(null);

  const { data, isLoading, error } = usePatientNotes(sourceId, personId, page);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 rounded-lg border border-dashed border-surface-highlight bg-surface-raised">
        <FileText size={24} className="text-text-ghost mb-3" />
        <p className="text-sm text-critical">Failed to load clinical notes</p>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 rounded-lg border border-dashed border-surface-highlight bg-surface-raised">
        <FileText size={24} className="text-text-ghost mb-3" />
        <p className="text-sm text-text-muted">No clinical notes available for this patient</p>
      </div>
    );
  }

  const { meta } = data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-info" />
          <span className="text-sm font-semibold text-text-primary">
            Clinical Notes
          </span>
          <span className="text-xs text-text-muted">
            ({meta.total.toLocaleString()} total)
          </span>
        </div>
        {meta.last_page > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors",
                page <= 1
                  ? "border-border-subtle text-text-disabled cursor-not-allowed"
                  : "border-surface-highlight text-text-muted hover:text-text-primary hover:border-text-ghost",
              )}
            >
              <ChevronLeft size={12} />
              Prev
            </button>
            <span className="text-xs text-text-muted">
              {meta.current_page} / {meta.last_page}
            </span>
            <button
              type="button"
              disabled={page >= meta.last_page}
              onClick={() => setPage((p) => p + 1)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors",
                page >= meta.last_page
                  ? "border-border-subtle text-text-disabled cursor-not-allowed"
                  : "border-surface-highlight text-text-muted hover:text-text-primary hover:border-text-ghost",
              )}
            >
              Next
              <ChevronRight size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Notes list */}
      <div className="space-y-3">
        {data.data.map((note) => (
          <NoteCard
            key={note.note_id}
            note={note}
            isExpanded={expandedNoteId === note.note_id}
            onToggle={() =>
              setExpandedNoteId((prev) =>
                prev === note.note_id ? null : note.note_id,
              )
            }
          />
        ))}
      </div>

      {/* Bottom pagination */}
      {meta.last_page > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors",
              page <= 1
                ? "border-border-subtle text-text-disabled cursor-not-allowed"
                : "border-surface-highlight text-text-muted hover:text-text-primary hover:border-text-ghost",
            )}
          >
            <ChevronLeft size={12} />
            Previous
          </button>
          <span className="text-xs text-text-muted">
            Page {meta.current_page} of {meta.last_page}
          </span>
          <button
            type="button"
            disabled={page >= meta.last_page}
            onClick={() => setPage((p) => p + 1)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors",
              page >= meta.last_page
                ? "border-border-subtle text-text-disabled cursor-not-allowed"
                : "border-surface-highlight text-text-muted hover:text-text-primary hover:border-text-ghost",
            )}
          >
            Next
            <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
