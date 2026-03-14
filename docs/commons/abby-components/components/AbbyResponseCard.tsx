/**
 * AbbyResponseCard
 *
 * Renders an Abby AI response in the message stream. Visually distinct
 * from human messages via the gradient avatar, "AI assistant" badge,
 * and model tag. Composes AbbySourceAttribution and AbbyFeedback as
 * child sections.
 *
 * Supports two modes:
 * - Full (default): avatar, name, badge, model, body, refs, sources, feedback
 * - Compact: smaller avatar, inline badge, collapsed sources, inline feedback
 */

import AbbyAvatar from './AbbyAvatar';
import AbbySourceAttribution from './AbbySourceAttribution';
import AbbyFeedback from './AbbyFeedback';
import type {
  AbbyResponseCardProps,
  ObjectReference,
  AbbySource,
} from '../types/abby';

/** Maps object reference types to display labels */
const REF_TYPE_LABELS: Record<string, string> = {
  cohort_definition: 'Cohort',
  concept_set: 'Concept set',
  study: 'Study',
  analysis_result: 'Analysis',
  data_source: 'Data source',
  dq_report: 'DQ report',
};

function ObjectRefChip({
  ref: objRef,
  onClick,
}: {
  ref: ObjectReference;
  onClick?: () => void;
}) {
  return (
    <button
      className="
        inline-flex items-center gap-1.5
        px-2.5 py-1 rounded-md
        bg-zinc-100 dark:bg-zinc-800
        border border-zinc-200/60 dark:border-zinc-700/60
        text-[11px]
        hover:border-zinc-300 dark:hover:border-zinc-600
        transition-colors duration-150
        cursor-pointer
      "
      onClick={onClick}
    >
      <span className="text-[9px] opacity-50">◆</span>
      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
        {REF_TYPE_LABELS[objRef.type] ?? objRef.type}
      </span>
      <span className="font-medium text-blue-600 dark:text-blue-400">
        {objRef.display_name}
      </span>
    </button>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
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
    <div className="group px-4 py-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors duration-100">
      <div className="flex gap-2.5">
        {/* Avatar */}
        <AbbyAvatar size={compact ? 'sm' : 'md'} />

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className={`font-medium text-zinc-900 dark:text-zinc-100 ${
                compact ? 'text-xs' : 'text-[13px]'
              }`}
            >
              Abby
            </span>

            <span
              className="
                inline-flex items-center
                px-1.5 py-px rounded
                text-[9px] font-medium
                bg-emerald-50 dark:bg-emerald-900/30
                text-emerald-700 dark:text-emerald-400
              "
            >
              {compact ? 'AI' : 'AI assistant'}
            </span>

            {!compact && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                MedGemma 1.5 · 4B
              </span>
            )}

            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 ml-auto">
              {formatTime(message.created_at)}
            </span>
          </div>

          {/* Response body */}
          {message.body_html ? (
            <div
              className={`
                text-zinc-600 dark:text-zinc-300 leading-relaxed
                prose prose-sm dark:prose-invert
                prose-strong:text-zinc-800 dark:prose-strong:text-zinc-100
                prose-strong:font-medium
                max-w-none
                ${compact ? 'text-xs' : 'text-[13px]'}
              `}
              dangerouslySetInnerHTML={{ __html: message.body_html }}
            />
          ) : (
            <div
              className={`
                text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap
                ${compact ? 'text-xs' : 'text-[13px]'}
              `}
            >
              {message.body}
            </div>
          )}

          {/* Object references */}
          {objectReferences.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {objectReferences.map((ref) => (
                <ObjectRefChip
                  key={ref.id}
                  ref={ref}
                  onClick={() => onObjectReferenceClick?.(ref)}
                />
              ))}
            </div>
          )}

          {/* Source attribution */}
          <AbbySourceAttribution
            sources={sources}
            defaultExpanded={false}
            onSourceClick={(source) => {
              // Navigate to source origin — channel message, wiki article, etc.
              console.log('Navigate to source:', source);
            }}
          />

          {/* Feedback */}
          {onFeedback && (
            <AbbyFeedback
              messageId={message.id}
              onSubmit={onFeedback}
            />
          )}
        </div>
      </div>
    </div>
  );
}
