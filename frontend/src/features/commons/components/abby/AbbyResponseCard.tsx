import AbbyAvatar from "./AbbyAvatar";
import AbbySourceAttribution from "./AbbySourceAttribution";
import AbbyFeedback from "./AbbyFeedback";
import type {
  AbbyResponseCardProps,
  ObjectReference,
} from "../../types/abby";

const REF_TYPE_LABELS: Record<string, string> = {
  cohort_definition: "Cohort",
  concept_set: "Concept set",
  study: "Study",
  analysis_result: "Analysis",
  data_source: "Data source",
  dq_report: "DQ report",
};

function ObjectRefChip({
  objRef,
  onClick,
}: {
  objRef: ObjectReference;
  onClick?: () => void;
}) {
  return (
    <button
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted border border-border text-[11px] hover:border-muted-foreground/30 transition-colors duration-150 cursor-pointer"
      onClick={onClick}
    >
      <span className="text-[9px] opacity-50">◆</span>
      <span className="text-[9px] text-muted-foreground uppercase tracking-wide">
        {REF_TYPE_LABELS[objRef.type] ?? objRef.type}
      </span>
      <span className="font-medium text-primary">
        {objRef.display_name}
      </span>
    </button>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AbbyResponseCard({
  message,
  sources,
  objectReferences,
  onFeedback,
  onObjectReferenceClick,
  compact = false,
}: AbbyResponseCardProps) {
  return (
    <div className="group px-4 py-3 hover:bg-muted/30 transition-colors duration-100">
      <div className="flex gap-2.5">
        <AbbyAvatar size={compact ? "sm" : "md"} />

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className={`font-medium text-foreground ${
                compact ? "text-xs" : "text-[13px]"
              }`}
            >
              Abby
            </span>

            <span className="inline-flex items-center px-1.5 py-px rounded text-[9px] font-medium bg-emerald-500/15 text-emerald-400">
              {compact ? "AI" : "AI assistant"}
            </span>

            {!compact && (
              <span className="text-[10px] text-muted-foreground">
                MedGemma 1.5 · 4B
              </span>
            )}

            <span className="text-[11px] text-muted-foreground ml-auto">
              {formatTime(message.created_at)}
            </span>
          </div>

          {/* Response body */}
          {message.body_html ? (
            <div
              className={`text-muted-foreground leading-relaxed prose prose-sm prose-invert max-w-none ${
                compact ? "text-xs" : "text-[13px]"
              }`}
              dangerouslySetInnerHTML={{ __html: message.body_html }}
            />
          ) : (
            <div
              className={`text-muted-foreground leading-relaxed whitespace-pre-wrap ${
                compact ? "text-xs" : "text-[13px]"
              }`}
            >
              {message.body}
            </div>
          )}

          {/* Object references */}
          {objectReferences.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {objectReferences.map((objRef) => (
                <ObjectRefChip
                  key={objRef.id}
                  objRef={objRef}
                  onClick={() => onObjectReferenceClick?.(objRef)}
                />
              ))}
            </div>
          )}

          {/* Source attribution */}
          <AbbySourceAttribution
            sources={sources}
            defaultExpanded={false}
            onSourceClick={() => {
              // TODO: navigate to source document
            }}
          />

          {/* Feedback */}
          {onFeedback && (
            <AbbyFeedback messageId={message.id} onSubmit={onFeedback} />
          )}
        </div>
      </div>
    </div>
  );
}
